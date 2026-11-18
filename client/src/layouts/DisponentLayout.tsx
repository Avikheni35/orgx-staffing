import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ReceiptIcon from '@mui/icons-material/Receipt';
import GavelIcon from '@mui/icons-material/Gavel';
import ArticleIcon from '@mui/icons-material/Article';
import ChatIcon from '@mui/icons-material/Chat';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import HistoryIcon from '@mui/icons-material/History';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import { useTranslation } from 'react-i18next';
import PortalLayout, { NavItem } from './PortalLayout';
import { useAuthStore } from '../stores/authStore';

export default function DisponentLayout() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'agency_admin';

  const navItems: NavItem[] = [
    { label: t('nav.dashboard'), icon: <DashboardIcon />, path: '/app/dashboard' },
    { label: t('nav.workers'), icon: <PeopleIcon />, path: '/app/workers' },
    { label: t('nav.businesses'), icon: <BusinessIcon />, path: '/app/businesses' },
    { label: t('nav.shifts'), icon: <CalendarMonthIcon />, path: '/app/shifts' },
    { label: t('nav.timesheets'), icon: <AccessTimeIcon />, path: '/app/timesheets' },
    { label: t('nav.invoices'), icon: <ReceiptIcon />, path: '/app/invoices' },
    { label: t('nav.contracts'), icon: <ArticleIcon />, path: '/app/contracts' },
    { label: t('nav.attendance'), icon: <HowToRegIcon />, path: '/app/attendance' },
    { label: t('nav.compliance'), icon: <GavelIcon />, path: '/app/compliance' },
    { label: t('nav.messages'), icon: <ChatIcon />, path: '/app/messages' },
    ...(isAdmin ? [
      { label: t('nav.staff'), icon: <ManageAccountsIcon />, path: '/app/staff', dividerBefore: true },
      { label: t('nav.reports'), icon: <BarChartIcon />, path: '/app/reports' },
      { label: t('nav.subscription'), icon: <CreditCardIcon />, path: '/app/subscription' },
      { label: t('nav.auditLog'), icon: <HistoryIcon />, path: '/app/audit-log' },
      { label: t('nav.settings'), icon: <SettingsIcon />, path: '/app/settings/agency' },
    ] : []),
  ];

  return (
    <PortalLayout
      title={isAdmin ? t('portal.agencyAdmin.title') : t('portal.disponent.title')}
      navItems={navItems}
      showNotifications
    />
  );
}
