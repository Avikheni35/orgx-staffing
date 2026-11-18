import DashboardIcon from '@mui/icons-material/Dashboard';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ReceiptIcon from '@mui/icons-material/Receipt';
import { useTranslation } from 'react-i18next';
import PortalLayout from './PortalLayout';

export default function BusinessLayout() {
  const { t } = useTranslation();
  return (
    <PortalLayout
      title={t('portal.business.title')}
      navItems={[
        { label: t('nav.dashboard'), icon: <DashboardIcon />, path: '/client/dashboard' },
        { label: 'Schichten', icon: <CalendarMonthIcon />, path: '/client/shifts' },
        { label: t('nav.invoices'), icon: <ReceiptIcon />, path: '/client/invoices' },
      ]}
    />
  );
}
