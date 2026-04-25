import type { Metadata } from "next";
import ServicesPage from "./ServicesPage";

export const metadata: Metadata = {
  title: "Xidmətlər – Fanus",
  description: "Fanus psixologiya platformasının təklif etdiyi xidmətlər: fərdi terapiya, cütlük terapiyası, onlayn seans və daha çox.",
};

export default function Page() {
  return <ServicesPage />;
}
