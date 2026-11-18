import { useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuthStore } from './stores/authStore';
import { authApi } from './api/auth';
import apiClient from './api/client';
import AuthLayout from './layouts/AuthLayout';
import SuperAdminLayout from './layouts/SuperAdminLayout';
import DisponentLayout from './layouts/DisponentLayout';
import WorkerLayout from './layouts/WorkerLayout';
import BusinessLayout from './layouts/BusinessLayout';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import MagicLinkSentPage from './pages/auth/MagicLinkSentPage';
import MagicLoginPage from './pages/auth/MagicLoginPage';
import AcceptInvitePage from './pages/auth/AcceptInvitePage';
import NotFoundPage from './pages/NotFoundPage';
import MaintenancePage from './pages/MaintenancePage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import DashboardPage from './pages/app/DashboardPage';
import WorkerListPage from './pages/app/workers/WorkerListPage';
import WorkerDetailPage from './pages/app/workers/WorkerDetailPage';
import AddWorkerPage from './pages/app/workers/AddWorkerPage';
import WorkerEditPage from './pages/app/workers/WorkerEditPage';
import BusinessListPage from './pages/app/businesses/BusinessListPage';
import AddBusinessPage from './pages/app/businesses/AddBusinessPage';
import BusinessDetailPage from './pages/app/businesses/BusinessDetailPage';
import ShiftListPage from './pages/app/shifts/ShiftListPage';
import AddShiftPage from './pages/app/shifts/AddShiftPage';
import ShiftDetailPage from './pages/app/shifts/ShiftDetailPage';
import ShiftTemplatesPage from './pages/app/shifts/ShiftTemplatesPage';
import WorkerOnboardingReviewPage from './pages/app/workers/WorkerOnboardingReviewPage';
import WorkerAvailabilityDisponentPage from './pages/app/workers/WorkerAvailabilityDisponentPage';
import WorkerAuegDetailPage from './pages/app/workers/WorkerAuegDetailPage';
import AssignmentDetailPage from './pages/app/assignments/AssignmentDetailPage';
import DocumentManagerPage from './pages/app/documents/DocumentManagerPage';
import BroadcastPage from './pages/app/messages/BroadcastPage';
import CreditNotePage from './pages/app/invoices/CreditNotePage';
import CreditNoteDetailPage from './pages/app/invoices/CreditNoteDetailPage';
import TimesheetListPage from './pages/app/timesheets/TimesheetListPage';
import TimesheetDetailPage from './pages/app/timesheets/TimesheetDetailPage';
import InvoiceListPage from './pages/app/invoices/InvoiceListPage';
import CreateInvoicePage from './pages/app/invoices/CreateInvoicePage';
import InvoiceDetailPage from './pages/app/invoices/InvoiceDetailPage';
import ContractListPage from './pages/app/contracts/ContractListPage';
import ComplianceAuegPage from './pages/app/compliance/ComplianceAuegPage';
import WorkerHomePage from './pages/worker/WorkerHomePage';
import WorkerAvailableShiftsPage from './pages/worker/WorkerAvailableShiftsPage';
import WorkerMyShiftsPage from './pages/worker/WorkerMyShiftsPage';
import WorkerShiftDetailPage from './pages/worker/WorkerShiftDetailPage';
import WorkerContractPage from './pages/worker/WorkerContractPage';
import WorkerContractsListPage from './pages/worker/WorkerContractsListPage';
import WorkerTimesheetsPage from './pages/worker/WorkerTimesheetsPage';
import WorkerTimesheetDetailPage from './pages/worker/WorkerTimesheetDetailPage';
import WorkerAvailabilityPage from './pages/worker/WorkerAvailabilityPage';
import TenantsPage from './pages/superadmin/TenantsPage';
import StaffListPage from './pages/app/staff/StaffListPage';
import TenantDetailPage from './pages/superadmin/TenantDetailPage';
import ClientDashboardPage from './pages/client/ClientDashboardPage';
import ClientShiftsPage from './pages/client/ClientShiftsPage';
import ClientShiftDetailPage from './pages/client/ClientShiftDetailPage';
import ClientInvoicesPage from './pages/client/ClientInvoicesPage';
import ClientInvoiceDetailPage from './pages/client/ClientInvoiceDetailPage';
import ClientLoginPage from './pages/auth/ClientLoginPage';
import AgencySettingsPage from './pages/app/settings/AgencySettingsPage';
import WorkerProfilePage from './pages/worker/WorkerProfilePage';
import SuperAdminDashboardPage from './pages/superadmin/SuperAdminDashboardPage';
import ProfilePage from './pages/app/settings/ProfilePage';
import ComplianceDashboardPage from './pages/app/compliance/ComplianceDashboardPage';
import ReportsPage from './pages/app/reports/ReportsPage';
import DocumentsReportPage from './pages/app/reports/DocumentsReportPage';
import SubscriptionPage from './pages/app/settings/SubscriptionPage';
import AuditLogPage from './pages/app/AuditLogPage';
import WorkerDocumentsPage from './pages/worker/WorkerDocumentsPage';
import ClientProfilePage from './pages/client/ClientProfilePage';
import MessagesPage from './pages/app/MessagesPage';
import WorkerMessagesPage from './pages/worker/WorkerMessagesPage';
import NotificationsPage from './pages/app/NotificationsPage';
import ComplianceSettingsPage from './pages/app/settings/ComplianceSettingsPage';
import FeatureSettingsPage from './pages/app/settings/FeatureSettingsPage';
import NotificationSettingsPage from './pages/app/settings/NotificationSettingsPage';
import DocumentSettingsPage from './pages/app/settings/DocumentSettingsPage';
import SettingsLayout from './layouts/SettingsLayout';
import SuperAdminAuditLogPage from './pages/superadmin/SuperAdminAuditLogPage';
import SuperAdminMonitorPage from './pages/superadmin/SuperAdminMonitorPage';
import SuperAdminBillingPage from './pages/superadmin/SuperAdminBillingPage';
import SuperAdminSettingsPage from './pages/superadmin/SuperAdminSettingsPage';
import SuperAdminTemplatesPage from './pages/superadmin/SuperAdminTemplatesPage';
import WorkerInvitePage from './pages/app/workers/WorkerInvitePage';
import WorkerOffersPage from './pages/worker/WorkerOffersPage';
import WorkerOfferDetailPage from './pages/worker/WorkerOfferDetailPage';
import BillingSettingsPage from './pages/app/settings/BillingSettingsPage';
import TemplatesSettingsPage from './pages/app/settings/TemplatesSettingsPage';
import IntegrationsSettingsPage from './pages/app/settings/IntegrationsSettingsPage';
import WorkerUtilizationReportPage from './pages/app/reports/WorkerUtilizationReportPage';
import ShiftDetailReportPage from './pages/app/reports/ShiftDetailReportPage';
import ClientRevenueReportPage from './pages/app/reports/ClientRevenueReportPage';
import InvoiceAgingReportPage from './pages/app/reports/InvoiceAgingReportPage';
import OpenShiftsReportPage from './pages/app/reports/OpenShiftsReportPage';
import CreateTenantPage from './pages/superadmin/CreateTenantPage';
import WorkerSelfRegistrationPage from './pages/auth/WorkerSelfRegistrationPage';
import GetStartedPage from './pages/auth/GetStartedPage';
import ImpressumPage from './pages/legal/ImpressumPage';
import DatenschutzPage from './pages/legal/DatenschutzPage';
import AgbPage from './pages/legal/AgbPage';
import AttendancePage from './pages/app/attendance/AttendancePage';
import WorkerCheckInPage from './pages/worker/WorkerCheckInPage';
import ClientShiftAttendancePage from './pages/client/ClientShiftAttendancePage';
import WorkerNotificationSettingsPage from './pages/worker/settings/WorkerNotificationSettingsPage';
import WorkerShiftHistoryPage from './pages/worker/shifts/WorkerShiftHistoryPage';
import WorkerRatingPage from './pages/client/shifts/WorkerRatingPage';
import ShiftRequestsPage from './pages/client/requests/ShiftRequestsPage';
import NewShiftRequestPage from './pages/client/requests/NewShiftRequestPage';
import ClientNotificationSettingsPage from './pages/client/settings/ClientNotificationSettingsPage';

export default function App() {
  const { isInitializing } = useAuthStore();
  const bootstrapped = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode double-invocation — prevents two simultaneous
    // refresh requests which would trigger token-reuse detection and revoke the session.
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    (async () => {
      try {
        const { data } = await apiClient.post<{ accessToken: string }>('/auth/refresh');
        const user = await authApi.me();
        // Single atomic update — no intermediate render between isAuthenticated and isInitializing
        useAuthStore.setState({
          user,
          accessToken: data.accessToken,
          isAuthenticated: true,
          isInitializing: false,
        });
      } catch {
        useAuthStore.getState().setInitialized();
      }
    })();
  }, []);

  if (isInitializing) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Routes>
      {/* ── Auth / Public ─────────────────────────────────────── */}
      {/* Login & client login are standalone full-page layouts */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/client/login" element={<ClientLoginPage />} />
      {/* Secondary auth pages use the shared AuthLayout card wrapper */}
      <Route element={<AuthLayout />}>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        <Route path="/invite/:token" element={<AcceptInvitePage />} />
      </Route>

      {/* Magic-link pages don't use AuthLayout redirect guard */}
      <Route path="/magic-link-sent" element={<MagicLinkSentPage />} />
      <Route path="/magic-login/:token" element={<MagicLoginPage />} />

      {/* Public worker self-registration — no auth required */}
      <Route path="/register/:loginCode" element={<WorkerSelfRegistrationPage />} />

      {/* Public agency self-signup — no auth required */}
      <Route path="/get-started" element={<GetStartedPage />} />

      {/* Legal pages — public, no auth required */}
      <Route path="/impressum" element={<ImpressumPage />} />
      <Route path="/datenschutz" element={<DatenschutzPage />} />
      <Route path="/agb" element={<AgbPage />} />

      {/* ── Super Admin ───────────────────────────────────────── */}
      <Route element={<ProtectedRoute roles={['super_admin']} />}>
        <Route path="/superadmin" element={<SuperAdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<SuperAdminDashboardPage />} />
          <Route path="tenants" element={<TenantsPage />} />
          <Route path="tenants/new" element={<CreateTenantPage />} />
          <Route path="tenants/:tenantId" element={<TenantDetailPage />} />
          <Route path="billing" element={<SuperAdminBillingPage />} />
          <Route path="templates" element={<SuperAdminTemplatesPage />} />
          <Route path="monitor" element={<SuperAdminMonitorPage />} />
          <Route path="settings" element={<SuperAdminSettingsPage />} />
          <Route path="audit-log" element={<SuperAdminAuditLogPage />} />
        </Route>
      </Route>

      {/* ── Agency Admin + Disponent (unified) ───────────────── */}
      <Route element={<ProtectedRoute roles={['agency_admin', 'disponent']} />}>
        <Route path="/app" element={<DisponentLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="workers" element={<WorkerListPage />} />
          <Route path="workers/new" element={<AddWorkerPage />} />
          <Route path="workers/:workerId/edit" element={<WorkerEditPage />} />
          <Route path="workers/invite" element={<WorkerInvitePage />} />
          <Route path="workers/:workerId/review" element={<WorkerOnboardingReviewPage />} />
          <Route path="workers/:workerId/availability" element={<WorkerAvailabilityDisponentPage />} />
          <Route path="workers/:workerId/aueg" element={<WorkerAuegDetailPage />} />
          <Route path="workers/:workerId" element={<WorkerDetailPage />} />
          <Route path="assignments/:assignmentId" element={<AssignmentDetailPage />} />
          <Route path="documents" element={<DocumentManagerPage />} />
          <Route path="businesses" element={<BusinessListPage />} />
          <Route path="businesses/new" element={<AddBusinessPage />} />
          <Route path="businesses/:businessId" element={<BusinessDetailPage />} />
          <Route path="shifts" element={<ShiftListPage />} />
          <Route path="shifts/new" element={<AddShiftPage />} />
          <Route path="shifts/templates" element={<ShiftTemplatesPage />} />
          <Route path="shifts/:shiftId" element={<ShiftDetailPage />} />
          <Route path="timesheets" element={<TimesheetListPage />} />
          <Route path="timesheets/:id" element={<TimesheetDetailPage />} />
          <Route path="invoices" element={<InvoiceListPage />} />
          <Route path="invoices/new" element={<CreateInvoicePage />} />
          <Route path="invoices/:invoiceId/credit-notes" element={<CreditNotePage />} />
          <Route path="invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="credit-notes/:creditNoteId" element={<CreditNoteDetailPage />} />
          <Route path="contracts" element={<ContractListPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="compliance" element={<ComplianceDashboardPage />} />
          <Route path="compliance/aueg" element={<ComplianceAuegPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="messages/broadcast" element={<BroadcastPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          {/* Reports — accessible to both agency_admin and disponent */}
          <Route path="reports" element={<ReportsPage />} />
          <Route path="reports/documents" element={<DocumentsReportPage />} />
          <Route path="reports/worker-utilization" element={<WorkerUtilizationReportPage />} />
          <Route path="reports/shift-details" element={<ShiftDetailReportPage />} />
          <Route path="reports/client-revenue" element={<ClientRevenueReportPage />} />
          <Route path="reports/invoice-aging" element={<InvoiceAgingReportPage />} />
          <Route path="reports/open-shifts" element={<OpenShiftsReportPage />} />
          {/* Agency Admin only routes — disponents are redirected to /403 */}
          <Route element={<ProtectedRoute roles={['agency_admin']} />}>
            <Route path="staff" element={<StaffListPage />} />
            <Route path="subscription" element={<SubscriptionPage />} />
            <Route path="audit-log" element={<AuditLogPage />} />
            <Route path="settings" element={<SettingsLayout />}>
              <Route index element={<Navigate to="agency" replace />} />
              <Route path="agency" element={<AgencySettingsPage />} />
              <Route path="compliance" element={<ComplianceSettingsPage />} />
              <Route path="features" element={<FeatureSettingsPage />} />
              <Route path="documents" element={<DocumentSettingsPage />} />
              <Route path="notifications" element={<NotificationSettingsPage />} />
              <Route path="billing" element={<BillingSettingsPage />} />
              <Route path="templates" element={<TemplatesSettingsPage />} />
              <Route path="integrations" element={<IntegrationsSettingsPage />} />
            </Route>
          </Route>
        </Route>
      </Route>

      {/* ── Worker (PWA) ──────────────────────────────────────── */}
      <Route element={<ProtectedRoute roles={['worker']} />}>
        <Route path="/worker" element={<WorkerLayout />}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<WorkerHomePage />} />
          <Route path="offers" element={<WorkerOffersPage />} />
          <Route path="offers/:offerId" element={<WorkerOfferDetailPage />} />
          <Route path="available-shifts" element={<WorkerAvailableShiftsPage />} />
          <Route path="shifts" element={<WorkerMyShiftsPage />} />
          <Route path="shifts/:id" element={<WorkerShiftDetailPage />} />
          <Route path="shifts/:shiftId/checkin" element={<WorkerCheckInPage />} />
          <Route path="contracts" element={<WorkerContractsListPage />} />
          <Route path="contracts/:contractId" element={<WorkerContractPage />} />
          <Route path="timesheets" element={<WorkerTimesheetsPage />} />
          <Route path="timesheets/:id" element={<WorkerTimesheetDetailPage />} />
          <Route path="documents" element={<WorkerDocumentsPage />} />
          <Route path="availability" element={<WorkerAvailabilityPage />} />
          <Route path="messages" element={<WorkerMessagesPage />} />
          <Route path="profile" element={<WorkerProfilePage />} />
          <Route path="shifts/history" element={<WorkerShiftHistoryPage />} />
          <Route path="settings/notifications" element={<WorkerNotificationSettingsPage />} />
        </Route>
      </Route>

      {/* ── Business Contact ──────────────────────────────────── */}
      <Route element={<ProtectedRoute roles={['business_contact']} />}>
        <Route path="/client" element={<BusinessLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ClientDashboardPage />} />
          <Route path="shifts" element={<ClientShiftsPage />} />
          <Route path="shifts/:id" element={<ClientShiftDetailPage />} />
          <Route path="shifts/:shiftId/attendance" element={<ClientShiftAttendancePage />} />
          <Route path="shifts/:shiftId/rate" element={<WorkerRatingPage />} />
          <Route path="invoices" element={<ClientInvoicesPage />} />
          <Route path="invoices/:id" element={<ClientInvoiceDetailPage />} />
          <Route path="requests" element={<ShiftRequestsPage />} />
          <Route path="requests/new" element={<NewShiftRequestPage />} />
          <Route path="profile" element={<ClientProfilePage />} />
          <Route path="settings/notifications" element={<ClientNotificationSettingsPage />} />
        </Route>
      </Route>

      {/* ── Error pages ───────────────────────────────────────── */}
      <Route path="/maintenance" element={<MaintenancePage />} />
      <Route path="/403" element={<UnauthorizedPage />} />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
