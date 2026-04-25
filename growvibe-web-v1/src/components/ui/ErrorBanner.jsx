import { C, FONT, RADIUS } from '../../styles/colors';

function AlertCircleIcon() {
  return (
    <svg
      width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, marginTop: 1 }}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

const S = {
  box: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    background: C.dangerLight,
    border: `1px solid ${C.dangerBorder}`,
    borderRadius: RADIUS.md,
    padding: '11px 13px',
    marginBottom: 20,
    fontSize: 13,
    color: C.dangerText,
    lineHeight: 1.5,
    fontWeight: 500,
    fontFamily: FONT,
  },
};

/**
 * ErrorBanner
 * Renders a dismissible-style error alert. Returns null when message is empty.
 *
 * @param {string|null} message
 */
export default function ErrorBanner({ message }) {
  if (!message) return null;

  return (
    <div role="alert" style={S.box}>
      <AlertCircleIcon />
      <span>{message}</span>
    </div>
  );
}
