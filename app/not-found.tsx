import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <main className="nf-page">
      <div className="nf-glow nf-glow-1" aria-hidden />
      <div className="nf-glow nf-glow-2" aria-hidden />

      <div className="nf-shell">
        <div className="nf-art">
          <Image
            src="/images/404 image.png"
            alt="404 — səhifə tapılmadı"
            width={520}
            height={420}
            priority
            unoptimized
            style={{ width: "100%", height: "auto", maxWidth: 520 }}
          />
        </div>

        <div className="nf-copy">
          <p className="nf-eyebrow">404 · Səhifə tapılmadı</p>
          <h1 className="nf-title">
            Bu səhifə yoxa çıxıb<span className="fanus-serif-accent"> görünür.</span>
          </h1>
          <p className="nf-lead">
            Axtardığınız səhifə yerini dəyişib və ya artıq mövcud deyil.
            Əsas səhifədən davam edə bilərsiniz.
          </p>

          <div className="nf-actions">
            <Link href="/" className="nf-btn nf-btn-primary">
              Ana səhifəyə qayıt
            </Link>
            <Link href="/psychologists" className="nf-btn nf-btn-ghost">
              Psixoloqlara bax
            </Link>
          </div>

          <div className="nf-helps">
            <span>Belkə bunları axtarırsınız:</span>
            <div className="nf-help-links">
              <Link href="/xidmetler">Xidmətlər</Link>
              <Link href="/blog">Məqalələr</Link>
              <Link href="/about">Haqqımızda</Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
