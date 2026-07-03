"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";
import BookingModal from "./BookingModal";
import BackToTop from "./BackToTop";
import WhatsAppButton from "./WhatsAppButton";

const AUTH_PATHS = new Set(["/login", "/register", "/verify", "/forgot-password", "/reset-password"]);

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const pathname = usePathname();

  if (!mounted) return null;

  if (AUTH_PATHS.has(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      {/* Spacer reserves the large-navbar height so content starts below it */}
      <div style={{ height: 104 }} aria-hidden />
      <main className="flex-1">{children}</main>
      <Footer />
      <BookingModal />
      <BackToTop />
      <WhatsAppButton />
    </>
  );
}
