import type { Metadata } from "next";
import { getPublicTestCatalog } from "@/lib/api";
import TestsCatalogView from "./TestsCatalogView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Psixoloji testlər — Fanus",
  description: "Fanus mütəxəssislərinin hazırladığı psixoloji testlər — pulsuz doldurun, nəticənizi hesabınızda görün.",
};

export default async function PublicTestsPage() {
  const tests = await getPublicTestCatalog().catch(() => []);

  return <TestsCatalogView tests={tests} />;
}
