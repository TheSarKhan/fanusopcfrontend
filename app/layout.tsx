import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BookingModal from "@/components/BookingModal";
import MoodGate from "@/components/MoodGate";
import { BookingProvider } from "@/context/BookingContext";
import { MoodProvider } from "@/context/MoodContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fanus – Online Psixologiya Mərkəzi",
  description:
    "Fanus – istifadəçilərlə psixoloqları birləşdirən onlayn platformadır. Peşəkar, məxfi və empatik psixoloji dəstək.",
  keywords: "psixoloq, psixoloji yardım, onlayn terapiya, Fanus, Azərbaycan",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="az" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen flex flex-col">
        <MoodProvider>
          <BookingProvider>
            <MoodGate />
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
            <BookingModal />
          </BookingProvider>
        </MoodProvider>
      </body>
    </html>
  );
}
