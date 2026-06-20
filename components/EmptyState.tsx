import type { ReactNode } from "react";

/** Consistent empty-state block: SVG icon (no emoji) + title + guidance + CTA. */
export default function EmptyState({
  title, sub, icon, action,
}: {
  title: string;
  sub?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="ui-empty">
      {icon && <div className="ui-empty__icon" aria-hidden>{icon}</div>}
      <div className="ui-empty__title">{title}</div>
      {sub && <p className="ui-empty__sub">{sub}</p>}
      {action && <div className="ui-empty__action">{action}</div>}
    </div>
  );
}

/** Default calendar glyph for appointment-related empty states. */
export function CalendarGlyph() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
