import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { supabase } from '../../lib/supabase';
import { setSelectedBranch, setSelectedSession } from '../../store/appSlice';
import Sidebar from './Sidebar';
import Header from './Header';

// ─── Silently boots branch + session context if missing ──────────────────────
// Runs once per app load. If both IDs already exist in Redux (restored from
// localStorage), this is a no-op. Otherwise it fetches and auto-selects.
function AppContextBootstrap() {
  const dispatch   = useDispatch();
  const profile    = useSelector((s) => s.auth.profile);
  const { selectedBranchId, selectedSessionId } = useSelector((s) => s.app);

  useEffect(() => {
    if (!profile?.school_id) return;
    if (selectedBranchId && selectedSessionId) return; // already set

    (async () => {
      let branchId = selectedBranchId;

      if (!branchId) {
        const { data: branches } = await supabase
          .from('branches')
          .select('id')
          .eq('school_id', profile.school_id)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1);

        branchId = branches?.[0]?.id ?? null;
        if (branchId) dispatch(setSelectedBranch(branchId));
      }

      if (branchId && !selectedSessionId) {
        const { data: sessions } = await supabase
          .from('sessions')
          .select('id, is_active')
          .eq('branch_id', branchId)
          .eq('school_id', profile.school_id)
          .order('session_start', { ascending: false });

        const active = sessions?.find((s) => s.is_active) ?? sessions?.[0] ?? null;
        if (active) dispatch(setSelectedSession(active.id));
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.school_id]);

  return null;
}

export default function DashboardLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  // Track window width to show/hide desktop sidebar
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close mobile sidebar when switching to desktop
  useEffect(() => {
    if (isDesktop) setMobileOpen(false);
  }, [isDesktop]);

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#F5F7FA', overflow: 'hidden' }}>
      <AppContextBootstrap />

      {/* Mobile backdrop */}
      {mobileOpen && !isDesktop && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            backgroundColor: 'rgba(0,0,0,0.35)',
          }}
        />
      )}

      {/* Desktop sidebar — only rendered on lg+ */}
      {isDesktop && (
        <aside style={{
          width: 256, flexShrink: 0,
          backgroundColor: '#fff',
          borderRight: '1px solid #E2E8F0',
          display: 'flex', flexDirection: 'column',
          height: '100vh',
        }}>
          <Sidebar />
        </aside>
      )}

      {/* Mobile sidebar overlay */}
      {!isDesktop && (
        <aside style={{
          position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 50,
          width: 256,
          backgroundColor: '#fff',
          borderRight: '1px solid #E2E8F0',
          display: 'flex', flexDirection: 'column',
          boxShadow: '4px 0 24px rgba(0,0,0,0.14)',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.28s cubic-bezier(.4,0,.2,1)',
        }}>
          <Sidebar onCloseMobile={() => setMobileOpen(false)} />
        </aside>
      )}

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Top navbar */}
        <header style={{
          height: 64, flexShrink: 0,
          backgroundColor: '#fff',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center',
          paddingLeft: 20, paddingRight: 20,
        }}>
          <Header
            onOpenMobile={() => setMobileOpen(true)}
            showMobileMenu={!isDesktop}
          />
        </header>

        {/* Scrollable content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: isDesktop ? 24 : 16 }}>
          {children}
        </main>

      </div>
    </div>
  );
}
