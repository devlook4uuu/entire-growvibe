export default function TimeTableBadge({ size = 9, color = '#6B7280', strokeWidth = 1 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 9 10" fill="none">
      <rect x="1.12179" y="1.46799" width="6.73077" height="6.73077" rx="3.36538" fill={color} stroke={color} strokeWidth={strokeWidth} />
    </svg>
  );
}
