"use client";

import FanusLoader from "@/components/FanusLoader";
import { useT } from "@/lib/i18n/LocaleProvider";

// Modullar arası keçiddə (App Router segment naviqasiyası) göstərilir.
// `loading.tsx` default olaraq Server Component-dir, lakin `useT()` (client-only)
// istifadə etdiyimiz üçün "use client" ilə Client Component kimi işlədilir.
export default function Loading() {
  const { t } = useT();
  return <FanusLoader size={72} label={t("pat.loaderLabel")} fullscreen />;
}
