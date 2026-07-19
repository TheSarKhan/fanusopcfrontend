"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { login, clearSession, tryGetMe } from "@/lib/api";
import { buildPanelUrl } from "@/lib/auth";
import { holdOverlay } from "@/lib/loadingOverlay";
import { useT } from "@/lib/i18n/LocaleProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";

function MailIcon() {
  return (
    <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 6l-10 7L2 6" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

const TRUST = [
  {
    icon: (
      <svg width="18" height="18" fill="none" stroke="white" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    title: "Məxfi söhbət",
    sub: "Yazdıqlarınız sizdə və psixoloqunuzda qalır",
  },
  {
    icon: (
      <svg width="18" height="18" fill="none" stroke="white" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: "Sertifikatlı psixoloqlar",
    sub: "Hamısı yoxlanılıb və təsdiqlənib",
  },
  {
    icon: (
      <svg width="18" height="18" fill="none" stroke="white" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
    ),
    title: "Onlayn seans",
    sub: "Evdən, telefondan və ya kompüterdən",
  },
];

export default function LoginPage() {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("_logout") === "1") {
      clearSession();
      window.history.replaceState({}, "", "/login");
      return;
    }
    if (params.get("session") === "expired") {
      setError("Sessiyanız bitdi. Yenidən daxil olun.");
    }

    // Warm up TCP/TLS to every role subdomain so the post-login hard-redirect
    // doesn't pay the handshake cost. ~200–500ms saved per role on first visit.
    const { protocol, hostname, port } = window.location;
    const host = hostname.replace(/^[a-z]+\./, "");
    const portStr = port ? `:${port}` : "";
    ["patient", "psycholog", "operator", "admin"].forEach((sub) => {
      const link = document.createElement("link");
      link.rel = "preconnect";
      link.href = `${protocol}//${sub}.${host}${portStr}`;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    // Popupı submit-dən subdomainə yönləndirməyə qədər açıq saxla — response tez
    // gəlsə də, hard-redirect tamamlanana kimi animasiya görünsün.
    const releaseOverlay = holdOverlay();
    try {
      const data = await login(email, password);

      // Browsers occasionally finish navigation before committing the Set-Cookie
      // from a cross-origin response, leaving the next page to call /api/me
      // without a cookie and bounce back here. Verify the cookie is live before
      // redirecting; retry a couple times with tiny backoff if needed.
      let verified = false;
      for (let i = 0; i < 4; i++) {
        const me = await tryGetMe();
        if (me) { verified = true; break; }
        await new Promise(r => setTimeout(r, 120));
      }
      if (!verified) {
        throw new Error("Sessiya yaradıla bilmədi. Yenidən cəhd edin.");
      }

      // Always land on the role's subdomain. If a `?next=` deep-link was
      // captured by the auth guard, keep its path but rewrite the origin
      // to the panel subdomain (and only honour it for the matching role
      // — otherwise the panel guard would just bounce again).
      const ROLE_PANEL_PATH: Record<string, string> = {
        ADMIN: "/admin", OPERATOR: "/operator", PATIENT: "/patient", PSYCHOLOGIST: "/psycholog",
      };
      const expectedPanel = ROLE_PANEL_PATH[data.role];
      const panelUrl = buildPanelUrl(data.role);
      const next = new URLSearchParams(window.location.search).get("next");
      let target = panelUrl;
      if (next && expectedPanel && next.startsWith(expectedPanel)) {
        try {
          const u = new URL(panelUrl);
          u.pathname = next;
          target = u.toString();
        } catch { /* fall through to panelUrl */ }
      }
      window.location.href = target;
      // release ÇAĞIRILMIR — brauzer navigasiya edənə qədər popup açıq qalsın.
    } catch (err: unknown) {
      releaseOverlay(); // xəta: popupı bağla
      setError(err instanceof Error ? err.message : "Giriş uğursuz oldu");
      setLoading(false);
    }
  };

  return (
    <div className="auth-split">
      {/* ── Form side ── */}
      <div className="auth-form-side">
        {/* Top bar */}
        <div className="auth-topbar">
          <Link href="/" aria-label="Fanus">
            <span className="auth-logo">
              <span className="auth-logo__mark">
                <Image src="/images/logos/logo-mark.png" alt="Fanus" width={1035} height={1856} priority />
              </span>
              <span className="auth-logo__text">
                <span className="auth-logo__name">FANUS</span>
                <span className="auth-logo__sub">
                  <span>Online</span>
                  <span>Psychology</span>
                  <span>Center</span>
                </span>
              </span>
            </span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <LanguageSwitcher variant="default" />
            <Link href="/" className="auth-back-btn">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              {t("common.back")}
            </Link>
          </div>
        </div>

        {/* Centered form */}
        <div className="auth-form-center">
          <div className="auth-form-box">
            <h1 style={{ fontFamily: "var(--serif)", fontSize: 30, fontWeight: 500, color: "var(--oxford)", marginBottom: 6 }}>
              {t("auth.loginTitle")}
            </h1>
            <p style={{ fontSize: 15, color: "var(--oxford-60)", marginBottom: 32 }}>
              {t("auth.loginSubtitle")}
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label className="auth-label">{t("auth.email")}</label>
                <div className="auth-input-icon-wrap">
                  <span className="auth-input-icon"><MailIcon /></span>
                  <input
                    type="email"
                    className="auth-input"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="email@nümunə.az"
                    required
                  />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label className="auth-label" style={{ marginBottom: 0 }}>{t("auth.password")}</label>
                  <Link href="/forgot-password" style={{ fontSize: 12.5, color: "var(--oxford-60)", textDecoration: "none" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--oxford)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--oxford-60)")}>
                    {t("auth.forgotLink")}
                  </Link>
                </div>
                <div className="auth-input-wrap">
                  <input
                    type={showPass ? "text" : "password"}
                    className="auth-input"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <button type="button" className="auth-eye" onClick={() => setShowPass(v => !v)}>
                    <EyeIcon open={showPass} />
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, color: "#B91C1C" }}>
                  <AlertIcon />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ height: 50, fontSize: 15, borderRadius: 10, marginTop: 4 }}
              >
                {loading ? t("common.sending") : t("auth.loginCta")}
              </button>
            </form>

            <p style={{ textAlign: "center", fontSize: 14, color: "var(--oxford-60)", marginTop: 28 }}>
              {t("auth.noAccount")}{" "}
              <Link href="/register" style={{ color: "var(--oxford)", fontWeight: 600, textDecoration: "none" }}>
                {t("nav.register")}
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* ── Decorative panel ── */}
      <div className="auth-panel">
        <div className="auth-panel-content">
          <span className="auth-logo auth-logo--light">
            <span className="auth-logo__mark">
              <Image src="/images/logos/logo-mark-white.png" alt="Fanus" width={1035} height={1856} />
            </span>
            <span className="auth-logo__text">
              <span className="auth-logo__name">FANUS</span>
              <span className="auth-logo__sub">
                <span>Online</span>
                <span>Psychology</span>
                <span>Center</span>
              </span>
            </span>
          </span>
          <h2 className="auth-panel-title">
            Daha yaxşı hiss etmək<br />bu gün başlayır
          </h2>
          <p className="auth-panel-sub">
            Azərbaycanda öz dilinizdə, öz mədəniyyətinizdə psixoloji dəstək. Hər addımda yanınızdayıq.
          </p>
          <div className="auth-panel-trust">
            {TRUST.map((t) => (
              <div key={t.title} className="auth-panel-trust-item">
                <div className="auth-panel-trust-icon">{t.icon}</div>
                <div className="auth-panel-trust-text">
                  <strong>{t.title}</strong>
                  <span>{t.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
