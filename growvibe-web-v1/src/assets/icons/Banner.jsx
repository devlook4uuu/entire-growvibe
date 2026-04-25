export default function Banner({ size = 24, color = '#6B7280', strokeWidth = 2 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <rect x="2" y="5" width="20" height="14" rx="2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 10h20" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M7 15h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}
