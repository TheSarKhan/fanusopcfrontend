"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";
import BookingModal from "./BookingModal";
import BackToTop from "./BackToTop";
import WhatsAppButton from "./WhatsAppButton";
import RandevuButton from "./RandevuButton";

const AUTH_PATHS = new Set(["/login", "/register", "/verify", "/forgot-password", "/reset-password"]);

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  // DİQQƏT: burada `mounted` qapısı OLMAMALIDIR.
  //
  // Əvvəl bu komponent mount olana qədər `null` qaytarırdı. SiteChrome bütün publik
  // saytın məzmununu (`<main>{children}</main>`), navbar və footer-i bürüdüyü üçün
  // nəticə bu idi: server HTML-i tamamilə boş gedirdi (gövdədə cəmi ~40 simvol) və
  // səhifə yalnız JS yükləndikdən sonra çəkilirdi. İstifadəçi tərəfdən bu, "ilk
  // açılışda reytinq/rəylər görünmür, refresh-dən sonra görünür" kimi görünürdü;
  // həmçinin SEO üçün səhifələr boş idi.
  //
  // Qapı yəqin ki hidrasiya uyğunsuzluğuna qarşı qoyulmuşdu, amma burada ona ehtiyac
  // yoxdur: `usePathname()` server render zamanı da işləyir, Navbar-ın bütün
  // brauzerə xas oxumaları isə (scroll mövqeyi, sessiya) `useEffect` içindədir, yəni
  // ilk render hər iki tərəfdə eynidir.
  const pathname = usePathname();

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
