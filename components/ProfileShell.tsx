"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { meApi, patientApi, revalidatePsychologistsCache, type AccountStatus, type EmergencyContact, type MeProfile } from "@/lib/api";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import AvatarCropModal from "@/components/AvatarCropModal";

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

const ROLES = ["PATIENT", "PSYCHOLOGIST", "OPERATOR", "ADMIN"];

/** Backend rol kodunu görünən ada çevirir; naməlum kod olduğu kimi qalır. */
function roleLabel(t: Translate, role: string) {
  return ROLES.includes(role) ? t(`roleLabel.${role}` as MessageKey) : role;
}

/* ─── Şifrə sahəsi + göz düyməsi (login/register ilə eyni ikon) ───────── */
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

function PasswordInput({
  value, onChange, autoComplete, required,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  const { t } = useT();
  const [show, setShow] = useState(false);
  return (
    <span className="uprof-pw">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
      />
      <button
        type="button"
        className="uprof-pw__eye"
        onClick={() => setShow(v => !v)}
        aria-label={show ? t("uprof.pwHide") : t("uprof.pwShow")}
      >
        <EyeIcon open={show} />
      </button>
    </span>
  );
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtDate(t: Translate, iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getDate()} ${t(`months.m${d.getMonth() + 1}` as MessageKey)} ${d.getFullYear()}`;
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
  /** Optional title override (defaults to the localized "Profile") */
  title?: string;
  /** Subtitle below title */
  subtitle?: string;
}

/** Unified profile page shell used by every panel role. Renders identity hero + 2-col
 *  grid (forms on the left, status/activity sidebar on the right). */
export default function ProfileShell({ extras, sideExtras, title, subtitle }: ProfileShellProps) {
  const { t } = useT();
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

  if (loading) return <div className="uprof-page"><div className="uprof-loading">{t("uprof.loading")}</div></div>;
  if (err || !me) return <div className="uprof-page"><div className="uprof-error">{err || t("uprof.loadError")}</div></div>;

  return (
    <div className="uprof-page">
      <header className="uprof-page-head">
        <div>
          {/* Rol etiketi (uppercase eyebrow) silindi — kit qaydası. Rol onsuz da
              aşağıdakı kimlik kartında və "Hesab" siyahısında görünür. */}
          <h1 className="uprof-title">{title ?? t("uprof.titleDefault")}</h1>
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
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Avtomatik silinmə tarixi YOXDUR — qərarı admin verir. Ona görə "neçə gün
  // qalıb" sayğacı əvəzinə istəyin göndərildiyi tarix göstərilir.
  const requestedLabel = status.deletionRequestedAt ? fmtDate(t, status.deletionRequestedAt) : "—";

  const onCancel = async () => {
    if (!confirm(t("uprof.delCancelConfirm"))) return;
    setErr(null);
    setBusy(true);
    try {
      await meApi.cancelDeletionRequest();
      onCancelled();
    } catch (e) {
      setErr((e as Error).message || t("uprof.delCancelFailed"));
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
        <strong>{t("uprof.delBannerTitle")}</strong>
        <div style={{ fontSize: 13, marginTop: 4 }}>
          {t("uprof.delBannerBody", { date: requestedLabel })}
        </div>
        {err && <div style={{ color: "#b00020", fontSize: 13, marginTop: 6 }}>{err}</div>}
      </div>
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="uprof-btn uprof-btn--primary"
      >
        {busy ? t("uprof.delCancelling") : t("uprof.delCancelCta")}
      </button>
    </div>
  );
}

/* ─── Identity hero (full-width strip) ───────────────────────────────────── */

function IdentityHero({ me, onChanged }: { me: MeProfile; onChanged: (m: MeProfile) => void }) {
  const { t } = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErr(null);
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file after a cancelled crop
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr(t("uprof.photoOnlyImage")); return; }
    if (file.size > 5 * 1024 * 1024) { setErr(t("uprof.photoTooLarge")); return; }
    setPendingFile(file);
  };

  const onCropped = async (croppedFile: File) => {
    setUploading(true);
    try {
      const { url } = await meApi.uploadPhoto(croppedFile);
      onChanged({ ...me, photoUrl: url });
      window.dispatchEvent(new CustomEvent("profilePhotoChanged", { detail: { photoUrl: url } }));
      // The psychologist's photo also lives on their public /psychologists/[slug]
      // page, which Next.js caches — ping it so the change shows up immediately
      // instead of waiting for the passive revalidate window.
      if (me.role === "PSYCHOLOGIST") revalidatePsychologistsCache();
      setPendingFile(null);
    } finally {
      setUploading(false);
    }
  };

  const onRemove = async () => {
    if (!confirm(t("uprof.photoRemoveConfirm"))) return;
    setErr(null);
    setRemoving(true);
    try {
      await meApi.deletePhoto();
      onChanged({ ...me, photoUrl: null });
      window.dispatchEvent(new CustomEvent("profilePhotoChanged", { detail: { photoUrl: null } }));
      if (me.role === "PSYCHOLOGIST") revalidatePsychologistsCache();
    } catch (e) { setErr((e as Error).message || t("uprof.photoRemoveFailed")); }
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
          aria-label={t("uprof.avatarAria")}
          title={uploading ? t("uprof.uploading") : t("uprof.photoChange")}
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
            <span className="uprof-pill">{roleLabel(t, me.role)}</span>
            {me.emailVerified ? (
              <span className="uprof-pill uprof-pill--good">{t("uprof.emailVerifiedPill")}</span>
            ) : (
              <span className="uprof-pill uprof-pill--warn">{t("uprof.emailUnverifiedPill")}</span>
            )}
            {me.lastLogin && (
              <span className="uprof-pill-soft">{t("uprof.lastLoginPill", { when: fmtDateTime(me.lastLogin) })}</span>
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
            {uploading ? t("uprof.uploading") : me.photoUrl ? t("uprof.photoChange") : t("uprof.photoUpload")}
          </button>
          {me.photoUrl && (
            <button
              type="button"
              onClick={onRemove}
              disabled={removing}
              className="uprof-hero-btn uprof-hero-btn--ghost"
            >
              {removing ? "..." : t("uprof.photoDelete")}
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
      {pendingFile && (
        <AvatarCropModal
          file={pendingFile}
          onCancel={() => setPendingFile(null)}
          onCropped={onCropped}
        />
      )}
    </section>
  );
}

/* ─── Right column default cards ─────────────────────────────────────────── */

function AccountStatusCard({ me }: { me: MeProfile }) {
  const { t } = useT();
  return (
    <div className="uprof-card uprof-side-card">
      <div className="uprof-side-card-head">
        <h3>{t("uprof.statusTitle")}</h3>
      </div>
      <dl className="uprof-side-list">
        <div>
          <dt>{t("uprof.statusRole")}</dt>
          <dd>{roleLabel(t, me.role)}</dd>
        </div>
        <div>
          <dt>{t("uprof.statusEmail")}</dt>
          <dd>{me.emailVerified ? <span className="uprof-status uprof-status--good">{t("uprof.statusVerified")}</span> : <span className="uprof-status uprof-status--warn">{t("uprof.statusUnverified")}</span>}</dd>
        </div>
        <div>
          <dt>{t("uprof.statusLastLogin")}</dt>
          <dd>{me.lastLogin ? fmtDateTime(me.lastLogin) : "—"}</dd>
        </div>
        <div>
          <dt>{t("uprof.statusMemberSince")}</dt>
          <dd>{fmtDate(t, me.createdAt)}</dd>
        </div>
      </dl>
    </div>
  );
}

function ActivityShortcutCard({ role }: { role: string }) {
  const { t } = useT();
  const base = role === "PSYCHOLOGIST" ? "/psycholog"
             : role === "OPERATOR"     ? "/operator"
             : role === "ADMIN"        ? "/admin"
             : "/patient";
  return (
    <div className="uprof-card uprof-side-card">
      <div className="uprof-side-card-head">
        <h3>{t("uprof.activityTitle")}</h3>
      </div>
      <Link href={`${base}/notifications`} className="uprof-side-link">
        <div className="uprof-side-link-icon"></div>
        <div className="uprof-side-link-text">
          <strong>{t("uprof.activityNotifications")}</strong>
          <small>{t("uprof.activityNotificationsSub")}</small>
        </div>
        <span className="uprof-side-link-arrow">›</span>
      </Link>
    </div>
  );
}

/* ─── Main column forms ──────────────────────────────────────────────────── */

function BasicInfoCard({ me, onUpdated }: { me: MeProfile; onUpdated: (m: MeProfile) => void }) {
  const { t } = useT();
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
    } catch (e) { setErr((e as Error).message || t("uprof.updateFailed")); }
    finally { setSaving(false); }
  };

  return (
    <form className="uprof-card" onSubmit={submit}>
      <div className="uprof-card-head">
        <h2>{t("uprof.basicTitle")}</h2>
        <p>{t("uprof.basicSub")}</p>
      </div>
      <div className="uprof-form">
        <div className="uprof-grid-2">
          <div className="uprof-field">
            <label>{t("uprof.fFirstName")}</label>
            <input value={firstName} onChange={e => setFirstName(e.target.value)} maxLength={100} />
          </div>
          <div className="uprof-field">
            <label>{t("uprof.fLastName")}</label>
            <input value={lastName} onChange={e => setLastName(e.target.value)} maxLength={100} />
          </div>
        </div>
        <div className="uprof-field">
          <label>{t("uprof.fEmail")}</label>
          <input value={me.email} disabled />
          <small>{t("uprof.emailHint")}</small>
        </div>
        <div className="uprof-field">
          <label>{t("uprof.fPhone")}</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+994 50 000 00 00" maxLength={30} />
        </div>

        {err && <div className="uprof-error-inline">{err}</div>}

        <div className="uprof-actions">
          {savedAt && <span className="uprof-saved">{t("uprof.saved")}</span>}
          <button type="submit" disabled={!dirty || saving} className="uprof-btn uprof-btn--primary">
            {saving ? t("uprof.saving") : t("uprof.save")}
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
    } catch (e) { setErr((e as Error).message || t("uprof.updateFailed")); }
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
            {saving ? t("uprof.saving") : t("emergency.save")}
          </button>
        </div>
      </div>
    </form>
  );
}

function PasswordCard() {
  const { t } = useT();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (next.length < 8 || !/[A-Z]/.test(next) || !/[a-z]/.test(next) || !/[0-9]/.test(next)) {
      setErr(t("uprof.pwWeak"));
      return;
    }
    if (next !== confirm) { setErr(t("uprof.pwMismatch")); return; }
    setSaving(true);
    try {
      await meApi.changePassword({ currentPassword: current, newPassword: next });
      setCurrent(""); setNext(""); setConfirm("");
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 3000);
    } catch (e) { setErr((e as Error).message || t("uprof.pwChangeFailed")); }
    finally { setSaving(false); }
  };

  return (
    <form className="uprof-card" onSubmit={submit}>
      <div className="uprof-card-head">
        <h2>{t("uprof.pwTitle")}</h2>
        <p>{t("uprof.pwSub")}</p>
      </div>
      <div className="uprof-form">
        <div className="uprof-field">
          <label>{t("uprof.pwCurrent")}</label>
          <PasswordInput value={current} onChange={setCurrent} autoComplete="current-password" required />
        </div>
        <div className="uprof-grid-2">
          <div className="uprof-field">
            <label>{t("uprof.pwNew")}</label>
            <PasswordInput value={next} onChange={setNext} autoComplete="new-password" required />
            <small>{t("uprof.pwHint")}</small>
          </div>
          <div className="uprof-field">
            <label>{t("uprof.pwRepeat")}</label>
            <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" required />
          </div>
        </div>

        {err && <div className="uprof-error-inline">{err}</div>}

        <div className="uprof-actions">
          {savedAt && <span className="uprof-saved">{t("uprof.pwUpdated")}</span>}
          <button type="submit" disabled={!current || !next || !confirm || saving} className="uprof-btn uprof-btn--primary">
            {saving ? t("uprof.pwUpdating") : t("uprof.pwSubmit")}
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
  const { t } = useT();
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  // Opsional səbəb — admin istəyi nəzərdən keçirəndə görür (V123).
  const [reason, setReason] = useState("");

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
    if (!pwd) { setDeleteErr(t("uprof.delErrPwd")); return; }
    // "SİL" backend-ə göndərilən təsdiq sözüdür — tərcümə OLUNMUR.
    if (confirmText.trim().toUpperCase() !== "SİL"
        && confirmText.trim().toLowerCase() !== email.toLowerCase()) {
      setDeleteErr(t("uprof.delErrConfirm"));
      return;
    }
    setDeleting(true);
    try {
      await meApi.deleteAccount({
        currentPassword: pwd,
        confirmation: confirmText,
        reason: reason.trim() || undefined,
      });
      setDeleteOpen(false);
      setPwd(""); setConfirmText(""); setReason("");
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
      <h2 className="uprof-card-title">{t("uprof.privTitle")}</h2>
      <p className="uprof-card-sub">
        {t("uprof.privSub")}
      </p>

      <div className="uprof-priv-row">
        <div className="uprof-priv-info">
          <strong>{t("uprof.exportTitle")}</strong>
          <small>{t("uprof.exportSub")}</small>
        </div>
        <button onClick={onExport} disabled={exporting}
          className="uprof-btn uprof-btn--ghost">
          {exporting ? t("uprof.exportPreparing") : t("uprof.exportCta")}
        </button>
      </div>
      {exportErr && <div className="uprof-error-inline">{exportErr}</div>}

      <div className="uprof-priv-row uprof-priv-row--danger">
        <div className="uprof-priv-info">
          <strong>{t("uprof.delTitle")}</strong>
          {status?.deletionRequestedAt ? (
            <small>
              {t("uprof.delPendingSub")}
            </small>
          ) : (
            <small>
              {t("uprof.delSub")}
            </small>
          )}
        </div>
        {status?.deletionRequestedAt ? (
          <button
            onClick={onCancelDeletion}
            disabled={cancelling}
            className="uprof-btn uprof-btn--primary"
          >
            {cancelling ? t("uprof.delCancelling") : t("uprof.delCancelCta")}
          </button>
        ) : (
          !deleteOpen && (
            <button onClick={() => setDeleteOpen(true)} className="uprof-btn uprof-btn--danger">
              {t("uprof.delCta")}
            </button>
          )
        )}
      </div>
      {cancelErr && <div className="uprof-error-inline">{cancelErr}</div>}

      {deleteOpen && !status?.deletionRequestedAt && (
        <div className="uprof-priv-confirm">
          <p>
            <strong>{t("uprof.delWarnStrong")}</strong> {t("uprof.delWarnBody")}
          </p>
          <label>
            <span>{t("uprof.pwCurrent")}</span>
            <PasswordInput value={pwd} onChange={setPwd} autoComplete="current-password" />
          </label>
          <label>
            <span>{t("uprof.delConfirmPre")} <strong>SİL</strong> {t("uprof.delConfirmPost")}</span>
            <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="SİL" />
          </label>
          <label>
            <span>{t("uprof.delReasonLabel")}</span>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={t("uprof.delReasonPh")}
              style={{ resize: "vertical" }}
            />
          </label>
          {deleteErr && <div className="uprof-error-inline">{deleteErr}</div>}
          <div className="uprof-actions">
            <button onClick={() => { setDeleteOpen(false); setPwd(""); setConfirmText(""); setDeleteErr(null); }}
              className="uprof-btn uprof-btn--ghost" disabled={deleting}>
              {t("uprof.cancelShort")}
            </button>
            <button onClick={onDelete} disabled={deleting} className="uprof-btn uprof-btn--danger">
              {deleting ? t("uprof.delSending") : t("uprof.delSubmit")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
