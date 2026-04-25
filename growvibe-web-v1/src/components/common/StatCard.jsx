const BADGE = {
  green:  'bg-success-light  text-success',
  red:    'bg-danger-light   text-danger',
  blue:   'bg-info-light     text-info',
  yellow: 'bg-warning-light  text-warning',
  gray:   'bg-hover          text-soft',
};

/**
 * StatCard — KPI tile.
 *
 * Accent line uses inset box-shadow so it respects border-radius
 * without needing overflow-hidden or an absolute child element.
 *
 * Icon box: full-color background when iconBg is provided, white icon.
 * Default: light blue bg (#E8F6FE), primary blue icon.
 */
export default function StatCard({
  icon: Icon,
  iconBg,
  title,
  value,
  subtitle,
  badge,
  badgeColor = 'blue',
}) {
  const accentColor = iconBg ?? '#1CACF3';

  return (
    <div
      className="flex flex-col rounded-2xl border border-line-light bg-card p-6
        transition-shadow duration-200 hover:shadow-lg"
      style={{
        boxShadow: `inset 0 3px 0 0 ${accentColor}, 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)`,
      }}
    >
      {/* Icon + badge */}
      <div className="flex items-start justify-between gap-2">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: iconBg ?? '#E8F6FE' }}
        >
          {Icon && (
            <Icon
              size={21}
              color={iconBg ? '#fff' : '#1CACF3'}
              strokeWidth={1.6}
            />
          )}
        </div>
        {badge && (
          <span
            className={`whitespace-nowrap rounded-xl px-2.5 py-1 text-[11px] font-semibold leading-none
              ${BADGE[badgeColor] ?? BADGE.blue}`}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Value */}
      <div className="mt-5">
        <p className="text-[28px] font-bold leading-none tracking-tight text-ink">{value}</p>
        <p className="mt-2 text-sm font-medium text-soft">{title}</p>
        {subtitle && (
          <p className="mt-1 text-xs text-muted">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
