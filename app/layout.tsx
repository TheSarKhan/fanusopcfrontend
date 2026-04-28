import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BookingModal from "@/components/BookingModal";
import MoodGate from "@/components/MoodGate";
import { BookingProvider } from "@/context/BookingContext";
import { MoodProvider } from "@/context/MoodContext";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fanus – Online Psixologiya Mərkəzi",
  description:
    "Fanus – istifadəçilərlə psixoloqları birləşdirən onlayn platformadır. Peşəkar, məxfi və empatik psixoloji dəstək.",
  keywords: "psixoloq, psixoloji yardım, onlayn terapiya, Fanus, Azərbaycan",
};

const PANEL_SUBDOMAINS = new Set(["admin", "operator", "patient", "psycholog"]);

function getSubdomain(host: string): string | null {
  const hostname = host.split(":")[0];
  const parts = hostname.split(".");
  if (parts.length >= 3) return parts[0];
  if (parts.length === 2 && parts[1] === "localhost") return parts[0];
  return null;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const subdomain = getSubdomain(host);
  const isPanel = subdomain !== null && PANEL_SUBDOMAINS.has(subdomain);

  return (
    <html lang="az" className={poppins.variable}>
      <body className="min-h-screen flex flex-col">
        {isPanel ? (
          children
        ) : (
          <MoodProvider>
            <BookingProvider>
              <MoodGate />
              <Navbar />
              <main className="flex-1">{children}</main>
              <Footer />
              <BookingModal />
            </BookingProvider>
          </MoodProvider>
        )}
      </body>
    </html>
  );
}
