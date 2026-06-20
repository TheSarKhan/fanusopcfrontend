"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { meApi, patientApi, type AccountStatus, type EmergencyContact, type MeProfile } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";

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

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const months = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function initialsOf(me: MeProfile) {
  const a = (me.firstName?.[0] ?? "").toUpperCase();
  const b = (me.lastName?.[0] ?? "").toUpperCase();
  const both = (a + b).trim();
  return both || (me.email[0] ?? "?").toUpperCase();
}

export interface ProfileShellProps {
  /** Optional role-specific cards rendered below the main forms (full main-column width). */
  extras?: React.ReactNode;
  /** Optional role-specific cards rendered in the right side column ABOVE the default Hesab durumu card. */
  sideExtras?: React.ReactNode;
  /** Optional title override (defaults to "Profil") */
  title?: string;
  /** Subtitle below title */
  subtitle?: string;
}

/** Unified profile page shell used by every panel role. Renders identity hero + 2-col
 *  grid (forms on the left, status/activity sidebar on the right). */
export default function ProfileShell({ extras, sideExtras, title = "Profil", subtitle }: ProfileShellProps) {
  const [me, setMe] = useState<MeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // GDPR account status — drives the pending-deletion banner. Fetched alongside
  // the profile so the user sees "cancel deletion" instantly after login.
  const [status, setStatus] = useState<AccountStatus | null>(null);

  const refreshStatus = useCallback(() => {
    meApi.accountStatus().then(setStatus).catch(() => { /* non-fatal */ });
  }, []);

  useEffect(() => {
    meApi.get()
      .then(setMe)
      .catch(e => setErr((e as Error).message))
      .finally(() => setLoading(false));
    refreshStatus();
  }, [refreshStatus]);

  if (loading) return <div className="uprof-page"><div className="uprof-loading">Yüklənir…</div></div>;
  if (err || !me) return <div className="uprof-page"><div className="uprof-error">{err || "Profil yüklənə bilmədi"}</div></div>;

  return (
    <div className="uprof-page">
      <header className="uprof-page-head">
        <div>
          <p className="uprof-eyebrow">{ROLE_LABEL[me.role] ?? me.role}</p>
          <h1 className="uprof-title">{title}</h1>
          {subtitle && <p className="uprof-sub">{subtitle}</p>}
        </div>
      </header>

      {status?.deletionRequestedAt && (
        <DeletionBanner status={status} onCancelled={refreshStatus} />
      )}

      <IdentityHero me={me} onChanged={setMe} />

      <div className="uprof-grid">
        <div className="uprof-main">
          <BasicInfoCard me={me} onUpdated={setMe} />
          {me.role === "PATIENT" && <EmergencyContactCard />}
          <PasswordCard />
          {extras}
          <PrivacyCard email={me.email} status={status} onStatusChanged={refreshStatus} />
        </div>
        <aside className="uprof-side">
          {sideExtras}
          <AccountStatusCard me={me} />
          <ActivityShortcutCard role={me.role} />
        </aside>
      </div>
    </div>
  );
}

/* ─── Pending-deletion banner (top of every panel profile page) ──────────── */

function DeletionBanner({ status, onCancelled }: { status: AccountStatus; onCancelled: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const purgeDate = status.deletionRequestedAt
    ? new Date(new Date(status.deletionRequestedAt).getTime() + 30 * 24 * 60 * 60 * 1000)
    : null;
  const purgeLabel = purgeDate ? fmtDate(purgeDate.toISOString()) : "—";

  const onCancel = async () => {
    if (!confirm("Hesab silmə tələbini ləğv etmək istəyirsiniz?")) return;
    setErr(null);
    setBusy(true);
    try {
      await meApi.cancelDeletionRequest();
      onCancelled();
    } catch (e) {
      setErr((e as Error).message || "Ləğv etmə uğursuz oldu");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="alert"
      style={{
        border: "1px solid #f0b4b4",
        background: "#fff5f5",
        color: "#7a1f1f",
        padding: "14px 18px",
        borderRadius: 12,
        marginBottom: 20,
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ flex: "1 1 320px" }}>
        <strong>Hesabınız {purgeLabel} tarixində silinəcək</strong>
        <div style={{ fontSize: 13, marginTop: 4 }}>
          Silmə tələbi qüvvədədir ({status.daysUntilPurge} gün qalır). Bu müddət ərzində
          tələbi ləğv etsəniz, hesabınız tam aktiv olacaq.
        </div>
        {err && <div style={{ color: "#b00020", fontSize: 13, marginTop: 6 }}>{err}</div>}
      </div>
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="uprof-btn uprof-btn--primary"
      >
        {busy ? "Ləğv edilir…" : "Silmə tələbini ləğv et"}
      </button>
    </div>
  );
}

/* ─── Identity hero (full-width strip) ───────────────────────────────────── */

function IdentityHero({ me, onChanged }: { me: MeProfile; onChanged: (m: MeProfile) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSelectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErr(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("Yalnız şəkil faylı seçə bilərsiniz"); return; }
    if (file.size > 5 * 1024 * 1024) { setErr("Şəkil ölçüsü 5MB-dan böyük ola bilməz"); return; }
    setUploading(true);
    try {
      const { url } = await meApi.uploadPhoto(file);
      onChanged({ ...me, photoUrl: url });
    } catch (e) { setErr((e as Error).message || "Yükləmə uğursuz oldu"); }
    finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onRemove = async () => {
    if (!confirm("Profil şəklini silmək istəyirsiniz?")) return;
    setErr(null);
    setRemoving(true);
    try {
      await meApi.deletePhoto();
      onChanged({ ...me, photoUrl: null });
    } catch (e) { setErr((e as Error).message || "Silmə uğursuz oldu"); }
    finally { setRemoving(false); }
  };

  const fullName = (me.firstName || me.lastName) ? `${me.firstName ?? ""} ${me.lastName ?? ""}`.trim() : "—";

  return (
    <section className="uprof-hero">
      <div className="uprof-hero-bg" aria-hidden />
      <div className="uprof-hero-main">
        <button
          type="button"
          className="uprof-hero-avatar"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-label="Profil şəklini dəyişdir"
          title={uploading ? "Yüklənir…" : "Şəkli dəyişdir"}
        >
          {me.photoUrl ? (
            <Image
              src={me.photoUrl}
              alt={me.firstName ?? me.email}
              width={96}
              height={96}
              unoptimized
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span>{initialsOf(me)}</span>
          )}
          {uploading && <span className="uprof-hero-spin" aria-hidden>⟳</span>}
        </button>

        <div className="uprof-hero-info">
          <h2 className="uprof-hero-name">{fullName}</h2>
          <p className="uprof-hero-email">{me.email}</p>
          <div className="uprof-hero-meta">
            <span className="uprof-pill">{ROLE_LABEL[me.role] ?? me.role}</span>
            {me.emailVerified ? (
              <span className="uprof-pill uprof-pill--good">Email təsdiqli</span>
            ) : (
              <span className="uprof-pill uprof-pill--warn">Email təsdiqsiz</span>
            )}
            {me.lastLogin && (
              <span className="uprof-pill-soft">Son giriş: {fmtDateTime(me.lastLogin)}</span>
            )}
          </div>
        </div>

        <div className="uprof-hero-actions">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="uprof-hero-btn uprof-hero-btn--primary"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7h4l2-3h6l2 3h4v13H3z" /><circle cx="12" cy="13" r="4" />
            </svg>
            {uploading ? "Yüklənir…" : me.photoUrl ? "Şəkli dəyişdir" : "Şəkil yüklə"}
          </button>
          {me.photoUrl && (
            <button
              type="button"
              onClick={onRemove}
              disabled={removing}
              className="uprof-hero-btn uprof-hero-btn--ghost"
            >
              {removing ? "..." : "Sil"}
            </button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onSelectFile}
          style={{ display: "none" }}
        />
      </div>
      {err && <div className="uprof-hero-err">{err}</div>}
    </section>
  );
}

/* ─── Right column default cards ─────────────────────────────────────────── */

function AccountStatusCard({ me }: { me: MeProfile }) {
  return (
    <div className="uprof-card uprof-side-card">
      <div className="uprof-side-card-head">
        <h3>Hesab durumu</h3>
      </div>
      <dl className="uprof-side-list">
        <div>
          <dt>Rol</dt>
          <dd>{ROLE_LABEL[me.role] ?? me.role}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{me.emailVerified ? <span className="uprof-status uprof-status--good">Təsdiqli</span> : <span className="uprof-status uprof-status--warn">Təsdiq edilməyib</span>}</dd>
        </div>
        <div>
          <dt>Son giriş</dt>
          <dd>{me.lastLogin ? fmtDateTime(me.lastLogin) : "—"}</dd>
        </div>
        <div>
          <dt>Üzv olub</dt>
          <dd>{fmtDate(me.createdAt)}</dd>
        </div>
      </dl>
    </div>
  );
}

function ActivityShortcutCard({ role }: { role: string }) {
  const base = role === "PSYCHOLOGIST" ? "/psycholog"
             : role === "OPERATOR"     ? "/operator"
             : role === "ADMIN"        ? "/admin"
             : "/patient";
  return (
    <div className="uprof-card uprof-side-card">
      <div className="uprof-side-card-head">
        <h3>Aktivlik</h3>
      </div>
      <Link href={`${base}/notifications`} className="uprof-side-link">
        <div className="uprof-side-link-icon"></div>
        <div className="uprof-side-link-text">
          <strong>Bildirişlər</strong>
          <small>Bütün bildirişlərinizə baxın</small>
        </div>
        <span className="uprof-side-link-arrow">›</span>
      </Link>
    </div>
  );
}

/* ─── Main column forms ──────────────────────────────────────────────────── */

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
    } catch (e) { setErr((e as Error).message || "Yenilənmə uğursuz oldu"); }
    finally { setSaving(false); }
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
          {savedAt && <span className="uprof-saved">Yadda saxlanıldı</span>}
          <button type="submit" disabled={!dirty || saving} className="uprof-btn uprof-btn--primary">
            {saving ? "Saxlanılır…" : "Yadda saxla"}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ─── Patient-only emergency contact (Modul G) ──────────────────────────────
 * Role-gated upstream (rendered only when me.role === "PATIENT") so that
 * patient-only fields never leak into psychologist/operator/admin profiles. */
function EmergencyContactCard() {
  const { t } = useT();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    patientApi.getEmergencyContact()
      .then(data => {
        if (cancelled) return;
        setName(data.emergencyContactName ?? "");
        setPhone(data.emergencyContactPhone ?? "");
        setRelation(data.emergencyContactRelation ?? "");
        setAddress(data.residentialAddress ?? "");
      })
      .catch(() => { /* non-fatal — empty form */ });
    return () => { cancelled = true; };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      const payload: EmergencyContact = {
        emergencyContactName: name.trim() || null,
        emergencyContactPhone: phone.trim() || null,
        emergencyContactRelation: relation.trim() || null,
        residentialAddress: address.trim() || null,
      };
      await patientApi.updateEmergencyContact(payload);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    } catch (e) { setErr((e as Error).message || "Yenilənmə uğursuz oldu"); }
    finally { setSaving(false); }
  };

  return (
    <form className="uprof-card" onSubmit={submit}>
      <div className="uprof-card-head">
        <h2>{t("emergency.sectionTitle")}</h2>
        <p>{t("emergency.note")}</p>
      </div>
      <div className="uprof-form">
        <div className="uprof-grid-2">
          <div className="uprof-field">
            <label>{t("emergency.contactName")}</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={t("emergency.contactNamePh")} maxLength={100} />
          </div>
          <div className="uprof-field">
            <label>{t("emergency.contactPhone")}</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder={t("emergency.contactPhonePh")} maxLength={30} />
          </div>
        </div>
        <div className="uprof-field">
          <label>{t("emergency.contactRelation")}</label>
          <input value={relation} onChange={e => setRelation(e.target.value)} placeholder={t("emergency.contactRelationPh")} maxLength={100} />
        </div>
        <div className="uprof-field">
          <label>{t("emergency.address")}</label>
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder={t("emergency.addressPh")} maxLength={255} />
        </div>

        {err && <div className="uprof-error-inline">{err}</div>}

        <div className="uprof-actions">
          {savedAt && <span className="uprof-saved">{t("emergency.saved")}</span>}
          <button type="submit" disabled={saving} className="uprof-btn uprof-btn--primary">
            {saving ? "Saxlanılır…" : t("emergency.save")}
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
    if (next.length < 8) { setErr("Yeni şifrə ən azı 8 simvol olmalıdır"); return; }
    if (next !== confirm) { setErr("Yeni şifrə təkrarı uyğun deyil"); return; }
    setSaving(true);
    try {
      await meApi.changePassword({ currentPassword: current, newPassword: next });
      setCurrent(""); setNext(""); setConfirm("");
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 3000);
    } catch (e) { setErr((e as Error).message || "Şifrə dəyişmə uğursuz oldu"); }
    finally { setSaving(false); }
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
          {savedAt && <span className="uprof-saved">Şifrə yeniləndi</span>}
          <button type="submit" disabled={!current || !next || !confirm || saving} className="uprof-btn uprof-btn--primary">
            {saving ? "Yenilənir…" : "Şifrəni yenilə"}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ─── Privacy / GDPR card (data export + delete account) ─────────────── */

function PrivacyCard({
  email,
  status,
  onStatusChanged,
}: {
  email: string;
  status: AccountStatus | null;
  onStatusChanged: () => void;
}) {
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const [cancelling, setCancelling] = useState(false);
  const [cancelErr, setCancelErr] = useState<string | null>(null);

  const onExport = async () => {
    setExportErr(null); setExporting(true);
    try {
      await meApi.exportData();
    } catch (e) { setExportErr((e as Error).message); }
    finally { setExporting(false); }
  };

  const onDelete = async () => {
    setDeleteErr(null);
    if (!pwd) { setDeleteErr("Şifrənizi daxil edin"); return; }
    if (confirmText.trim().toUpperCase() !== "SİL"
        && confirmText.trim().toLowerCase() !== email.toLowerCase()) {
      setDeleteErr("Təsdiq sahəsinə \"SİL\" və ya email yazın");
      return;
    }
    setDeleting(true);
    try {
      await meApi.deleteAccount({ currentPassword: pwd, confirmation: confirmText });
      setDeleteOpen(false);
      setPwd(""); setConfirmText("");
      onStatusChanged();
    } catch (e) {
      setDeleteErr((e as Error).message);
    } finally { setDeleting(false); }
  };

  const onCancelDeletion = async () => {
    setCancelErr(null);
    setCancelling(true);
    try {
      await meApi.cancelDeletionRequest();
      onStatusChanged();
    } catch (e) {
      setCancelErr((e as Error).message);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="uprof-card uprof-card--privacy">
      <h2 className="uprof-card-title">Məxfilik və data</h2>
      <p className="uprof-card-sub">
        GDPR çərçivəsində məlumatlarınıza tam çıxışınız var.
      </p>

      <div className="uprof-priv-row">
        <div className="uprof-priv-info">
          <strong>Datalarımı yüklə</strong>
          <small>Profil, randevu, rəy və bildirişlərinizin tam arxivini ZIP olaraq alın.</small>
        </div>
        <button onClick={onExport} disabled={exporting}
          className="uprof-btn uprof-btn--ghost">
          {exporting ? "Hazırlanır…" : "Yüklə"}
        </button>
      </div>
      {exportErr && <div className="uprof-error-inline">{exportErr}</div>}

      <div className="uprof-priv-row uprof-priv-row--danger">
        <div className="uprof-priv-info">
          <strong>Hesabımı sil</strong>
          {status?.deletionRequestedAt ? (
            <small>
              Silmə tələbi qüvvədədir — {status.daysUntilPurge} gün qalır.
              İstənilən anda ləğv edə bilərsiniz.
            </small>
          ) : (
            <small>30 gün gözləmə müddətindən sonra bütün data tamamilə silinəcək.</small>
          )}
        </div>
        {status?.deletionRequestedAt ? (
          <button
            onClick={onCancelDeletion}
            disabled={cancelling}
            className="uprof-btn uprof-btn--primary"
          >
            {cancelling ? "Ləğv edilir…" : "Silmə tələbini ləğv et"}
          </button>
        ) : (
          !deleteOpen && (
            <button onClick={() => setDeleteOpen(true)} className="uprof-btn uprof-btn--danger">
              Sil
            </button>
          )
        )}
      </div>
      {cancelErr && <div className="uprof-error-inline">{cancelErr}</div>}

      {deleteOpen && !status?.deletionRequestedAt && (
        <div className="uprof-priv-confirm">
          <p>
            <strong>Diqqət:</strong> bu əməliyyat geri qaytarıla bilməz.
            Hesabınız 30 gün gözləmə müddətindən sonra tamamilə silinəcək.
            Bu müddət ərzində sistemə girə bilməyəcəksiniz, gələcək randevular avtomatik ləğv olunur.
          </p>
          <label>
            <span>Cari şifrə</span>
            <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} autoComplete="current-password" />
          </label>
          <label>
            <span>Təsdiq üçün <strong>SİL</strong> və ya email yazın</span>
            <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="SİL" />
          </label>
          {deleteErr && <div className="uprof-error-inline">{deleteErr}</div>}
          <div className="uprof-actions">
            <button onClick={() => { setDeleteOpen(false); setPwd(""); setConfirmText(""); setDeleteErr(null); }}
              className="uprof-btn uprof-btn--ghost" disabled={deleting}>
              Ləğv
            </button>
            <button onClick={onDelete} disabled={deleting} className="uprof-btn uprof-btn--danger">
              {deleting ? "Göndərilir…" : "Hesabımı sil"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
