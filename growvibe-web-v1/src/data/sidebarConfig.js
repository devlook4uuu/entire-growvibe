import Dashboard from '../assets/icons/Dashboard';
import School from '../assets/icons/School';
import Users from '../assets/icons/Users';
import Calendar from '../assets/icons/Calendar';
import Profile from '../assets/icons/Profile';
import Receipt from '../assets/icons/Receipt';
import Ticket from '../assets/icons/Ticket';
import Diary from '../assets/icons/Diary';
import Banner from '../assets/icons/Banner';

export const sidebarConfig = {
  admin: [
    { label: 'Dashboard',  icon: Dashboard, path: '/dashboard' },
    { label: 'Owners',     icon: Users,     path: '/owners' },
    { label: 'Schools',    icon: School,    path: '/schools' },
    { label: 'Banners',    icon: Banner,    path: '/banners' },
    { label: 'Support',    icon: Ticket,    path: '/support' },
  ],
  owner: [
    { label: 'Dashboard',     icon: Dashboard, path: '/dashboard' },
    { label: 'Sessions',      icon: Calendar,  path: '/sessions' },
    { label: 'Classes',       icon: School,    path: '/classes' },
    { label: 'Principal',     icon: Users,     path: '/staff?role=principal' },
    { label: 'Coordinator',   icon: Users,     path: '/staff?role=coordinator' },
    { label: 'Teachers',      icon: Users,     path: '/staff?role=teacher' },
    { label: 'Fee Receipts',  icon: Receipt,   path: '/fee-receipts' },
    { label: 'Support',       icon: Ticket,    path: '/support' },
  ],
  principal: [
    { label: 'Dashboard',    icon: Dashboard, path: '/dashboard' },
    { label: 'Classes',      icon: School,    path: '/classes' },
    { label: 'Teachers',     icon: Users,     path: '/staff?role=teacher' },
    { label: 'Fee Receipts', icon: Receipt,   path: '/fee-receipts' },
    { label: 'Support',      icon: Ticket,    path: '/support' },
  ],
  coordinator: [
    { label: 'Dashboard',    icon: Dashboard, path: '/dashboard' },
    { label: 'Classes',      icon: School,    path: '/classes' },
    { label: 'Fee Receipts', icon: Receipt,   path: '/fee-receipts' },
    { label: 'Support',      icon: Ticket,    path: '/support' },
  ],
  teacher: [
    { label: 'Dashboard',   icon: Dashboard, path: '/dashboard' },
    { label: 'Class Diary', icon: Diary,     path: '/diary' },
    { label: 'My Profile',  icon: Profile,   path: '/profile' },
    { label: 'Support',     icon: Ticket,    path: '/support' },
  ],
  student: [
    { label: 'Dashboard',  icon: Dashboard, path: '/dashboard' },
    { label: 'My Profile', icon: Profile,   path: '/profile' },
    { label: 'Support',    icon: Ticket,    path: '/support' },
  ],
};
