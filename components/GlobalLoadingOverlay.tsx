"use client";

import { useEffect, useState } from "react";
import { subscribeLoading } from "@/lib/loadingOverlay";
import FanusLoader from "@/components/FanusLoader";

/**
 * Qlobal yükləmə popupı — hər API mutasiyası (əməliyyat) zamanı avtomatik açılır.
 * `lib/loadingOverlay` store-una abunə olur; `app/layout.tsx`-də bir dəfə mount edilir.
 */
export default function GlobalLoadingOverlay() {
  const [active, setActive] = useState(false);

  useEffect(() => subscribeLoading(setActive), []);

  if (!active) return null;

  return (
    <div className="fx-loading-overlay" role="alertdialog" aria-busy="true" aria-live="polite" aria-label="Yüklənir">
      <div className="fx-loading-overlay__card">
        <FanusLoader size={72} />
        <span className="fx-loading-overlay__text">Yüklənir…</span>
      </div>
    </div>
  );
}
