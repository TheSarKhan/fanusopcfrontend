"use client";

import { useEffect } from "react";

/**
 * app/error.tsx yalnız aşağıdakı seqmentləri örtür — kök app/layout.tsx-in
 * özündə (məs. auth cookie/rol uyğunsuzluğu bir tab açıq qalıb başqa tabda
 * fərqli rolla login olunanda) tutulmamış xəta olsa, bu boundary olmasaydı
 * Next.js-in çılpaq "Internal Server Error" səhifəsi görünərdi. global-error
 * kök layout-u əvəz etdiyi üçün öz <html>/<body> teqlərini daşımalıdır və
 * kök layout-un stilləri yüklənməyə bilər — ona görə inline stil istifadə olunur.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="az">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif", background: "#F7F9FC", color: "#0A1A33" }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 480, textAlign: "center" }}>
            <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "#5A6B85", margin: "0 0 8px" }}>
              Xəta baş verdi
            </p>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 12px" }}>
              Səhifə hazırda açılmır.
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "#5A6B85", margin: "0 0 28px" }}>
              Müvəqqəti texniki problem yarandı. Bir az sonra yenidən cəhd edin — problem davam edərsə, dəstək komandası ilə əlaqə saxlayın.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => unstable_retry()}
                style={{ border: "none", cursor: "pointer", background: "#1051B7", color: "#fff", fontWeight: 700, fontSize: 14, padding: "12px 22px", borderRadius: 10 }}
              >
                Yenidən cəhd et
              </button>
              <a
                href="/"
                style={{ border: "1px solid #DDE6F0", background: "#fff", color: "#0A1A33", fontWeight: 700, fontSize: 14, padding: "12px 22px", borderRadius: 10, textDecoration: "none" }}
              >
                Ana səhifəyə qayıt
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
