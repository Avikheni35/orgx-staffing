import { Router } from 'express';
import { resolveTenant } from '../middleware/tenant';
import { requireModule } from '../middleware/requireModule';
import { trialGuard } from '../middleware/trialGuard';
import authRoutes from './auth';
import workerRoutes from './workers';
import businessRoutes from './businesses';
import shiftRoutes from './shifts';
import timesheetRoutes from './timesheets';
import invoiceRoutes from './invoices';
import workerPortalRoutes from './workerPortal';
import contractRoutes from './contracts';
import complianceRoutes from './compliance';
import superadminRoutes from './superadmin';
import staffRoutes from './staff';
import clientPortalRoutes from './clientPortal';
import settingsRoutes from './settings';
import reportsRoutes from './reports';
import auditLogRoutes from './auditLog';
import messagesRoutes from './messages';
import notificationRoutes from './notifications';
import contractTemplateRoutes from './contractTemplates';
import billingRoutes from './billing';
import integrationRoutes from './integrations';
import shiftTemplateRoutes from './shiftTemplates';
import creditNoteRoutes from './creditNotes';
import workerRatingRoutes from './workerRatings';
import shiftRequestRoutes from './shiftRequests';
import pushRoutes from './push';
import internalRoutes from './internal/index';
import publicRegisterRoutes from './publicRegister';

const router = Router();

// Internal routes — authenticated via x-service-token, no tenant header needed
router.use('/internal', internalRoutes);

// Public routes — no tenant or auth required
router.use('/public/register', publicRegisterRoutes);

router.use(resolveTenant);
router.use('/auth', authRoutes);        // auth is always reachable — no module gate
router.use(trialGuard);                 // block expired trials and suspended tenants on all data routes
router.use(requireModule('m1'));        // all data routes below require M1 to be enabled
router.use('/workers', workerRoutes);
router.use('/businesses', businessRoutes);
router.use('/shifts', shiftRoutes);
router.use('/timesheets', timesheetRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/worker-portal', workerPortalRoutes);
router.use('/contracts', contractRoutes);
router.use('/compliance', complianceRoutes);
router.use('/superadmin', superadminRoutes);
router.use('/staff', staffRoutes);
router.use('/client-portal', clientPortalRoutes);
router.use('/settings', settingsRoutes);
router.use('/reports', reportsRoutes);
router.use('/audit-log', auditLogRoutes);
router.use('/messages', messagesRoutes);
router.use('/notifications', notificationRoutes);
router.use('/contract-templates', contractTemplateRoutes);
router.use('/billing', billingRoutes);
router.use('/integrations', integrationRoutes);
router.use('/shift-templates', shiftTemplateRoutes);
router.use('/credit-notes', creditNoteRoutes);
router.use('/worker-ratings', workerRatingRoutes);
router.use('/shift-requests', shiftRequestRoutes);
router.use('/push', pushRoutes);

export default router;
