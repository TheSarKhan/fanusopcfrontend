import FanusLoader from "@/components/FanusLoader";

// Modullar arası keçiddə (App Router segment naviqasiyası) göstərilir.
export default function Loading() {
  return <FanusLoader size={72} label="Yüklənir…" fullscreen />;
}
