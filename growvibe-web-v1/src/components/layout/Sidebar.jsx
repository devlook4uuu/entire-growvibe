import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { logoutThunk } from '../../store/authSlice';
import { clearRole } from '../../store/roleSlice';
import { sidebarConfig } from '../../data/sidebarConfig';
import Logout from '../../assets/icons/Logout';
import Attendence from '../../assets/icons/Attendence';

const ROLE_LABELS = {
  admin:       'Admin',
  owner:       'School Owner',
  principal:   'Principal',
  coordinator: 'Coordinator',
  teacher:     'Teacher',
  student:     'Student',
};

export default function Sidebar({ onCloseMobile }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { currentRole } = useSelector((s) => s.role);
  const { profile } = useSelector((s) => s.auth);

  const [hoveredNav, setHoveredNav] = useState(null);
  const [logoutHovered, setLogoutHovered] = useState(false);

  const baseNavItems = sidebarConfig[currentRole] || [];
  // Teacher: inject Student Attendance link if they have a class assigned
  const navItems = currentRole === 'teacher' && profile?.class_id
    ? [
        ...baseNavItems,
        {
          label: 'Student Attendance',
          icon: Attendence,
          path: `/student-attendance?classId=${profile.class_id}&className=My+Class`,
        },
      ]
    : baseNavItems;
  const label = ROLE_LABELS[currentRole] || currentRole;
  const name = profile?.name || '';
  const initial = name.charAt(0).toUpperCase() || '?';

  const handleNav = (path) => {
    navigate(path);
    onCloseMobile?.();
  };

  function isActive(itemPath) {
    const [pathname, search] = itemPath.split('?');
    if (location.pathname !== pathname) return false;
    if (!search) return true;
    return location.search === `?${search}`;
  }

  const handleLogout = async () => {
    await dispatch(logoutThunk());
    dispatch(clearRole());
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Logo row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        height: 64, flexShrink: 0,
        borderBottom: '1px solid #E2E8F0',
        padding: '0 16px',
      }}>
        <div style={{
          width: 36, height: 36, flexShrink: 0,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #1CACF3 0%, #0E8AD4 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>GV</span>
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1D21', letterSpacing: '-0.2px' }}>
          GrowVibe
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 2, listStyle: 'none', padding: 0, margin: 0 }}>
          {navItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            const hovered = hoveredNav === item.path;
            return (
              <li key={item.path}>
                <button
                  onClick={() => handleNav(item.path)}
                  onMouseEnter={() => setHoveredNav(item.path)}
                  onMouseLeave={() => setHoveredNav(null)}
                  style={{
                    display: 'flex', width: '100%', alignItems: 'center', gap: 12,
                    borderRadius: 10, padding: '10px 12px',
                    fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
                    backgroundColor: active ? '#1CACF3' : hovered ? '#F1F5F9' : 'transparent',
                    color: active ? '#fff' : hovered ? '#1A1D21' : '#64748B',
                    transition: 'background-color 0.15s, color 0.15s',
                  }}
                >
                  <Icon size={18} color="currentColor" strokeWidth={active ? 2 : 1.5} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div style={{ flexShrink: 0, borderTop: '1px solid #E2E8F0', padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, flexShrink: 0,
            borderRadius: '50%',
            backgroundColor: '#E8F6FE',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 600, color: '#1CACF3',
          }}>
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1D21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
              {name}
            </p>
            <p style={{ fontSize: 11, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
              {label}
            </p>
          </div>
          <button
            onClick={handleLogout}
            onMouseEnter={() => setLogoutHovered(true)}
            onMouseLeave={() => setLogoutHovered(false)}
            title="Logout"
            style={{
              borderRadius: 8, padding: 6, border: 'none', cursor: 'pointer',
              backgroundColor: logoutHovered ? '#FEF2F2' : 'transparent',
              color: logoutHovered ? '#EF4444' : '#94A3B8',
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            <Logout size={16} color="currentColor" strokeWidth={1.5} />
          </button>
        </div>
      </div>

    </div>
  );
}
