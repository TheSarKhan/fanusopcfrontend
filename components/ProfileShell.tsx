"use client";

import { useEffect, useState } from "react";
import { meApi, type MeProfile } from "@/lib/api";

const ROLE_LABEL: Record<string, string> = {
  PATIENT: "Pasiyent",
  PSYCHOLOGIST: "Psixoloq",
  OPERATOR: "Operator",
  ADMIN: "Administrator",
};

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function initialsOf(me: MeProfile) {
  const a = (me.firstName?.[0] ?? "").toUpperCase();
  const b = (me.lastName?.[0] ?? "").toUpperCase();
  const both = (a + b).trim();
  return both || (me.email[0] ?? "?").toUpperCase();
}

export interface ProfileShellProps {
  /** Optional role-specific extension rendered below the basic info card */
  extras?: React.ReactNode;
  /** Optional title override (defaults to "Profil") */
  title?: string;
  /** Subtitle below title */
  subtitle?: string;
}

/** Unified profile page shell used by every panel role. Handles basic
 *  user info (name, phone) + password change in a consistent layout. */
export default function ProfileShell({ extras, title = "Profil", subtitle }: ProfileShellProps) {
  const [me, setMe] = useState<MeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    meApi.get()
      .then(setMe)
      .catch(e => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="uprof-page">
        <div className="uprof-loading">Yüklənir…</div>
      </div>
    );
  }

  if (err || !me) {
    return (
      <div className="uprof-page">
        <div className="uprof-error">{err || "Profil yüklənə bilmədi"}</div>
      </div>
    );
  }

  return (
    <div className="uprof-page">
      <header className="uprof-header">
        <div>
          <p className="uprof-eyebrow">{ROLE_LABEL[me.role] ?? me.role}</p>
          <h1 className="uprof-title">{title}</h1>
          {subtitle && <p className="uprof-sub">{subtitle}</p>}
        </div>
      </header>

      {/* Identity card */}
      <div className="uprof-card uprof-card--identity">
        <div className="uprof-avatar">{initialsOf(me)}</div>
        <div className="uprof-identity-info">
          <div className="uprof-identity-name">
            {(me.firstName || me.lastName) ? `${me.firstName ?? ""} ${me.lastName ?? ""}`.trim() : "—"}
          </div>
          <div className="uprof-identity-email">{me.email}</div>
          <div className="uprof-identity-meta">
            <span className="uprof-pill">{ROLE_LABEL[me.role] ?? me.role}</span>
            {me.emailVerified ? (
              <span className="uprof-pill uprof-pill--good">✓ Email təsdiqli</span>
            ) : (
              <span className="uprof-pill uprof-pill--warn">Email təsdiqsiz</span>
            )}
            {me.lastLogin && <span className="uprof-pill-soft">Son giriş: {fmtDateTime(me.lastLogin)}</span>}
          </div>
        </div>
      </div>

      {/* Basic info form */}
      <BasicInfoCard me={me} onUpdated={setMe} />

      {/* Password card */}
      <PasswordCard />

      {/* Role-specific extras */}
      {extras}
    </div>
  );
}

function BasicInfoCard({ me, onUpdated }: { me: MeProfile; onUpdated: (m: MeProfile) => void }) {
  const [firstName, setFirstName] = useState(me.firstName ?? "");
  const [lastName, setLastName] = useState(me.lastName ?? "");
  const [phone, setPhone] = useState(me.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const dirty =
    (firstName.trim() || null) !== (me.firstName ?? null) ||
    (lastName.trim() || null) !== (me.lastName ?? null) ||
    (phone.trim() || null) !== (me.phone ?? null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      const updated = await meApi.update({
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        phone: phone.trim() || null,
      });
      onUpdated(updated);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    } catch (e) {
      setErr((e as Error).message || "Yenilənmə uğursuz oldu");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="uprof-card" onSubmit={submit}>
      <div className="uprof-card-head">
        <h2>Şəxsi məlumatlar</h2>
        <p>Adınız, soyadınız və əlaqə nömrəsi</p>
      </div>
      <div className="uprof-form">
        <div className="uprof-grid-2">
          <div className="uprof-field">
            <label>Ad</label>
            <input value={firstName} onChange={e => setFirstName(e.target.value)} maxLength={100} />
          </div>
          <div className="uprof-field">
            <label>Soyad</label>
            <input value={lastName} onChange={e => setLastName(e.target.value)} maxLength={100} />
          </div>
        </div>
        <div className="uprof-field">
          <label>Email</label>
          <input value={me.email} disabled />
          <small>Email dəyişmək üçün dəstək komandamızla əlaqə saxlayın</small>
        </div>
        <div className="uprof-field">
          <label>Telefon</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+994 50 000 00 00" maxLength={30} />
        </div>

        {err && <div className="uprof-error-inline">{err}</div>}

        <div className="uprof-actions">
          {savedAt && <span className="uprof-saved">✓ Yadda saxlanıldı</span>}
          <button type="submit" disabled={!dirty || saving} className="uprof-btn uprof-btn--primary">
            {saving ? "Saxlanılır…" : "Yadda saxla"}
          </button>
        </div>
      </div>
    </form>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (next.length < 8) {
      setErr("Yeni şifrə ən azı 8 simvol olmalıdır");
      return;
    }
    if (next !== confirm) {
      setErr("Yeni şifrə təkrarı uyğun deyil");
      return;
    }
    setSaving(true);
    try {
      await meApi.changePassword({ currentPassword: current, newPassword: next });
      setCurrent(""); setNext(""); setConfirm("");
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 3000);
    } catch (e) {
      setErr((e as Error).message || "Şifrə dəyişmə uğursuz oldu");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="uprof-card" onSubmit={submit}>
      <div className="uprof-card-head">
        <h2>Şifrə</h2>
        <p>Hesabınızın təhlükəsizliyi üçün şifrəni mütəmadi yeniləyin</p>
      </div>
      <div className="uprof-form">
        <div className="uprof-field">
          <label>Cari şifrə</label>
          <input type="password" value={current} onChange={e => setCurrent(e.target.value)} required />
        </div>
        <div className="uprof-grid-2">
          <div className="uprof-field">
            <label>Yeni şifrə</label>
            <input type="password" value={next} onChange={e => setNext(e.target.value)} required minLength={8} />
            <small>Ən azı 8 simvol</small>
          </div>
          <div className="uprof-field">
            <label>Yeni şifrə təkrarı</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          </div>
        </div>

        {err && <div className="uprof-error-inline">{err}</div>}

        <div className="uprof-actions">
          {savedAt && <span className="uprof-saved">✓ Şifrə yeniləndi</span>}
          <button type="submit" disabled={!current || !next || !confirm || saving} className="uprof-btn uprof-btn--primary">
            {saving ? "Yenilənir…" : "Şifrəni yenilə"}
          </button>
        </div>
      </div>
    </form>
  );
}
