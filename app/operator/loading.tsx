"use client";

import FanusLoader from "@/components/FanusLoader";
import { useT } from "@/lib/i18n/LocaleProvider";

// Modullar arası keçiddə (App Router segment naviqasiyası) göstərilir.
export default function Loading() {
  const { t } = useT();
  return <FanusLoader size={72} label={t("common.loading")} fullscreen />;
}
