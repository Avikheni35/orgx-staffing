import { Business, IBusiness } from '../models/Business';
import { AppError } from '../utils/AppError';
import { emitIntegrationEvent } from '../utils/integration';
import { peers } from '../utils/serviceClient';

export interface BusinessFilters {
  search?: string;
  status?: 'active' | 'inactive';
  page?: number;
  limit?: number;
}

export async function listBusinesses(tenantId: string, filters: BusinessFilters = {}) {
  const { search, status = 'active', page = 1, limit = 20 } = filters;
  const query: Record<string, unknown> = { tenantId, status };

  if (search) {
    query.$or = [{ name: new RegExp(search, 'i') }, { industry: new RegExp(search, 'i') }];
  }

  const [businesses, total] = await Promise.all([
    Business.find(query).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Business.countDocuments(query),
  ]);

  return { businesses, total, page, pages: Math.ceil(total / limit) };
}

export async function getBusiness(tenantId: string, businessId: string): Promise<IBusiness> {
  const business = await Business.findOne({ _id: businessId, tenantId });
  if (!business) throw new AppError('Business not found', 404);
  return business;
}

export interface CreateBusinessData {
  name: string;
  industry?: string;
  vatNumber?: string;
  hrbNumber?: string;
  address?: { street?: string; city?: string; postalCode?: string; country?: string };
  defaultBillingRatePerHour?: number;
  notes?: string;
}

export async function createBusiness(
  tenantId: string,
  data: CreateBusinessData,
  createdBy: string
): Promise<IBusiness> {
  const business = await Business.create({ tenantId, ...data, createdBy });

  emitIntegrationEvent({
    tenantId,
    eventType: 'business.created',
    entityType: 'Business',
    entityId: business._id,
    payload: { name: business.name, industry: business.industry, vatNumber: business.vatNumber },
  });

  // Sync as a Customer in M3 ERP (fire-and-forget)
  peers.m3.syncCustomer(tenantId, {
    m1BusinessId: business._id.toString(),
    name:         business.name,
    vatId:        business.vatNumber,
    address:      business.address,
  }).catch(() => {});

  return business;
}

export async function updateBusiness(
  tenantId: string,
  businessId: string,
  data: Partial<CreateBusinessData>
): Promise<IBusiness> {
  const business = await Business.findOneAndUpdate(
    { _id: businessId, tenantId },
    { $set: data },
    { new: true, runValidators: true }
  );
  if (!business) throw new AppError('Business not found', 404);
  return business;
}

export interface ContactData {
  firstName: string;
  lastName: string;
  role?: string;
  email: string;
  phone?: string;
}

export async function addContact(
  tenantId: string,
  businessId: string,
  data: ContactData
): Promise<IBusiness> {
  const business = await Business.findOne({ _id: businessId, tenantId });
  if (!business) throw new AppError('Business not found', 404);
  business.contacts.push({ ...data, hasPortalAccess: false } as never);
  await business.save();
  return business;
}

export async function removeContact(
  tenantId: string,
  businessId: string,
  contactId: string
): Promise<IBusiness> {
  const business = await Business.findOne({ _id: businessId, tenantId });
  if (!business) throw new AppError('Business not found', 404);
  const idx = business.contacts.findIndex((c) => c._id.toString() === contactId);
  if (idx === -1) throw new AppError('Contact not found', 404);
  business.contacts.splice(idx, 1);
  await business.save();
  return business;
}

export interface LocationData {
  name: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
}

export async function addLocation(
  tenantId: string,
  businessId: string,
  data: LocationData
): Promise<IBusiness> {
  const business = await Business.findOne({ _id: businessId, tenantId });
  if (!business) throw new AppError('Business not found', 404);
  business.locations.push(data as never);
  await business.save();
  return business;
}

export async function removeLocation(
  tenantId: string,
  businessId: string,
  locationId: string
): Promise<IBusiness> {
  const business = await Business.findOne({ _id: businessId, tenantId });
  if (!business) throw new AppError('Business not found', 404);
  const idx = business.locations.findIndex((l) => l._id.toString() === locationId);
  if (idx === -1) throw new AppError('Location not found', 404);
  business.locations.splice(idx, 1);
  await business.save();
  return business;
}
