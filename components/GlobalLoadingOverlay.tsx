"use client";

import { useEffect, useState } from "react";
import { subscribeLoading } from "@/lib/loadingOverlay";
import FanusLoader from "@/components/FanusLoader";
import { useT } from "@/lib/i18n/LocaleProvider";

/**
 * Qlobal yükləmə popupı — hər API mutasiyası (əməliyyat) zamanı avtomatik açılır.
 * `lib/loadingOverlay` store-una abunə olur; `app/layout.tsx`-də bir dəfə mount edilir.
 */
export default function GlobalLoadingOverlay() {
  const { t } = useT();
  const [active, setActive] = useState(false);

  useEffect(() => subscribeLoading(setActive), []);

  if (!active) return null;

  return (
    <div className="fx-loading-overlay" role="alertdialog" aria-busy="true" aria-live="polite" aria-label={t("common.loading")}>
      <div className="fx-loading-overlay__card">
        <FanusLoader size={72} />
        <span className="fx-loading-overlay__text">{t("common.loading")}</span>
      </div>
    </div>
  );
}
