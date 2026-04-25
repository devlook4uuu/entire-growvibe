import { useState } from 'react';
import { useSelector } from 'react-redux';
import Search from '../../assets/icons/Search';
import NotificationBell from '../../assets/icons/NotificationBell';
import Menu from '../../assets/icons/Menu';

export default function Header({ onOpenMobile, showMobileMenu }) {
  const { profile } = useSelector((s) => s.auth);
  const name = profile?.name || '';
  const [bellHovered, setBellHovered] = useState(false);
  const [avatarHovered, setAvatarHovered] = useState(false);
  const [menuHovered, setMenuHovered] = useState(false);
  // Hide search on very small screens (< 400px) to avoid overflow
  const [isVerySmall, setIsVerySmall] = useState(window.innerWidth < 400);
  useState(() => {
    const onResize = () => setIsVerySmall(window.innerWidth < 400);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minWidth: 0 }}>

      {/* Left — hamburger + search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        {showMobileMenu && (
          <button
            onClick={onOpenMobile}
            onMouseEnter={() => setMenuHovered(true)}
            onMouseLeave={() => setMenuHovered(false)}
            aria-label="Open menu"
            style={{
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
              backgroundColor: menuHovered ? '#F1F5F9' : 'transparent',
              color: menuHovered ? '#1A1D21' : '#94A3B8',
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            <Menu size={20} color="currentColor" strokeWidth={1.5} />
          </button>
        )}

        {/* Search — hidden on very small screens */}
        {!isVerySmall && (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, maxWidth: 280 }}>
            <div style={{ position: 'absolute', left: 10, pointerEvents: 'none' }}>
              <Search size={15} color="#94A3B8" strokeWidth={1.5} />
            </div>
            <input
              type="text"
              placeholder="Search anything…"
              style={{
                height: 36, width: '100%', borderRadius: 10,
                border: '1px solid #E2E8F0', backgroundColor: '#F5F7FA',
                paddingLeft: 34, paddingRight: 14,
                fontSize: 13, color: '#1A1D21', outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#1CACF3';
                e.target.style.backgroundColor = '#fff';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#E2E8F0';
                e.target.style.backgroundColor = '#F5F7FA';
              }}
            />
          </div>
        )}
      </div>

      {/* Right — bell + avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>

        <button
          onMouseEnter={() => setBellHovered(true)}
          onMouseLeave={() => setBellHovered(false)}
          style={{
            position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
            backgroundColor: bellHovered ? '#F1F5F9' : 'transparent',
            color: bellHovered ? '#1A1D21' : '#94A3B8',
            transition: 'background-color 0.15s, color 0.15s',
          }}
        >
          <NotificationBell size={20} color="currentColor" strokeWidth={1.5} />
          <span style={{
            position: 'absolute', top: 8, right: 8,
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: '#EF4444', border: '2px solid #fff',
          }} />
        </button>

        <div style={{ width: 1, height: 22, backgroundColor: '#E2E8F0', margin: '0 2px' }} />

        <button
          onMouseEnter={() => setAvatarHovered(true)}
          onMouseLeave={() => setAvatarHovered(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            borderRadius: 10, padding: '5px 8px', border: 'none', cursor: 'pointer',
            backgroundColor: avatarHovered ? '#F1F5F9' : 'transparent',
            transition: 'background-color 0.15s',
          }}
        >
          <div style={{
            width: 30, height: 30, flexShrink: 0, borderRadius: '50%',
            backgroundColor: '#E8F6FE',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 600, color: '#1CACF3',
          }}>
            {name.charAt(0).toUpperCase() || '?'}
          </div>
          {/* Hide name text on mobile to save space */}
          {!showMobileMenu && (
            <span style={{
              fontSize: 13, fontWeight: 500, color: '#1A1D21',
              maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {name}
            </span>
          )}
        </button>

      </div>
    </div>
  );
}
