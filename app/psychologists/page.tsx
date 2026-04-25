import type { Metadata } from "next";
import { getPsychologists } from "@/lib/api";
import PsychologistsPage from "./PsychologistsPage";

export const metadata: Metadata = {
  title: "Psixoloqlar – Fanus",
  description: "Fanus platformasının bütün psixoloqları. Sahə, təcrübə və reytinqə görə filtirləyin.",
};

export default async function Page() {
  const psychologists = await getPsychologists().catch(() => []);
  return <PsychologistsPage psychologists={psychologists} />;
}
