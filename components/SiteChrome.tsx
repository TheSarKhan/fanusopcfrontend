"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";
import BookingModal from "./BookingModal";
import BackToTop from "./BackToTop";
import WhatsAppButton from "./WhatsAppButton";
import RandevuButton from "./RandevuButton";

const AUTH_PATHS = new Set(["/login", "/register", "/verify", "/forgot-password", "/reset-password"]);

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const pathname = usePathname();

  if (!mounted) return null;

  if (AUTH_PATHS.has(pathname)) {
    return <>{children}</>;
  }

  const isHome = pathname === "/";

  return (
    <>
      <Navbar />
      {/* Spacer reserves the navbar height so content starts below it. Ana səhifədə isə
          BÜTÜN ölçülərdə sıfırdır: hero artıq mobil daxil tam-ekran video arxa fondur və
          navbar onun üzərində şəffaf durur (əvvəl mobildə 88px ağ zolaq qalırdı). */}
      {isHome ? (
        <div className="fanus-nav-spacer--home" aria-hidden />
      ) : (
        <div style={{ height: 104 }} aria-hidden />
      )}
      <main className="flex-1">{children}</main>
      <Footer />
      <BookingModal />
      <BackToTop />
      <WhatsAppButton />
      <RandevuButton />

      <style>{`
        .fanus-nav-spacer--home { height: 0; }
      `}</style>
    </>
  );
}
