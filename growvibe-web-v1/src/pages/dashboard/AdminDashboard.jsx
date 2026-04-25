import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import School   from '../../assets/icons/School';
import Users    from '../../assets/icons/Users';
import Money    from '../../assets/icons/Money';
import Store    from '../../assets/icons/Store';
import Plus     from '../../assets/icons/Plus';
import Calendar from '../../assets/icons/Calendar';
import Order    from '../../assets/icons/Order';
import { adminData } from '../../data/mockData';
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

export function CardHeader({ title, action }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: C.ink, margin: 0 }}>{title}</h3>
      {action && (
        <button
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
export function StatCard({ icon: Icon, iconColor, iconBg, title, value, badge, badgeColor }) {
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
      <p style={{ fontSize: 24, fontWeight: 700, color: C.ink, margin: 0 }}>{value}</p>
      <p style={{ fontSize: 13, color: C.soft, marginTop: 2, marginBottom: 0 }}>{title}</p>
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

// ── Admin-specific row components ──────────────────────────────
function OrderRow({ order, isMobile }) {
  const [hov, setHov] = useState(false);
  if (isMobile) {
    return (
      <div
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ padding: '10px 8px', borderRadius: 8, backgroundColor: hov ? '#F8FAFC' : 'transparent', transition: 'background-color 0.15s', borderBottom: `1px solid ${C.borderLight}` }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{order.student}</span>
          <Badge status={order.status} />
        </div>
        <span style={{ fontSize: 11, color: C.soft }}>{order.school} · {order.product} · {order.paymentType}</span>
      </div>
    );
  }
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8,
        alignItems: 'center', padding: '9px 8px', borderRadius: 8,
        backgroundColor: hov ? '#F8FAFC' : 'transparent',
        transition: 'background-color 0.15s', fontSize: 13,
      }}
    >
      <span style={{ fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.student}</span>
      <span style={{ color: C.soft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.school}</span>
      <span style={{ color: C.soft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.product}</span>
      <span style={{ color: C.soft }}>{order.paymentType}</span>
      <Badge status={order.status} />
    </div>
  );
}

function TicketRow({ ticket }) {
  const [hov, setHov] = useState(false);
  return (
    <li
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        borderRadius: 8, padding: '9px 10px', listStyle: 'none',
        backgroundColor: hov ? '#F8FAFC' : 'transparent', transition: 'background-color 0.15s',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: C.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.subject}</p>
        <p style={{ fontSize: 11, color: C.muted, margin: '2px 0 0' }}>{ticket.school} · {ticket.timeAgo}</p>
      </div>
      <Badge status={ticket.status} />
    </li>
  );
}

function SchoolRow({ school, last, isMobile }) {
  const [hov, setHov] = useState(false);
  if (isMobile) {
    return (
      <div
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ padding: '10px 8px', borderBottom: last ? 'none' : `1px solid ${C.borderLight}`, backgroundColor: hov ? '#F8FAFC' : 'transparent', transition: 'background-color 0.15s' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{school.name}</span>
          <Badge status={school.status} />
        </div>
        <span style={{ fontSize: 11, color: C.soft }}>{school.city} · {school.students.toLocaleString()} students</span>
      </div>
    );
  }
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8,
        alignItems: 'center', padding: '9px 8px',
        borderBottom: last ? 'none' : `1px solid ${C.borderLight}`,
        backgroundColor: hov ? '#F8FAFC' : 'transparent',
        transition: 'background-color 0.15s', fontSize: 13,
      }}
    >
      <span style={{ fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{school.name}</span>
      <span style={{ color: C.soft }}>{school.city}</span>
      <span style={{ color: C.soft }}>{school.students.toLocaleString()}</span>
      <Badge status={school.status} />
    </div>
  );
}

// ── AdminDashboard ─────────────────────────────────────────────
export default function AdminDashboard() {
  const bp = useBreakpoint();
  const { stats, pendingOrders, revenueChart, supportTickets, schoolsStatus } = adminData;
  const lastBar = revenueChart[revenueChart.length - 1];
  const revenueProgress = Math.round((lastBar.revenue / lastBar.target) * 100);
  const today = new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const isLarge   = bp === 'lg' || bp === 'xl' || bp === '2xl';
  const statCols  = isLarge ? 4 : bp === 'sm' ? 2 : 1;
  const useTwoCol = isLarge;

  return (
    <div>
      <PageHeader
        greeting="Good morning, Abdullah 👋"
        subtitle={`${today} · Platform Overview`}
        actions={<>
          <ActionBtn icon={Plus}     label="Create School" />
          <ActionBtn icon={Calendar} label="Close Delivery Week" />
          <ActionBtn icon={Order}    label="View All Orders" primary />
        </>}
      />

      <BannerCarousel />

      {/* Stat cards */}
      <StatsGrid cols={statCols}>
        <StatCard icon={School} iconColor={C.blue}   iconBg={C.blueBg}   title="Total Schools"  value={stats.totalSchools.count}                         badge={`${stats.totalSchools.active} active`}            badgeColor={{ text: C.green,  bg: C.greenBg }} />
        <StatCard icon={Users}  iconColor={C.purple} iconBg={C.purpleBg} title="Total Students" value={stats.totalStudents.count.toLocaleString()}        badge="all schools"                                      badgeColor={{ text: C.purple, bg: C.purpleBg }} />
        <StatCard icon={Money}  iconColor={C.sky}    iconBg={C.skyBg}    title="SaaS Revenue"   value={fmtPKR(stats.saasRevenue.amount)}                  badge={`${stats.saasRevenue.schools} schools`}           badgeColor={{ text: C.sky,    bg: C.skyBg }} />
        <StatCard icon={Store}  iconColor={C.green}  iconBg={C.greenBg}  title="Store Revenue"  value={fmtPKR(stats.storeRevenue.amount)}                 badge={`${stats.storeRevenue.pendingOrders} pending`}    badgeColor={{ text: C.yellow, bg: C.yellowBg }} />
      </StatsGrid>

      {/* Middle row */}
      {useTwoCol ? (
        <TwoColGrid style={{ marginBottom: 16 }}>
          <PendingOrdersCard orders={pendingOrders} />
          <RevenueChartCard revenueChart={revenueChart} revenueProgress={revenueProgress} />
        </TwoColGrid>
      ) : (
        <SingleCol style={{ marginBottom: 16 }}>
          <PendingOrdersCard orders={pendingOrders} />
          <RevenueChartCard revenueChart={revenueChart} revenueProgress={revenueProgress} />
        </SingleCol>
      )}

      {/* Bottom row */}
      {useTwoCol ? (
        <TwoColGrid>
          <SupportTicketsCard tickets={supportTickets} />
          <SchoolsStatusCard schools={schoolsStatus} />
        </TwoColGrid>
      ) : (
        <SingleCol>
          <SupportTicketsCard tickets={supportTickets} />
          <SchoolsStatusCard schools={schoolsStatus} />
        </SingleCol>
      )}
    </div>
  );
}

function PendingOrdersCard({ orders }) {
  const bp = useBreakpoint();
  const isMobile = bp === 'xs';
  return (
    <Card>
      <CardHeader title="Pending Orders" action="View All" />
      {!isMobile && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8,
          fontSize: 10, fontWeight: 500, color: C.muted,
          textTransform: 'uppercase', letterSpacing: '0.02em',
          marginBottom: 6, padding: '0 8px',
        }}>
          <span>Student</span><span>School</span><span>Product</span><span>Pay</span><span>Status</span>
        </div>
      )}
      {orders.map((o) => <OrderRow key={o.id} order={o} isMobile={isMobile} />)}
    </Card>
  );
}

function RevenueChartCard({ revenueChart, revenueProgress }) {
  return (
    <Card>
      <CardHeader title="SaaS Revenue — 6 Month" action="Detailed Report" />
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={revenueChart} barGap={3} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: C.muted, fontSize: 11 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: C.muted, fontSize: 11 }} tickFormatter={fmtPKR} width={56} />
          <Tooltip formatter={(v) => [`PKR ${v.toLocaleString()}`, '']} contentStyle={{ borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12 }} cursor={{ fill: '#F8FAFC' }} />
          <Bar dataKey="revenue" fill={C.blue}   radius={[5, 5, 0, 0]} name="Revenue" />
          <Bar dataKey="target"  fill={C.border} radius={[5, 5, 0, 0]} name="Target"  />
        </BarChart>
      </ResponsiveContainer>
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: C.soft }}>Target progress this month</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>{revenueProgress}%</span>
        </div>
        <div style={{ height: 8, backgroundColor: C.canvas, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${revenueProgress}%`, backgroundColor: C.blue, borderRadius: 999, transition: 'width 0.5s ease' }} />
        </div>
      </div>
    </Card>
  );
}

function SupportTicketsCard({ tickets }) {
  return (
    <Card>
      <CardHeader title="Open Support Tickets" action="View All" />
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {tickets.map((t) => <TicketRow key={t.id} ticket={t} />)}
      </ul>
    </Card>
  );
}

function SchoolsStatusCard({ schools }) {
  const bp = useBreakpoint();
  const isMobile = bp === 'xs';
  return (
    <Card>
      <CardHeader title="Schools Status" action="View All" />
      {!isMobile && (
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8,
          fontSize: 10, fontWeight: 500, color: C.muted,
          textTransform: 'uppercase', letterSpacing: '0.02em',
          marginBottom: 6, padding: '0 8px',
        }}>
          <span>School</span><span>City</span><span>Students</span><span>Status</span>
        </div>
      )}
      {schools.map((s, i) => <SchoolRow key={s.id} school={s} last={i === schools.length - 1} isMobile={isMobile} />)}
    </Card>
  );
}
