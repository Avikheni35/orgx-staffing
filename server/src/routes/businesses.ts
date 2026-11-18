import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import * as businessService from '../services/business.service';
import { Business } from '../models/Business';
import { User } from '../models/User';
import { AppError } from '../utils/AppError';
import { signSpecialToken } from '../utils/token';
import { hashToken } from '../utils/crypto';
import { sendEmail, inviteHtml } from '../utils/email';
import { Tenant } from '../models/Tenant';
import { env } from '../config/env';
import { logAudit } from '../utils/audit';

const router = Router();
router.use(requireAuth);
router.use(requireRole('super_admin', 'agency_admin', 'disponent'));

const createSchema = z.object({
  name: z.string().min(1).max(100),
  industry: z.string().optional(),
  vatNumber: z.string().optional(),
  hrbNumber: z.string().optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  defaultBillingRatePerHour: z.number().positive().optional(),
  notes: z.string().optional(),
});

// GET /api/businesses
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const { search, status, page, limit } = req.query as Record<string, string>;
    const result = await businessService.listBusinesses(tenantId, {
      search,
      status: status as 'active' | 'inactive' | undefined,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
    res.json(result);
  })
);

// GET /api/businesses/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const business = await businessService.getBusiness(tenantId, req.params.id);
    res.json(business);
  })
);

// POST /api/businesses
router.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const business = await businessService.createBusiness(tenantId, req.body, req.user!.userId);
    res.status(201).json(business);
  })
);

// PUT /api/businesses/:id
router.put(
  '/:id',
  validate(createSchema.partial()),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const business = await businessService.updateBusiness(tenantId, req.params.id, req.body);
    res.json(business);
  })
);

const contactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
});

const locationSchema = z.object({
  name: z.string().min(1),
  street: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
});

// POST /api/businesses/:id/contacts
router.post(
  '/:id/contacts',
  validate(contactSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const business = await businessService.addContact(tenantId, req.params.id, req.body);
    res.json(business);
  })
);

// DELETE /api/businesses/:id/contacts/:contactId
router.delete(
  '/:id/contacts/:contactId',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const business = await businessService.removeContact(tenantId, req.params.id, req.params.contactId);
    res.json(business);
  })
);

// POST /api/businesses/:id/contacts/:contactId/grant-access
// Creates a business_contact User for this contact and sends an invite email
router.post(
  '/:id/contacts/:contactId/grant-access',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const business = await Business.findOne({ _id: req.params.id, tenantId });
    if (!business) throw new AppError('Business not found', 404);

    const contact = business.contacts.find((c) => c._id.toString() === req.params.contactId);
    if (!contact) throw new AppError('Contact not found', 404);
    if (!contact.email) throw new AppError('Contact has no email address', 400);

    // If already linked, just resend invite
    if (contact.userId) {
      const existingUser = await User.findById(contact.userId);
      if (existingUser && existingUser.status !== 'inactive') {
        throw new AppError('Contact already has active portal access', 409);
      }
    }

    const tenant = await Tenant.findById(tenantId).lean();
    if (!tenant) throw new AppError('Tenant not found', 404);

    // Create (or reuse) the User record
    let user = await User.findOne({ email: contact.email.toLowerCase(), tenantId, role: 'business_contact' });
    if (!user) {
      user = new User({
        tenantId,
        role: 'business_contact',
        email: contact.email.toLowerCase(),
        firstName: contact.firstName,
        lastName: contact.lastName,
        status: 'inactive',
      });
    }

    const token = signSpecialToken(user._id.toString(), 'invite');
    user.inviteTokenHash = hashToken(token);
    user.inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await user.save();

    // Link userId on the contact
    contact.userId = user._id;
    contact.hasPortalAccess = true;
    await business.save();

    const url = `${env.CLIENT_URL}/invite/${token}`;
    sendEmail({
      to: contact.email,
      subject: `Einladung zum Kundenportal – ${tenant.name}`,
      html: inviteHtml(url, tenant.name, 'de'),
    }).catch(() => {});

    logAudit({
      req,
      action: 'portal_access.granted',
      targetType: 'BusinessContact',
      targetId: contact._id.toString(),
      targetName: `${contact.firstName} ${contact.lastName} (${contact.email})`,
      details: { businessId: business._id.toString(), businessName: business.name },
    });
    res.json({ message: 'Portal access granted and invite sent', userId: user._id });
  })
);

// POST /api/businesses/:id/contacts/:contactId/revoke-access
router.post(
  '/:id/contacts/:contactId/revoke-access',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const business = await Business.findOne({ _id: req.params.id, tenantId });
    if (!business) throw new AppError('Business not found', 404);

    const contact = business.contacts.find((c) => c._id.toString() === req.params.contactId);
    if (!contact) throw new AppError('Contact not found', 404);

    if (contact.userId) {
      await User.deleteOne({ _id: contact.userId, tenantId, role: 'business_contact' });
    }
    contact.userId = undefined;
    contact.hasPortalAccess = false;
    await business.save();

    logAudit({
      req,
      action: 'portal_access.revoked',
      targetType: 'BusinessContact',
      targetId: contact._id.toString(),
      targetName: `${contact.firstName} ${contact.lastName}`,
      details: { businessId: business._id.toString(), businessName: business.name },
    });
    res.json({ message: 'Portal access revoked' });
  })
);

// POST /api/businesses/:id/locations
router.post(
  '/:id/locations',
  validate(locationSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const business = await businessService.addLocation(tenantId, req.params.id, req.body);
    res.json(business);
  })
);

// DELETE /api/businesses/:id/locations/:locationId
router.delete(
  '/:id/locations/:locationId',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const business = await businessService.removeLocation(tenantId, req.params.id, req.params.locationId);
    res.json(business);
  })
);

export default router;
