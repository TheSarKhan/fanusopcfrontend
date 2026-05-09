"use client";

import { useT } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * Tiny client-side translation marker for use inside Server Components.
 * Drop in `<T k="psyDetail.bookCta" />` and the locale context resolves it
 * client-side after hydration. Falls back to AZ when a translation is missing.
 */
export default function T({
  k,
  vars,
}: {
  k: MessageKey;
  vars?: Record<string, string | number>;
}) {
  const { t } = useT();
  return <>{t(k, vars)}</>;
}
