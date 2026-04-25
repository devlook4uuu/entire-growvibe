import { C } from '../../styles/colors';

const KEYFRAMES = `@keyframes gv-spin { to { transform: rotate(360deg); } }`;

/**
 * Spinner
 * @param {'sm'|'md'|'lg'} size
 * @param {string} color  — border-top color (defaults to C.primary)
 * @param {string} trackColor — border track color
 */
export default function Spinner({
  size = 'md',
  color = C.primary,
  trackColor = C.border,
}) {
  const dim = { sm: 16, md: 22, lg: 32 }[size];
  const thickness = { sm: 2, md: 2.5, lg: 3 }[size];

  return (
    <>
      <style>{KEYFRAMES}</style>
      <span
        role="status"
        aria-label="Loading"
        style={{
          display: 'inline-block',
          width: dim,
          height: dim,
          borderRadius: '50%',
          border: `${thickness}px solid ${trackColor}`,
          borderTopColor: color,
          animation: 'gv-spin 0.7s linear infinite',
          flexShrink: 0,
        }}
      />
    </>
  );
}

/**
 * ButtonSpinner — white spinner sized for use inside primary buttons
 */
export function ButtonSpinner() {
  return (
    <Spinner
      size="sm"
      color="#ffffff"
      trackColor="rgba(255,255,255,0.35)"
    />
  );
}
