import type { Metadata } from "next";
import { Poppins } from "next/font/google";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="az" className={poppins.variable}>
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
