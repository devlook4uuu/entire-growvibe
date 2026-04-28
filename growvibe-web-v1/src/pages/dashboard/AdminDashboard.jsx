import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import School  from '../../assets/icons/School';
import Users   from '../../assets/icons/Users';
import Ticket  from '../../assets/icons/Ticket';
import Plus    from '../../assets/icons/Plus';
import BannerCarousel from '../../components/shared/BannerCarousel';

// ── Shared design tokens ───────────────────────────────────────
export const C = {
  white:      '#FFFFFF',
  canvas:     '#F5F7FA',
  border:     '#E2E8F0',
  borderLight:'#F1F5F9',
  ink:        '#1A1D21',
  soft:       '#64748B',
  muted:      '#94A3B8',
  blue:       '#3B82F6',
  blueBg:     '#EFF6FF',
  green:      '#22C55E',
  greenBg:    '#ECFDF5',
  yellow:     '#F59E0B',
  yellowBg:   '#FFFBEB',
  red:        '#EF4444',
  redBg:      '#FEF2F2',
  purple:     '#8B5CF6',
  purpleBg:   '#F5F3FF',
  sky:        '#0EA5E9',
  skyBg:      '#F0F9FF',
  orange:     '#F97316',
  orangeBg:   '#FFF7ED',
};

export const STATUS_COLORS = {
  Pending:    { color: '#B45309', background: '#FFFBEB' },
  Processing: { color: '#1D4ED8', background: '#EFF6FF' },
  Shipped:    { color: '#15803D', background: '#ECFDF5' },
  Delivered:  { color: '#15803D', background: '#ECFDF5' },
  Closed:     { color: '#4B5563', background: '#F3F4F6' },
  Open:       { color: '#DC2626', background: '#FEF2F2' },
  Active:     { color: '#15803D', background: '#ECFDF5' },
  Inactive:   { color: '#4B5563', background: '#F3F4F6' },
  Submitted:  { color: '#15803D', background: '#ECFDF5' },
  Marked:     { color: '#15803D', background: '#ECFDF5' },
  Missing:    { color: '#DC2626', background: '#FEF2F2' },
  Paid:       { color: '#15803D', background: '#ECFDF5' },
  Unpaid:     { color: '#DC2626', background: '#FEF2F2' },
  Review:     { color: '#B45309', background: '#FFFBEB' },
  Pending2:   { color: '#B45309', background: '#FFFBEB' },
};

export const fmtPKR = (n) => `PKR ${(n / 1000).toFixed(0)}K`;
export const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

// ── Reusable components ────────────────────────────────────────

export function Card({ children, style }) {
  return (
    <div style={{
      backgroundColor: C.white, borderRadius: 14,
      border: `1px solid ${C.border}`, padding: 20, ...style,
    }}>
      {children}
    </div>
  );
}

export function CardHeader({ title, action, onAction }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: C.ink, margin: 0 }}>{title}</h3>
      {action && (
        <button
          onClick={onAction}
          onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
          style={{
            fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
            backgroundColor: 'transparent', color: hov ? '#1D4ED8' : C.blue,
            transition: 'color 0.15s', padding: 0,
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}

export function Badge({ status }) {
  const s = STATUS_COLORS[cap(status)] || { color: C.soft, background: C.canvas };
  return (
    <span style={{
      display: 'inline-flex', padding: '2px 8px', borderRadius: 999,
      fontSize: 11, fontWeight: 500, color: s.color,
      backgroundColor: s.background, whiteSpace: 'nowrap',
    }}>
      {cap(status)}
    </span>
  );
}

export function ActionBtn({ icon: Icon, label, primary, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        borderRadius: 10, padding: '8px 14px',
        fontSize: 13, fontWeight: 500, cursor: 'pointer',
        backgroundColor: primary ? (hov ? '#2563EB' : C.blue) : (hov ? '#F1F5F9' : C.white),
        color: primary ? '#fff' : C.ink,
        border: primary ? 'none' : `1px solid ${C.border}`,
        transition: 'background-color 0.15s',
      }}
    >
      {Icon && <Icon size={15} color="currentColor" strokeWidth={primary ? 2 : 1.5} />}
      {label}
    </button>
  );
}

// Responsive grid hook
export function useBreakpoint() {
  function calc(w) {
    return w >= 1536 ? '2xl' : w >= 1280 ? 'xl' : w >= 1024 ? 'lg' : w >= 640 ? 'sm' : 'xs';
  }
  const [bp, setBp] = useState(() => calc(window.innerWidth));
  useEffect(() => {
    const update = () => setBp(calc(window.innerWidth));
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return bp;
}

// ── Stat card ──────────────────────────────────────────────────
export function StatCard({ icon: Icon, iconColor, iconBg, title, value, badge, badgeColor, loading }) {
  return (
    <Card style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          backgroundColor: iconBg || C.blueBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {Icon && <Icon size={20} color={iconColor || C.blue} strokeWidth={1.6} />}
        </div>
        {badge && (
          <span style={{
            fontSize: 11, fontWeight: 500,
            color: badgeColor?.text || C.green,
            backgroundColor: badgeColor?.bg || C.greenBg,
            padding: '2px 8px', borderRadius: 999,
          }}>
            {badge}
          </span>
        )}
      </div>
      {loading ? (
        <>
          <div style={{ height: 28, width: '50%', borderRadius: 6, backgroundColor: C.borderLight, marginBottom: 6 }} />
          <div style={{ height: 14, width: '70%', borderRadius: 6, backgroundColor: C.borderLight }} />
        </>
      ) : (
        <>
          <p style={{ fontSize: 24, fontWeight: 700, color: C.ink, margin: 0 }}>{value}</p>
          <p style={{ fontSize: 13, color: C.soft, marginTop: 2, marginBottom: 0 }}>{title}</p>
        </>
      )}
    </Card>
  );
}

// ── Grid helpers ───────────────────────────────────────────────
export function StatsGrid({ children, cols }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 16, marginBottom: 20,
    }}>
      {children}
    </div>
  );
}

export function TwoColGrid({ children, style }) {
  const bp = useBreakpoint();
  const cols = (bp === 'xs' || bp === 'sm') ? '1fr' : '1fr 1fr';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 16, ...style }}>
      {children}
    </div>
  );
}

export function SingleCol({ children, style }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, ...style }}>
      {children}
    </div>
  );
}

// ── Page header ────────────────────────────────────────────────
export function PageHeader({ greeting, subtitle, actions }) {
  const bp = useBreakpoint();
  return (
    <div style={{
      display: 'flex',
      flexDirection: bp === 'xs' ? 'column' : 'row',
      alignItems: bp === 'xs' ? 'flex-start' : 'flex-start',
      justifyContent: 'space-between',
      gap: 12, marginBottom: 20,
    }}>
      <div>
        <h1 style={{ fontSize: bp === 'xs' ? 20 : 24, fontWeight: 700, color: C.ink, margin: 0 }}>
          {greeting}
        </h1>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 4, marginBottom: 0 }}>{subtitle}</p>
      </div>
      {actions && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  );
}

// ── HoverRow helper ────────────────────────────────────────────
function HoverRow({ children, style }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ ...style, backgroundColor: hov ? '#F8FAFC' : 'transparent', transition: 'background-color 0.15s' }}
    >
      {children}
    </div>
  );
}

// ── AdminDashboard ─────────────────────────────────────────────
export default function AdminDashboard() {
  const bp       = useBreakpoint();
  const navigate = useNavigate();
  const today    = new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const isLarge   = bp === 'lg' || bp === 'xl' || bp === '2xl';
  const statCols  = isLarge ? 3 : bp === 'sm' ? 2 : 1;
  const useTwoCol = isLarge;

  // ── Stats ────────────────────────────────────────────────────
  const [stats, setStats] = useState(null); // null = loading

  useEffect(() => {
    async function load() {
      const [
        { count: totalSchools },
        { count: activeSchools },
        { count: totalStudents },
        { count: openTickets },
      ] = await Promise.all([
        supabase.from('schools').select('id', { count: 'exact', head: true }),
        supabase.from('schools').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('is_active', true),
        supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      ]);
      setStats({
        totalSchools:  totalSchools  ?? 0,
        activeSchools: activeSchools ?? 0,
        totalStudents: totalStudents ?? 0,
        openTickets:   openTickets   ?? 0,
      });
    }
    load();
  }, []);

  // ── Schools list ─────────────────────────────────────────────
  const [schools, setSchools] = useState(null); // null = loading

  useEffect(() => {
    async function load() {
      const { data: schoolRows } = await supabase
        .from('schools')
        .select('id, name, is_active')
        .order('name', { ascending: true })
        .limit(10);

      if (!schoolRows?.length) { setSchools([]); return; }

      const studentCounts = await Promise.all(
        schoolRows.map((s) =>
          supabase.from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('school_id', s.id)
            .eq('role', 'student')
            .eq('is_active', true)
            .then(({ count }) => ({ id: s.id, count: count ?? 0 }))
        )
      );
      const countMap = Object.fromEntries(studentCounts.map((r) => [r.id, r.count]));
      setSchools(schoolRows.map((s) => ({ ...s, studentCount: countMap[s.id] ?? 0 })));
    }
    load();
  }, []);

  // ── Open support tickets ──────────────────────────────────────
  const [tickets, setTickets] = useState(null);

  useEffect(() => {
    supabase
      .from('support_tickets')
      .select('id, title, role, priority, status, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(8)
      .then(({ data }) => setTickets(data ?? []));
  }, []);

  function fmtAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <div>
      <PageHeader
        greeting="Platform Overview"
        subtitle={today}
        actions={
          <ActionBtn icon={Plus} label="Create School" primary onClick={() => navigate('/schools')} />
        }
      />

      <BannerCarousel />

      {/* Stat cards */}
      <StatsGrid cols={statCols}>
        <StatCard
          icon={School} iconColor={C.blue} iconBg={C.blueBg}
          title="Total Schools"
          value={stats?.totalSchools ?? '—'}
          badge={stats ? `${stats.activeSchools} active` : '…'}
          badgeColor={{ text: C.green, bg: C.greenBg }}
          loading={!stats}
        />
        <StatCard
          icon={Users} iconColor={C.purple} iconBg={C.purpleBg}
          title="Total Students"
          value={stats ? stats.totalStudents.toLocaleString() : '—'}
          badge="all schools"
          badgeColor={{ text: C.purple, bg: C.purpleBg }}
          loading={!stats}
        />
        <StatCard
          icon={Ticket} iconColor={C.red} iconBg={C.redBg}
          title="Open Support Tickets"
          value={stats?.openTickets ?? '—'}
          badge={stats?.openTickets > 0 ? 'needs attention' : 'all clear'}
          badgeColor={stats?.openTickets > 0
            ? { text: C.red, bg: C.redBg }
            : { text: C.green, bg: C.greenBg }}
          loading={!stats}
        />
      </StatsGrid>

      {/* Bottom row */}
      {useTwoCol ? (
        <TwoColGrid>
          <SupportTicketsCard tickets={tickets} fmtAgo={fmtAgo} navigate={navigate} />
          <SchoolsStatusCard schools={schools} navigate={navigate} />
        </TwoColGrid>
      ) : (
        <SingleCol>
          <SupportTicketsCard tickets={tickets} fmtAgo={fmtAgo} navigate={navigate} />
          <SchoolsStatusCard schools={schools} navigate={navigate} />
        </SingleCol>
      )}
    </div>
  );
}

function SupportTicketsCard({ tickets, fmtAgo, navigate }) {
  return (
    <Card>
      <CardHeader title="Open Support Tickets" action="View All" onAction={() => navigate('/support')} />
      {tickets === null ? (
        <SkeletonRows count={5} />
      ) : tickets.length === 0 ? (
        <EmptyMsg text="No open tickets" />
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {tickets.map((t) => (
            <li key={t.id}>
              <HoverRow style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                borderRadius: 8, padding: '9px 10px',
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: C.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                  <p style={{ fontSize: 11, color: C.muted, margin: '2px 0 0' }}>
                    {t.role} · {fmtAgo(t.created_at)}
                    {t.priority === 'high' && <span style={{ marginLeft: 6, fontWeight: 700, color: C.red }}>High</span>}
                  </p>
                </div>
                <Badge status={t.status} />
              </HoverRow>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SchoolsStatusCard({ schools, navigate }) {
  const bp       = useBreakpoint();
  const isMobile = bp === 'xs';
  return (
    <Card>
      <CardHeader title="Schools" action="View All" onAction={() => navigate('/schools')} />
      {schools === null ? (
        <SkeletonRows count={6} />
      ) : schools.length === 0 ? (
        <EmptyMsg text="No schools yet" />
      ) : (
        <>
          {!isMobile && (
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8,
              fontSize: 10, fontWeight: 500, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.02em',
              marginBottom: 6, padding: '0 8px',
            }}>
              <span>School</span><span>Students</span><span>Status</span>
            </div>
          )}
          {schools.map((s, i) => (
            isMobile ? (
              <div key={s.id} style={{ padding: '10px 8px', borderBottom: i < schools.length - 1 ? `1px solid ${C.borderLight}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{s.name}</span>
                  <Badge status={s.is_active ? 'active' : 'inactive'} />
                </div>
                <span style={{ fontSize: 11, color: C.soft }}>{s.studentCount.toLocaleString()} students</span>
              </div>
            ) : (
              <HoverRow key={s.id} style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8,
                alignItems: 'center', padding: '9px 8px', borderRadius: 8,
                borderBottom: i < schools.length - 1 ? `1px solid ${C.borderLight}` : 'none',
                fontSize: 13,
              }}>
                <span style={{ fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                <span style={{ color: C.soft }}>{s.studentCount.toLocaleString()}</span>
                <Badge status={s.is_active ? 'active' : 'inactive'} />
              </HoverRow>
            )
          ))}
        </>
      )}
    </Card>
  );
}

// ── Shared skeleton / empty helpers ───────────────────────────
function SkeletonRows({ count = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ height: 36, borderRadius: 8, backgroundColor: C.borderLight }} />
      ))}
    </div>
  );
}

function EmptyMsg({ text }) {
  return <p style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '20px 0', margin: 0 }}>{text}</p>;
}
