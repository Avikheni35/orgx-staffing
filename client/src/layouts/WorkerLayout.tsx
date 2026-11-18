import HomeIcon from '@mui/icons-material/Home';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import NotificationsIcon from '@mui/icons-material/Notifications';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArticleIcon from '@mui/icons-material/Article';
import FolderIcon from '@mui/icons-material/Folder';
import PersonIcon from '@mui/icons-material/Person';
import ChatIcon from '@mui/icons-material/Chat';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import { useTranslation } from 'react-i18next';
import PortalLayout from './PortalLayout';

export default function WorkerLayout() {
  const { t } = useTranslation();
  return (
    <PortalLayout
      title={t('portal.worker.title')}
      navItems={[
        { label: t('nav.dashboard'), icon: <HomeIcon />, path: '/worker/home' },
        { label: 'Angebote', icon: <LocalOfferIcon />, path: '/worker/offers' },
        { label: t('workerPortal.shiftOffers'), icon: <NotificationsIcon />, path: '/worker/available-shifts' },
        { label: t('workerPortal.myShifts'), icon: <CalendarMonthIcon />, path: '/worker/shifts' },
        { label: t('nav.timesheets'), icon: <AccessTimeIcon />, path: '/worker/timesheets' },
        { label: t('contract.myContracts'), icon: <ArticleIcon />, path: '/worker/contracts' },
        { label: t('availability.title'), icon: <EventAvailableIcon />, path: '/worker/availability' },
        { label: 'Dokumente', icon: <FolderIcon />, path: '/worker/documents' },
        { label: t('nav.messages'), icon: <ChatIcon />, path: '/worker/messages' },
        { label: t('nav.profile'), icon: <PersonIcon />, path: '/worker/profile' },
      ]}
    />
  );
}
