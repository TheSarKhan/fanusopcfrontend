"use client";

/**
 * Hesab sahiblənmə (claim) — operator telefonla yaratdığı pasiyent hesabını
 * nömrəli OTP ilə aktivləşdirir. 2 addım: (1) email → kod göndər,
 * (2) kod + yeni parol → aktivləşdir. Mövcud randevular hesaba bağlı qalır.
 */

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { requestClaimOtp, verifyClaimOtp } from "@/lib/api";

export default function ClaimPage() {
  const params = useSearchParams();
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const sendCode = async () => {
    setErr(null); setInfo(null);
    if (!email.trim()) { setErr("Email daxil edin"); return; }
    setBusy(true);
    try {
      const r = await requestClaimOtp(email.trim());
      setInfo(r.message ?? "Kod göndərildi.");
      setStep("code");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const activate = async () => {
    setErr(null);
    if (!code.trim()) { setErr("Kodu daxil edin"); return; }
    // Qeydiyyatla eyni parol qaydası — ən az 8 simvol, böyük hərf, kiçik hərf, rəqəm.
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setErr("Şifrə ən az 8 simvol, böyük hərf, kiçik hərf və rəqəm ehtiva etməlidir.");
      return;
    }
    setBusy(true);
    try {
      await verifyClaimOtp({
        email: email.trim(), code: code.trim(), password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setStep("done");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const inp: React.CSSProperties = { width: "100%", padding: 11, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14, boxSizing: "border-box" };
  const btn: React.CSSProperties = { width: "100%", padding: 12, border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, background: "var(--brand)", color: "#fff", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, var(--brand-700) 0%, var(--brand) 100%)" }}>
      <div style={{ background: "#fff", borderRadius: "1.5rem", padding: "2.5rem", width: "100%", maxWidth: 420, boxShadow: "0 24px 80px rgba(0,0,0,0.3)" }}>
        <h2 className="text-xl font-bold text-[#1A2535]" style={{ marginBottom: 6 }}>Hesabı aktivləşdir</h2>
        <p className="text-[#52718F] text-sm" style={{ marginBottom: 18 }}>
          Operator sizin üçün hesab yaradıbsa, email-inizə gələn kodla aktivləşdirin. Mövcud randevularınız hesabınıza bağlı qalacaq.
        </p>

        {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{err}</div>}
        {info && step === "code" && <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", color: "#065F46", padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{info}</div>}

        {step === "email" && (
          <div style={{ display: "grid", gap: 12 }}>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email ünvanınız" style={inp} autoFocus />
            <button onClick={sendCode} disabled={busy} style={btn}>{busy ? "Göndərilir…" : "Kod göndər"}</button>
            <Link href="/login" className="text-[#52718F] text-sm" style={{ textAlign: "center" }}>Hesabınız var? Daxil ol</Link>
          </div>
        )}

        {step === "code" && (
          <div style={{ display: "grid", gap: 12 }}>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="6 rəqəmli kod" inputMode="numeric" maxLength={6}
              style={{ ...inp, letterSpacing: 6, textAlign: "center", fontWeight: 700, fontSize: 18 }} autoFocus />
            <div style={{ position: "relative" }}>
              <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Yeni parol (min 8 simvol, böyük hərf, rəqəm)" style={{ ...inp, paddingRight: 42 }} />
              <button type="button" onClick={() => setShowPw(s => !s)}
                aria-label={showPw ? "Parolu gizlət" : "Parolu göstər"} title={showPw ? "Parolu gizlət" : "Parolu göstər"}
                style={{ position: "absolute", top: "50%", right: 8, transform: "translateY(-50%)", background: "none", border: "none", padding: 4, cursor: "pointer", color: "#94A3B8", display: "inline-flex" }}>
                {showPw ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Ad (ops.)" style={inp} />
              <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Soyad (ops.)" style={inp} />
            </div>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Telefon (ops.)" style={inp} />
            <button onClick={activate} disabled={busy} style={btn}>{busy ? "Aktivləşdirilir…" : "Aktivləşdir"}</button>
            <button onClick={sendCode} disabled={busy} style={{ background: "none", border: "none", color: "var(--brand-700)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Kodu yenidən göndər</button>
          </div>
        )}

        {step === "done" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#065F46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#1A2535]" style={{ marginBottom: 6 }}>Hesab aktivləşdirildi!</h3>
            <p className="text-[#52718F] text-sm" style={{ marginBottom: 18 }}>İndi daxil ola və randevularınızı görə bilərsiniz.</p>
            <Link href="/login" className="block py-3 rounded-xl text-sm font-bold text-white" style={{ background: "var(--brand)" }}>Daxil ol</Link>
          </div>
        )}
      </div>
    </div>
  );
}
