import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, var(--brand-700) 0%, var(--brand) 100%)" }}
    >
      <div style={{
        background: "#fff", borderRadius: "1.5rem", padding: "3rem",
        maxWidth: 440, width: "100%", textAlign: "center",
        boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
      }}>
        <div className="mb-4" style={{ display: "flex", justifyContent: "center" }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-[#1A2535] mb-2">403</h1>
        <p className="text-lg font-semibold text-[#1A2535] mb-2">İcazə yoxdur</p>
        <p className="text-[#52718F] text-sm leading-relaxed mb-8">
          Bu səhifəyə giriş üçün lazımi icazəniz yoxdur.
          Fərqli bir hesabla daxil olun.
        </p>
        <Link
          href="/login"
          className="inline-block py-3 px-8 rounded-xl text-sm font-bold text-white"
          style={{ background: "var(--brand)" }}
        >
           Daxil ol
        </Link>
      </div>
    </div>
  );
}
