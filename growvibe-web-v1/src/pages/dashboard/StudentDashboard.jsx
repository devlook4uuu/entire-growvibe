import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { C, Card, CardHeader, Badge, StatCard, StatsGrid, TwoColGrid, SingleCol, PageHeader, useBreakpoint } from './AdminDashboard';
import BannerCarousel from '../../components/shared/BannerCarousel';
import Coin      from '../../assets/icons/Coin';
import Attendence from '../../assets/icons/Attendence';
import Order     from '../../assets/icons/Order';
import Diary     from '../../assets/icons/Diary';
import { studentData } from '../../data/mockData';
import { supabase } from '../../lib/supabase';

// ─── Attendance progress helpers ─────────────────────────────────────────────
const PROGRESS_TTL = 60_000;
const progressCache = {};
// class_id → sessionId (permanent within page session — class assignment doesn't change)
const sessionIdCache = {};

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function mondayOfWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}
function summarise(records, from) {
  const today = todayLocal();
  const filtered    = records.filter((r) => r.date >= from && r.date <= today);
  const markedDays  = filtered.length;
  const presentDays = filtered.filter((r) => r.status === 'present' || r.status === 'late').length;
  const pct         = markedDays > 0 ? presentDays / markedDays : 0;
  return { markedDays, presentDays, pct };
}
function progressCacheKey(studentId, sessionId) {
  return `${studentId}|${sessionId}|${todayLocal()}`;
}
function isCacheFresh(key) {
  return progressCache[key] && Date.now() - progressCache[key].ts < PROGRESS_TTL;
}

function useAttendanceProgress(studentId, sessionId) {
  const [weekly,  setWeekly]  = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!studentId || !sessionId) return;

    const key = progressCacheKey(studentId, sessionId);
    if (isCacheFresh(key)) {
      const c = progressCache[key];
      setWeekly(c.weekly);
      setMonthly(c.monthly);
      return;
    }

    setLoading(true);
    const from  = firstOfMonth();
    const today = todayLocal();
    supabase
      .from('attendance')
      .select('date, status')
      .eq('person_id', studentId)
      .eq('role', 'student')
      .eq('session_id', sessionId)
      .gte('date', from)
      .lte('date', today)
      .then(({ data }) => {
        const records = data || [];
        const weekly  = summarise(records, mondayOfWeek());
        const monthly = summarise(records, from);
        progressCache[key] = { weekly, monthly, ts: Date.now() };
        setWeekly(weekly);
        setMonthly(monthly);
        setLoading(false);
      });
  }, [studentId, sessionId]);

  return { weekly, monthly, loading };
}

export default function StudentDashboard() {
  const bp      = useBreakpoint();
  const profile = useSelector((s) => s.auth.profile);
  const { growCoins, feeStatus, todayDiary, myOrders } = studentData;
  const today = new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Resolve sessionId from student's class (cached at module level — survives remount)
  const [sessionId, setSessionId] = useState(() => sessionIdCache[profile?.class_id] ?? null);
  useEffect(() => {
    if (!profile?.class_id) return;
    if (sessionIdCache[profile.class_id]) { setSessionId(sessionIdCache[profile.class_id]); return; }
    supabase
      .from('classes').select('session_id').eq('id', profile.class_id).maybeSingle()
      .then(({ data }) => {
        if (data?.session_id) {
          sessionIdCache[profile.class_id] = data.session_id;
          setSessionId(data.session_id);
        }
      });
  }, [profile?.class_id]);

  const { weekly, monthly, loading: progressLoading } = useAttendanceProgress(profile?.id, sessionId);

  const voucherProgress = Math.min(Math.round((growCoins.balance / growCoins.vouchers.premium.required) * 100), 100);
  const basicProgress   = Math.min(Math.round((growCoins.balance / growCoins.vouchers.basic.required)   * 100), 100);

  const isLarge   = bp === 'lg' || bp === 'xl' || bp === '2xl';
  const statCols  = isLarge ? 3 : bp === 'sm' ? 2 : 1;
  const useTwoCol = isLarge;

  const weekVal  = weekly  ? `${weekly.presentDays}/${weekly.markedDays}`   : '—';
  const monthVal = monthly ? `${monthly.presentDays}/${monthly.markedDays}` : '—';

  return (
    <div>
      <PageHeader
        greeting={`Good morning, ${profile?.name || 'Student'}`}
        subtitle={`${today}`}
      />

      <BannerCarousel />

      {/* Fee alert */}
      {feeStatus.status === 'unpaid' && <FeeAlert feeStatus={feeStatus} />}

      <StatsGrid cols={statCols}>
        <StatCard icon={Coin}       iconColor="#fff" iconBg={C.yellow} title="GrowCoins Balance" value={growCoins.balance}  badge={`+${studentData.stats.growCoins.todayEarnings} today`} badgeColor={{ text: C.yellow, bg: C.yellowBg }} />
        <StatCard icon={Attendence} iconColor="#fff" iconBg={C.sky}    title="This Week"         value={progressLoading ? '…' : weekVal}  badge="present / marked" badgeColor={{ text: C.blue,  bg: C.blueBg }} />
        <StatCard icon={Attendence} iconColor="#fff" iconBg={C.green}  title="This Month"        value={progressLoading ? '…' : monthVal} badge="present / marked" badgeColor={{ text: C.green, bg: C.greenBg }} />
      </StatsGrid>

      {useTwoCol ? (
        <TwoColGrid>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <AttendanceProgressCard weekly={weekly} monthly={monthly} loading={progressLoading} />
            <GrowCoinsCard growCoins={growCoins} basicProgress={basicProgress} voucherProgress={voucherProgress} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <DiaryCard diary={todayDiary} />
            <OrdersCard orders={myOrders} />
          </div>
        </TwoColGrid>
      ) : (
        <SingleCol>
          <AttendanceProgressCard weekly={weekly} monthly={monthly} loading={progressLoading} />
          <GrowCoinsCard growCoins={growCoins} basicProgress={basicProgress} voucherProgress={voucherProgress} />
          <DiaryCard diary={todayDiary} />
          <OrdersCard orders={myOrders} />
        </SingleCol>
      )}
    </div>
  );
}

function FeeAlert({ feeStatus }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      border: `1px solid rgba(239,68,68,0.25)`, borderRadius: 14,
      backgroundColor: C.redBg, padding: '12px 18px', marginBottom: 20,
    }}>
      <p style={{ fontSize: 13, fontWeight: 500, color: C.red, margin: 0 }}>
        <strong>Fee Unpaid</strong> — {feeStatus.month} · PKR {feeStatus.amount.toLocaleString()}
      </p>
      <button
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ flexShrink: 0, borderRadius: 10, padding: '7px 16px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, backgroundColor: hov ? '#DC2626' : C.red, color: '#fff', transition: 'background-color 0.15s' }}
      >Pay Now</button>
    </div>
  );
}

function AttendanceProgressCard({ weekly, monthly, loading }) {
  if (loading || !weekly || !monthly) {
    return (
      <Card>
        <CardHeader title="Coin Progress" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2].map((i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ height: 12, width: 80, backgroundColor: C.canvas, borderRadius: 6 }} />
              <div style={{ height: 8,  width: '100%', backgroundColor: C.canvas, borderRadius: 999 }} />
              <div style={{ height: 10, width: '55%', backgroundColor: C.canvas, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const weekPct  = Math.round(weekly.pct  * 100);
  const monthPct = Math.round(monthly.pct * 100);

  return (
    <Card>
      <CardHeader title="Coin Progress" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ProgressBlock label="This Week"  presentDays={weekly.presentDays}  markedDays={weekly.markedDays}  pct={weekPct} />
        <div style={{ height: 1, backgroundColor: C.borderLight }} />
        <ProgressBlock label="This Month" presentDays={monthly.presentDays} markedDays={monthly.markedDays} pct={monthPct} />
      </div>
    </Card>
  );
}

function ProgressBlock({ label, presentDays, markedDays, pct }) {
  const cappedPct = Math.min(pct, 100);

  const msgText = pct >= 1
    ? 'Perfect! Keep this up every week to earn your coin!'
    : pct >= 0.8
      ? "You're on track — stay consistent to earn your coin!"
      : `Reach 80% attendance to earn a coin — you're at ${Math.round(pct * 100)}%!`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{label}</span>
        <span style={{ fontSize: 13, color: C.muted }}>
          <span style={{ fontWeight: 700, color: C.blue }}>{presentDays}</span>
          {' / '}
          <span>{markedDays} marked</span>
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.soft }}>{cappedPct}%</span>
      </div>
      <div style={{ height: 8, backgroundColor: C.canvas, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${cappedPct}%`, backgroundColor: C.blue, borderRadius: 999, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{msgText}</span>
    </div>
  );
}

function GrowCoinsCard({ growCoins, basicProgress, voucherProgress }) {
  return (
    <Card>
      <CardHeader title="GrowCoins" />
      {/* Balance */}
      <div style={{ borderRadius: 10, backgroundColor: C.yellowBg, padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', color: C.yellow, margin: 0 }}>Your Balance</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: '4px 0 0' }}>
              {growCoins.balance} <span style={{ fontSize: 13, fontWeight: 400, color: C.muted }}>coins</span>
            </p>
          </div>
          <Coin size={30} color={C.yellow} strokeWidth={1.4} />
        </div>
      </div>

      {/* Progress bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        <ProgressBar label="Basic Voucher" current={growCoins.balance} total={growCoins.vouchers.basic.required} progress={basicProgress} color={C.green} />
        <ProgressBar label="Premium Voucher" current={growCoins.balance} total={growCoins.vouchers.premium.required} progress={voucherProgress} color={C.yellow} />
      </div>

      {/* Transactions */}
      <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', color: C.muted, margin: '0 0 8px' }}>Recent</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {growCoins.transactions.map((t, i) => {
          const [hov, setHov] = useState(false);
          return (
            <li
              key={i}
              onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderRadius: 8, padding: '8px 10px',
                backgroundColor: hov ? '#F8FAFC' : 'transparent', transition: 'background-color 0.15s',
              }}
            >
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.ink, margin: 0 }}>{t.type}</p>
                <p style={{ fontSize: 11, color: C.muted, margin: '1px 0 0' }}>{t.date}</p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.amount.startsWith('+') ? C.green : C.red }}>
                {t.amount}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function ProgressBar({ label, current, total, progress, color }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: C.soft }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{current}/{total}</span>
      </div>
      <div style={{ height: 8, backgroundColor: C.canvas, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, backgroundColor: color, borderRadius: 999, transition: 'width 0.5s ease' }} />
      </div>
      {progress >= 100 && (
        <p style={{ fontSize: 11, fontWeight: 600, color: C.green, margin: '4px 0 0' }}>Ready to redeem!</p>
      )}
    </div>
  );
}

function DiaryCard({ diary }) {
  return (
    <Card>
      <CardHeader title="Today's Diary / Homework" action="View All" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {diary.map((d, i) => (
          <div key={i} style={{ border: `1px solid ${C.borderLight}`, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Diary size={13} color={C.blue} strokeWidth={1.8} />
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', color: C.blue }}>{d.subject}</span>
            </div>
            <p style={{ fontSize: 13, color: C.soft, margin: 0, lineHeight: 1.5 }}>{d.homework}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function OrdersCard({ orders }) {
  const bp = useBreakpoint();
  const isMobile = bp === 'xs';
  return (
    <Card>
      <CardHeader title="My Orders" action="Shop Now" />
      {orders.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0', textAlign: 'center' }}>
          <Order size={32} color={C.muted} strokeWidth={1.4} />
          <p style={{ fontSize: 13, color: C.muted, marginTop: 8, marginBottom: 0 }}>No orders yet</p>
        </div>
      ) : (
        <>
          {!isMobile && (
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
              fontSize: 10, fontWeight: 500, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.02em',
              marginBottom: 4, padding: '0 8px',
            }}>
              <span>Product</span><span>Status</span><span>Delivery Week</span>
            </div>
          )}
          {orders.map((o, i) => {
            const [hov, setHov] = useState(false);
            return isMobile ? (
              <div key={i} style={{ padding: '10px 8px', borderBottom: i < orders.length - 1 ? `1px solid ${C.borderLight}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{o.product}</span>
                  <Badge status={o.status} />
                </div>
                <span style={{ fontSize: 11, color: C.soft }}>{o.deliveryWeek}</span>
              </div>
            ) : (
              <div
                key={i}
                onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
                  alignItems: 'center', padding: '9px 8px', borderRadius: 8,
                  borderBottom: i < orders.length - 1 ? `1px solid ${C.borderLight}` : 'none',
                  backgroundColor: hov ? '#F8FAFC' : 'transparent', transition: 'background-color 0.15s',
                  fontSize: 13,
                }}
              >
                <span style={{ fontWeight: 500, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.product}</span>
                <Badge status={o.status} />
                <span style={{ color: C.soft }}>{o.deliveryWeek}</span>
              </div>
            );
          })}
        </>
      )}
    </Card>
  );
}
