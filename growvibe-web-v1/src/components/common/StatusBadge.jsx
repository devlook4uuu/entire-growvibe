const statusStyles = {
  active:       'bg-success-light text-success',
  inactive:     'bg-danger-light  text-danger',
  pending:      'bg-warning-light text-warning',
  processing:   'bg-info-light    text-info',
  shipped:      'bg-success-light text-success',
  delivered:    'bg-success-light text-success',
  open:         'bg-danger-light  text-danger',
  closed:       'bg-success-light text-success',
  marked:       'bg-success-light text-success',
  missing:      'bg-danger-light  text-danger',
  paid:         'bg-success-light text-success',
  unpaid:       'bg-danger-light  text-danger',
  review:       'bg-warning-light text-warning',
  submitted:    'bg-success-light text-success',
  'in-progress':'bg-info-light    text-info',
};

export default function StatusBadge({ status }) {
  const style = statusStyles[status] || 'bg-hover text-soft';
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${style}`}>
      {status}
    </span>
  );
}
