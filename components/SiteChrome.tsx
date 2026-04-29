"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";
import BookingModal from "./BookingModal";

const AUTH_PATHS = new Set(["/login", "/register", "/verify", "/forgot-password", "/reset-password"]);

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (AUTH_PATHS.has(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <BookingModal />
    </>
  );
}
