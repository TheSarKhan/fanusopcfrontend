import type { ReactNode } from "react";

/** Consistent load-failure block: icon + message + retry button.
 *  Use when a fetch fails so an API/network outage is never mistaken for an
 *  empty list. Pair every silent `.catch(() => [])` on a primary load with this. */
export default function ErrorState({
  title = "Məlumat yüklənmədi",
  sub = "Bağlantı və ya server problemi ola bilər. Bir azdan yenidən yoxlayın.",
  onRetry,
  retryLabel = "Yenidən cəhd et",
  action,
}: {
  title?: string;
  sub?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** Optional extra control rendered next to the retry button. */
  action?: ReactNode;
}) {
  return (
    <div className="ui-error" role="alert">
      <div className="ui-error__icon" aria-hidden>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className="ui-error__title">{title}</div>
      {sub && <p className="ui-error__sub">{sub}</p>}
      <div className="ui-error__actions">
        {onRetry && (
          <button type="button" className="ui-error__retry" onClick={onRetry}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {retryLabel}
          </button>
        )}
        {action}
      </div>
    </div>
  );
}
