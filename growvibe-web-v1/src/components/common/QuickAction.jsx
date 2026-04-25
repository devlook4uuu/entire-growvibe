export default function QuickAction({ label, icon: Icon }) {
  return (
    <button className="flex h-9 items-center gap-2 rounded-xl border border-line-light bg-card px-4 text-[13px] font-medium text-soft
      shadow-[0_1px_3px_rgba(0,0,0,0.07)] transition-all hover:border-primary/40 hover:bg-primary-light hover:text-primary cursor-pointer">
      {Icon && <Icon size={14} color="currentColor" strokeWidth={1.7} />}
      {label}
    </button>
  );
}
