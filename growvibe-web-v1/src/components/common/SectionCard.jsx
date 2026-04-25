/**
 * SectionCard — generic white card with an optional header row.
 *
 * className  extra classes on the root (e.g. "col-span-7")
 * noPadding  skip inner padding (for tables that go edge-to-edge)
 */
export default function SectionCard({
  title,
  action,
  children,
  className = '',
  noPadding = false,
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border border-line-light bg-card
        shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden ${className}`}
    >
      {/* Card header */}
      {(title || action) && (
        <div className="flex flex-shrink-0 items-center justify-between border-b border-line-light px-6 py-4">
          <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
          {action && (
            <button className="text-xs font-semibold text-primary hover:text-primary-dark transition-colors cursor-pointer">
              {action}
            </button>
          )}
        </div>
      )}

      {/* Card body */}
      <div className={`flex-1 ${noPadding ? '' : 'p-5'}`}>
        {children}
      </div>
    </div>
  );
}
