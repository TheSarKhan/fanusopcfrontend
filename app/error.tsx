"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Bu boundary olmasaydı, server component-də tutulmamış hər xəta (məs. backend
 * müvəqqəti cavab vermədikdə) Next.js-in çılpaq "Internal Server Error" səhifəsini
 * göstərirdi. İndi eyni hal baş versə, istifadəçi bunun əvəzinə anlaşılan mesaj görür.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="nf-page">
      <div className="nf-glow nf-glow-1" aria-hidden />
      <div className="nf-glow nf-glow-2" aria-hidden />

      <div className="nf-copy" style={{ position: "relative", zIndex: 1, maxWidth: 560, textAlign: "center", margin: "0 auto" }}>
        <p className="nf-eyebrow">Xəta baş verdi</p>
        <h1 className="nf-title">
          Səhifə hazırda açılmır<span className="fanus-serif-accent">.</span>
        </h1>
        <p className="nf-lead" style={{ margin: "0 auto 28px" }}>
          Müvəqqəti texniki problem yarandı. Bir az sonra yenidən cəhd edin — problem davam edərsə, dəstək komandası ilə əlaqə saxlayın.
        </p>

        <div className="nf-actions" style={{ justifyContent: "center" }}>
          <button type="button" onClick={() => reset()} className="nf-btn nf-btn-primary" style={{ border: "none", cursor: "pointer" }}>
            Yenidən cəhd et
          </button>
          <Link href="/" className="nf-btn nf-btn-ghost">
            Ana səhifəyə qayıt
          </Link>
        </div>
      </div>
    </main>
  );
}
