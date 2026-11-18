import { Worker, IWorker, WorkerStatus } from '../models/Worker';
import { User } from '../models/User';
import { Tenant } from '../models/Tenant';
import { AppError } from '../utils/AppError';
import { Types } from 'mongoose';
import { signWorkerInviteToken } from '../utils/token';
import { hashToken } from '../utils/crypto';
import { sendEmail, workerInviteHtml } from '../utils/email';
import { env } from '../config/env';
import { emitIntegrationEvent } from '../utils/integration';
import { peers } from '../utils/serviceClient';

export interface WorkerFilters {
  status?: WorkerStatus;
  skill?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface WorkerListResult {
  workers: IWorker[];
  total: number;
  page: number;
  pages: number;
}

export async function listWorkers(
  tenantId: string,
  filters: WorkerFilters = {}
): Promise<WorkerListResult> {
  const { status, skill, search, page = 1, limit = 20 } = filters;

  const query: Record<string, unknown> = { tenantId, status: { $ne: 'anonymized' } };

  if (status) query.status = status;
  if (skill) query.skills = skill;
  if (search) {
    const re = new RegExp(search, 'i');
    query.$or = [{ firstName: re }, { lastName: re }, { email: re }, { phone: re }];
  }

  const [workers, total] = await Promise.all([
    Worker.find(query)
      .sort({ lastName: 1, firstName: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Worker.countDocuments(query),
  ]);

  return { workers: workers as unknown as IWorker[], total, page, pages: Math.ceil(total / limit) };
}

export async function getWorker(tenantId: string, workerId: string): Promise<IWorker> {
  const worker = await Worker.findOne({ _id: workerId, tenantId });
  if (!worker) throw new AppError('Worker not found', 404);
  return worker;
}

export interface CreateWorkerData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  address?: { street?: string; city?: string; postalCode?: string; country?: string };
  skills?: string[];
  languages?: Array<{ language: string; level: string }>;
  steuerklasse?: string;
  healthInsuranceProvider?: string;
}

export async function createWorker(
  tenantId: string,
  data: CreateWorkerData,
  createdBy: string
): Promise<IWorker> {
  const existing = await Worker.findOne({ tenantId, email: data.email.toLowerCase() });
  if (existing) throw new AppError('A worker with this email already exists', 409);

  const tenant = await Tenant.findById(tenantId).select('planLimits').lean();
  const workerCount = await Worker.countDocuments({ tenantId, status: { $ne: 'anonymized' } });
  const maxWorkers = (tenant as { planLimits?: { maxWorkers?: number } } | null)?.planLimits?.maxWorkers ?? 9999;
  if (workerCount >= maxWorkers)
    throw new AppError(`Ihr Plan erlaubt maximal ${maxWorkers} Mitarbeiter. Bitte upgraden Sie Ihren Plan.`, 403);

  const worker = await Worker.create({
    tenantId,
    ...data,
    status: 'pending_review',
    registrationSource: 'manual',
    createdBy: new Types.ObjectId(createdBy),
  });

  emitIntegrationEvent({
    tenantId,
    eventType: 'worker.created',
    entityType: 'Worker',
    entityId: worker._id,
    payload: { firstName: worker.firstName, lastName: worker.lastName, email: worker.email, skills: worker.skills },
  });

  return worker;
}

export async function updateWorker(
  tenantId: string,
  workerId: string,
  data: Partial<CreateWorkerData>
): Promise<IWorker> {
  const worker = await Worker.findOne({ _id: workerId, tenantId });
  if (!worker) throw new AppError('Worker not found', 404);

  // If email is changing, validate uniqueness and sync the portal User account
  if (data.email && data.email.toLowerCase() !== worker.email) {
    const newEmail = data.email.toLowerCase();
    const conflict = await User.findOne({ email: newEmail, tenantId });
    if (conflict && conflict._id.toString() !== worker.userId?.toString()) {
      throw new AppError('Diese E-Mail-Adresse wird bereits von einem anderen Konto verwendet.', 409);
    }
    if (worker.userId) {
      await User.updateOne({ _id: worker.userId }, { $set: { email: newEmail } });
    }
    data = { ...data, email: newEmail };
  }

  Object.assign(worker, data);
  await worker.save();

  emitIntegrationEvent({
    tenantId,
    eventType: 'worker.updated',
    entityType: 'Worker',
    entityId: worker._id,
    payload: { firstName: worker.firstName, lastName: worker.lastName, email: worker.email, updatedFields: Object.keys(data) },
  });

  return worker;
}

export async function setWorkerStatus(
  tenantId: string,
  workerId: string,
  status: WorkerStatus,
  note?: string
): Promise<IWorker> {
  const worker = await Worker.findOneAndUpdate(
    { _id: workerId, tenantId },
    { $set: { status, statusNote: note } },
    { new: true }
  );
  if (!worker) throw new AppError('Worker not found', 404);

  emitIntegrationEvent({
    tenantId,
    eventType: 'worker.status_changed',
    entityType: 'Worker',
    entityId: worker._id,
    payload: { status, note },
  });

  // Notify M2 event staffing pool when worker becomes active (fire-and-forget)
  if (status === 'active') {
    peers.m2.workerOnboarded(tenantId, {
      m1WorkerId:  worker._id.toString(),
      workerName:  `${worker.firstName} ${worker.lastName}`,
      email:       worker.email,
      skills:      worker.skills ?? [],
    }).catch(() => {});
  }

  return worker;
}

export async function sendWorkerInvite(
  tenantId: string,
  workerId: string,
  invitedByName: string
): Promise<void> {
  const worker = await Worker.findOne({ _id: workerId, tenantId });
  if (!worker) throw new AppError('Worker not found', 404);
  if (worker.status === 'suspended' || worker.status === 'blacklisted') {
    throw new AppError('Cannot invite a suspended or blacklisted worker', 400);
  }

  let user = await User.findOne({ email: worker.email, tenantId, role: 'worker' });
  if (!user) {
    user = await User.create({
      tenantId,
      role: 'worker',
      email: worker.email,
      firstName: worker.firstName,
      lastName: worker.lastName,
      status: 'active',
      emailVerified: false,
    });
    worker.userId = user._id;
    await worker.save();
  }

  const token = signWorkerInviteToken(user._id.toString());
  user.magicLinkTokenHash = hashToken(token);
  user.magicLinkExpires = new Date(Date.now() + 72 * 60 * 60 * 1000);
  await user.save();

  let url = `${env.CLIENT_URL}/magic-login/${token}`;
  const tenant = await Tenant.findById(tenantId).select('loginCode').lean();
  if (tenant) url += `?tenant=${tenant.loginCode}`;

  await sendEmail({
    to: worker.email,
    subject: user.language === 'de' ? 'Einladung zum Mitarbeiterportal' : 'Worker portal invitation',
    html: workerInviteHtml(url, worker.firstName, invitedByName, user.language),
  });
}

export async function getDashboardStats(tenantId: string) {
  const { Timesheet } = await import('../models/Timesheet');
  const { Contract } = await import('../models/Contract');

  const [total, active, pendingReview, expiringDocs, auegWarnings, pendingTimesheets, pendingContracts] = await Promise.all([
    Worker.countDocuments({ tenantId }),
    Worker.countDocuments({ tenantId, status: 'active' }),
    Worker.countDocuments({ tenantId, status: 'pending_review' }),
    Worker.countDocuments({
      tenantId,
      status: 'active',
      'documents.expiryDate': {
        $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        $gte: new Date(),
      },
    }),
    Worker.countDocuments({
      tenantId,
      status: 'active',
      'auegTracking.monthsWorked': { $gte: 9 },
    }),
    Timesheet.countDocuments({ tenantId, status: { $in: ['pending', 'disputed'] } }),
    Contract.countDocuments({ tenantId, status: 'pending_signature' }),
  ]);

  return { total, active, pendingReview, expiringDocs, auegWarnings, pendingTimesheets, pendingContracts };
}
