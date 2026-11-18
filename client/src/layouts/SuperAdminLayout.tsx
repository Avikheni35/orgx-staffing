import DashboardIcon from '@mui/icons-material/Dashboard';
import BusinessIcon from '@mui/icons-material/Business';
import PaymentIcon from '@mui/icons-material/Payment';
import SettingsIcon from '@mui/icons-material/Settings';
import ArticleIcon from '@mui/icons-material/Article';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import { useTranslation } from 'react-i18next';
import PortalLayout from './PortalLayout';

export default function SuperAdminLayout() {
  const { t } = useTranslation();
  return (
    <PortalLayout
      title={t('portal.superAdmin.title')}
      navItems={[
        { label: t('nav.dashboard'), icon: <DashboardIcon />, path: '/superadmin/dashboard' },
        { label: 'Tenants', icon: <BusinessIcon />, path: '/superadmin/tenants' },
        { label: 'Billing', icon: <PaymentIcon />, path: '/superadmin/billing' },
        { label: 'Templates', icon: <ArticleIcon />, path: '/superadmin/templates' },
        { label: 'Monitor', icon: <MonitorHeartIcon />, path: '/superadmin/monitor' },
        { label: t('nav.settings'), icon: <SettingsIcon />, path: '/superadmin/settings' },
      ]}
    />
  );
}
