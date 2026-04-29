import type { Metadata } from "next";
import { Poppins, Playfair_Display } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import SiteChrome from "@/components/SiteChrome";
import { BookingProvider } from "@/context/BookingContext";
import { MoodProvider } from "@/context/MoodContext";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-playfair",
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
    <html lang="az" className={`${poppins.variable} ${playfair.variable}`} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col" suppressHydrationWarning>
        {isPanel ? (
          children
        ) : (
          <MoodProvider>
            <BookingProvider>
              <SiteChrome>{children}</SiteChrome>
            </BookingProvider>
          </MoodProvider>
        )}
      </body>
    </html>
  );
}
