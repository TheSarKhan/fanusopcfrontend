"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { login } from "@/lib/api";
import { buildPanelUrl } from "@/lib/auth";

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
    title: "100% Məxfi",
    sub: "Bütün söhbətlər şifrələnir",
  },
  {
    icon: (
      <svg width="18" height="18" fill="none" stroke="white" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: "15+ Mütəxəssis",
    sub: "Sertifikatlı psixoloqlar",
  },
  {
    icon: (
      <svg width="18" height="18" fill="none" stroke="white" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
    ),
    title: "7/24 Onlayn",
    sub: "İstənilən vaxt, istənilən yerdən",
  },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await login(email, password);
      window.location.href = buildPanelUrl(data.role, data.accessToken);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Giriş uğursuz oldu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split">
      {/* ── Form side ── */}
      <div className="auth-form-side">
        {/* Top bar */}
        <div className="auth-topbar">
          <Link href="/">
            <Image src="/images/logos/logo-blue.png" alt="Fanus" width={100} height={33} style={{ objectFit: "contain" }} priority />
          </Link>
          <Link href="/" className="auth-back-btn">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Sayta qayıt
          </Link>
        </div>

        {/* Centered form */}
        <div className="auth-form-center">
          <div className="auth-form-box">
            <h1 style={{ fontFamily: "var(--serif)", fontSize: 30, fontWeight: 500, color: "var(--oxford)", marginBottom: 6 }}>
              Xoş gəldiniz
            </h1>
            <p style={{ fontSize: 15, color: "var(--oxford-60)", marginBottom: 32 }}>
              Fanus hesabınıza daxil olun
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label className="auth-label">Email</label>
                <input
                  type="email"
                  className="auth-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@nümunə.az"
                  required
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label className="auth-label" style={{ marginBottom: 0 }}>Şifrə</label>
                  <Link href="/forgot-password" style={{ fontSize: 12.5, color: "var(--oxford-60)", textDecoration: "none" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--oxford)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--oxford-60)")}>
                    Şifrəni unutmuşam
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
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, color: "#B91C1C" }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ height: 50, fontSize: 15, borderRadius: 10, marginTop: 4 }}
              >
                {loading ? "Daxil olunur..." : "Daxil ol"}
              </button>
            </form>

            <p style={{ textAlign: "center", fontSize: 14, color: "var(--oxford-60)", marginTop: 28 }}>
              Hesabınız yoxdur?{" "}
              <Link href="/register" style={{ color: "var(--oxford)", fontWeight: 600, textDecoration: "none" }}>
                Qeydiyyat
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* ── Decorative panel ── */}
      <div className="auth-panel">
        <div className="auth-panel-blob auth-panel-blob-1" />
        <div className="auth-panel-blob auth-panel-blob-2" />
        <div className="auth-panel-content">
          <Image src="/images/logos/logo-white.png" alt="Fanus" width={110} height={36} style={{ objectFit: "contain" }} />
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
