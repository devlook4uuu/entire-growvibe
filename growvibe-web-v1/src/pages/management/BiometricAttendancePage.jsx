/**
 * BiometricAttendancePage.jsx
 *
 * Upload a ZK Teco K40 attlog.dat file to mark student attendance
 * for a selected branch and date via the process-biometric Edge Function.
 *
 * Visible to: owner, principal, coordinator
 */

import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { supabase } from '../../lib/supabase';
import { C, PageHeader, useBreakpoint } from '../dashboard/AdminDashboard';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Upload icon (inline SVG) ─────────────────────────────────────────────────
function UploadIcon({ size = 20, color = C.blue }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function FileIcon({ size = 20, color = '#64748B' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function CheckCircleIcon({ size = 20, color = '#22C55E' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function AlertIcon({ size = 20, color = '#EF4444' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

// ─── Stat pill ────────────────────────────────────────────────────────────────
function StatPill({ label, value, color, bg }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, backgroundColor: bg, borderRadius: 12, padding: '12px 20px', minWidth: 80 }}>
      <span style={{ fontSize: 22, fontWeight: 800, color }}>{value}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function BiometricAttendancePage() {
  const bp      = useBreakpoint();
  const profile = useSelector((s) => s.auth.profile);

  const isOwner = profile?.role === 'owner';

  const [branches,        setBranches]        = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(isOwner);
  const [selectedBranch,  setSelectedBranch]  = useState(() => isOwner ? '' : (profile?.branch_id ?? ''));
  const [selectedDate,    setSelectedDate]    = useState(todayStr());
  const [file,            setFile]            = useState(null);
  const [dragOver,        setDragOver]        = useState(false);
  const [uploading,       setUploading]       = useState(false);
  const [result,          setResult]          = useState(null); // success result
  const [error,           setError]           = useState('');
  const [warning,         setWarning]         = useState('');

  const fileInputRef = useRef(null);

  // ── Load branches only for owner (principal/coordinator use their own branch) ─
  useEffect(() => {
    if (!isOwner || !profile?.school_id) return;
    supabase
      .from('branches')
      .select('id, name')
      .eq('school_id', profile.school_id)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .then(({ data }) => {
        setBranches(data ?? []);
        if (data?.length === 1) setSelectedBranch(data[0].id);
        setBranchesLoading(false);
      });
  }, [isOwner, profile?.school_id]);

  // ── File selection ─────────────────────────────────────────────────────────
  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith('.dat')) {
      setError('Only .dat files are accepted.');
      return;
    }
    setFile(f);
    setError('');
    setResult(null);
    setWarning('');
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!f.name.endsWith('.dat')) {
      setError('Only .dat files are accepted.');
      return;
    }
    setFile(f);
    setError('');
    setResult(null);
    setWarning('');
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function removeFile() {
    setFile(null);
    setResult(null);
    setError('');
    setWarning('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!selectedBranch)  return setError('Please select a branch.');
    if (!selectedDate)    return setError('Please select a date.');
    if (!file)            return setError('Please select a .dat file.');

    setError('');
    setWarning('');
    setResult(null);
    setUploading(true);

    try {
      const fileText = await file.text();
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-biometric`,
        {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            branch_id: selectedBranch,
            date:      selectedDate,
            file_text: fileText,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        if (data?.error?.includes('already uploaded')) {
          setWarning(data.error);
        } else {
          throw new Error(data?.error || 'Upload failed.');
        }
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  const canSubmit = selectedBranch && selectedDate && file && !uploading;

  return (
    <div>
      <PageHeader
        title="Biometric Attendance"
        subtitle="Upload a ZK Teco K40 attlog.dat file to mark attendance"
      />

      <div style={{ display: 'grid', gridTemplateColumns: bp === 'xs' ? '1fr' : '1fr 320px', gap: 20, alignItems: 'start' }}>

        {/* ── Left: form ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Error banner */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 14px' }}>
              <AlertIcon size={16} color="#DC2626" />
              <span style={{ fontSize: 13, color: '#B91C1C', flex: 1 }}>{error}</span>
            </div>
          )}

          {/* Warning banner */}
          {warning && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 14px' }}>
              <AlertIcon size={16} color="#D97706" />
              <span style={{ fontSize: 13, color: '#92400E', flex: 1 }}>{warning}</span>
            </div>
          )}

          {/* Form card */}
          <div style={{ backgroundColor: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Branch selector — owners only; principal/coordinator use their own branch */}
            {isOwner && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Branch</label>
                {branchesLoading ? (
                  <div style={{ height: 40, borderRadius: 8, backgroundColor: C.borderLight }} />
                ) : (
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    style={{
                      height: 40, borderRadius: 8, border: `1px solid ${C.border}`,
                      paddingInline: 12, fontSize: 13, color: selectedBranch ? C.ink : C.muted,
                      backgroundColor: C.white, outline: 'none', cursor: 'pointer',
                    }}
                  >
                    <option value="">Select a branch…</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Date picker */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Date</label>
              <input
                type="date"
                value={selectedDate}
                max={todayStr()}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  height: 40, borderRadius: 8, border: `1px solid ${C.border}`,
                  paddingInline: 12, fontSize: 13, color: C.ink,
                  backgroundColor: C.white, outline: 'none',
                }}
              />
            </div>

            {/* File drop zone */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>Attendance File (.dat)</label>

              {!file ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragOver ? C.blue : C.border}`,
                    borderRadius: 12,
                    padding: '32px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: dragOver ? C.blueBg : C.canvas,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.blueBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UploadIcon size={22} color={C.blue} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Drop your attlog.dat file here</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>or click to browse</div>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, backgroundColor: C.white, borderRadius: 6, paddingInline: 10, paddingBlock: 4, border: `1px solid ${C.border}` }}>
                    .dat files only
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".dat"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, backgroundColor: C.blueBg, border: `1px solid ${C.blue}30`, borderRadius: 10, padding: '12px 14px' }}>
                  <FileIcon size={20} color={C.blue} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{(file.size / 1024).toFixed(1)} KB</div>
                  </div>
                  <button
                    onClick={removeFile}
                    style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.border}`, backgroundColor: C.white, cursor: 'pointer', fontSize: 16, color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    title="Remove file"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                height: 42, borderRadius: 10, border: 'none',
                backgroundColor: canSubmit ? C.blue : C.borderLight,
                color: canSubmit ? '#fff' : C.muted,
                fontWeight: 600, fontSize: 14,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background-color 0.15s',
              }}
            >
              {uploading ? (
                <>
                  <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  Processing…
                </>
              ) : (
                <>
                  <UploadIcon size={16} color={canSubmit ? '#fff' : C.muted} />
                  Upload & Process
                </>
              )}
            </button>
          </div>

          {/* Result card */}
          {result && (
            <div style={{ backgroundColor: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <CheckCircleIcon size={18} color="#22C55E" />
                <span style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Upload Complete</span>
              </div>

              {/* Stat pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                <StatPill label="Processed"    value={result.processed}      color="#3B82F6" bg="#EFF6FF" />
                <StatPill label="Present"      value={result.present}        color="#22C55E" bg="#ECFDF5" />
                <StatPill label="Late"         value={result.late}           color="#F59E0B" bg="#FFFBEB" />
                <StatPill label="Skipped"      value={result.skipped_manual} color="#8B5CF6" bg="#F5F3FF" />
              </div>

              {/* Unknown IDs */}
              {result.unknown_ids?.length > 0 && (
                <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>
                    Unknown Biometric IDs ({result.unknown_ids.length}) — not matched to any profile:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {result.unknown_ids.map((id) => (
                      <span
                        key={id}
                        style={{ fontSize: 12, fontWeight: 600, color: '#D97706', backgroundColor: '#FEF3C7', borderRadius: 6, paddingInline: 8, paddingBlock: 3, border: '1px solid #FDE68A' }}
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: '#B45309', marginTop: 8 }}>
                    Assign a Biometric ID to the matching staff/student profiles to include them in future uploads.
                  </div>
                </div>
              )}

              {result.skipped_manual > 0 && (
                <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>
                  {result.skipped_manual} record(s) were skipped because a manual attendance record already exists — manual always wins.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: instructions ── */}
        <div style={{ backgroundColor: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>How it works</div>

          {[
            { step: '1', title: 'Export from device', desc: 'On your ZK Teco K40, export attendance logs. The file is named attlog.dat.' },
            { step: '2', title: 'Select branch & date', desc: 'Choose the branch and the date the attendance was recorded.' },
            { step: '3', title: 'Upload', desc: 'Drop the .dat file or click to browse, then press Upload & Process.' },
            { step: '4', title: 'Review results', desc: 'Check processed counts and any unknown biometric IDs. Manual records are never overwritten.' },
          ].map(({ step, title, desc }) => (
            <div key={step} style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: C.blueBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: C.blue, flexShrink: 0, marginTop: 1 }}>
                {step}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{title}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}

          <div style={{ borderTop: `1px solid ${C.borderLight}`, paddingTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.soft, marginBottom: 6 }}>Late threshold</div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
              Punch time &le; branch threshold → <strong style={{ color: '#22C55E' }}>Present</strong><br />
              Punch time &gt; branch threshold → <strong style={{ color: '#F59E0B' }}>Late</strong><br />
              Default threshold is <strong>08:00</strong>.
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${C.borderLight}`, paddingTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.soft, marginBottom: 6 }}>Important notes</div>
            <ul style={{ fontSize: 12, color: C.muted, lineHeight: 1.8, margin: 0, paddingLeft: 16 }}>
              <li>Only the first punch per person is used.</li>
              <li>Manual records always win — biometric won't overwrite them.</li>
              <li>Students must have a Biometric ID set in their profile.</li>
              <li>Absent push notifications are sent automatically.</li>
            </ul>
          </div>
        </div>

      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
