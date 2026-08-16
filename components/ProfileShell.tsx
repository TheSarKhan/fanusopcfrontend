"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { meApi, patientApi, revalidatePsychologistsCache, type AccountStatus, type EmergencyContact, type MeProfile } from "@/lib/api";
import { azFormatDate, azFormatDateTime } from "@/lib/datetime";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import AvatarCropModal from "@/components/AvatarCropModal";
import { toast } from "@/components/Toast";

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

const ROLES = ["PATIENT", "PSYCHOLOGIST", "OPERATOR", "ADMIN"];

/** Backend rol kodunu görünən ada çevirir; naməlum kod olduğu kimi qalır.
 *  PSYCHOLOGIST öz panelində "Mütəxəssis" kimi göstərilir (bax prof.roleLabelPsychologist)
 *  — digər yerlərdə (məs. HomeworkDetailModal-da aktor etiketi) `roleLabel.PSYCHOLOGIST`
 *  ("Psixoloq") toxunulmadan qalır, bu dəyişiklik yalnız bura aiddir. */
function roleLabel(t: Translate, role: string) {
  if (role === "PSYCHOLOGIST") return t("prof.roleLabelPsychologist");
  return ROLES.includes(role) ? t(`roleLabel.${role}` as MessageKey) : role;
}

/* ─── Dizayn tokenləri (Claude Design referansından 1:1) ─────────────────── */

export const PC = {
  ink: "#12171a",
  mut: "#565f63",
  soft: "#6d767a",
  faint: "#8c9599",
  dim: "#a3abae",
  border: "#e3e7e7",
  border2: "#dde2e2",
  border3: "#c9cfd0",
  hair: "#edf0f0",
  bg: "#f5f7f7",
  panel: "#f8fafa",
  green: "#2f5d50",
} as const;

export const cardStyle: React.CSSProperties = {
  border: `1px solid ${PC.border}`, borderRadius: 12, background: "#fff", padding: 22,
};
export const sideCardStyle: React.CSSProperties = {
  border: `1px solid ${PC.border}`, borderRadius: 12, background: "#fff", padding: 20,
};
export const sectionH2: React.CSSProperties = {
  fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", margin: 0, color: PC.ink,
};
export const sectionSub: React.CSSProperties = {
  fontSize: 12.5, color: PC.soft, lineHeight: 1.55, margin: "5px 0 0",
};
export const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 500, color: PC.soft, marginBottom: 6,
};
export const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", fontSize: 13.5, color: PC.ink,
  background: "#fff", border: `1px solid ${PC.border2}`, borderRadius: 8,
  padding: "9px 11px", outline: "none",
};
export const inputReadonlyStyle: React.CSSProperties = {
  ...inputStyle, color: PC.faint, background: "#f7f9f9", border: "1px solid #e9edee",
};
export const btnDark: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600,
  color: "#fff", background: PC.ink, border: `1px solid ${PC.ink}`, borderRadius: 8,
  padding: "9px 16px", cursor: "pointer",
};
export const btnGhost: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600,
  color: PC.ink, background: "#fff", border: `1px solid ${PC.border2}`, borderRadius: 8,
  padding: "8px 13px", cursor: "pointer",
};
export const btnIdle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600,
  color: PC.dim, background: "#f2f5f5", border: "1px solid #e9edee", borderRadius: 8,
  padding: "9px 16px",
};
export const rowSplit: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
  padding: "11px 0", borderTop: `1px solid ${PC.hair}`,
};
export const rowKey: React.CSSProperties = { fontSize: 12.5, color: PC.soft };
export const rowVal: React.CSSProperties = { fontSize: 12.5, fontWeight: 500, color: PC.ink };
export const gridAutoFit: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px 18px", marginTop: 18,
};
export const footerRow: React.CSSProperties = {
  display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12,
  marginTop: 20, paddingTop: 16, borderTop: `1px solid ${PC.hair}`,
};

/* ─── Ortaq ikonlar ──────────────────────────────────────────────────────── */

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.8" style={{ animation: "fanusSpin .8s linear infinite" }} aria-hidden>
      <path d="M8 2.4a5.6 5.6 0 1 1-5.6 5.6" strokeLinecap="round" />
    </svg>
  );
}
export function IconCheck({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M3.4 8.4l2.6 2.6 6-6.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function IconChevron({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M6.4 4 10 8l-3.6 4" strokeLinecap="round" />
    </svg>
  );
}
export function IconExternal({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M6.4 3.4h6.2v6.2M12.6 3.4 7 9M12.6 9.6v3H3.4V3.4h3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function IconTrash({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M3.4 5h9.2M6.4 5V3.6h3.2V5M4.6 5l.5 8h5.8l.5-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconWarn({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={PC.ink} strokeWidth="1.5" aria-hidden>
      <path d="M10 3.4 2.8 16h14.4L10 3.4Z" strokeLinejoin="round" />
      <path d="M10 8v3.4M10 13.6v.6" strokeLinecap="round" />
    </svg>
  );
}
function IconUndo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M3 8a5 5 0 1 1 1.6 3.7M3 8V4.8M3 8h3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconCamera({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M2.6 6.2h1.8l1-1.6h5.2l1 1.6h1.8v6.2H2.6V6.2Z" strokeLinejoin="round" />
      <circle cx="8" cy="9.3" r="2" />
    </svg>
  );
}
function IconDownload({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M8 3v7M5.2 7.4 8 10.2l2.8-2.8M3.2 12.6h9.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconEye({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M1.6 8S4 4.2 8 4.2 14.4 8 14.4 8 12 11.8 8 11.8 1.6 8 1.6 8Z" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="1.9" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M1.6 8S4 4.2 8 4.2 14.4 8 14.4 8 12 11.8 8 11.8 1.6 8 1.6 8Z" strokeLinejoin="round" />
      <path d="M3 13 13 3" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Ortaq modal skeleti + təsdiq dialoqu ───────────────────────────────── */

export function ModalScrim({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(18,23,26,.34)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, zIndex: 60, overflow: "auto",
    }}>
      {children}
    </div>
  );
}
export const modalBoxStyle: React.CSSProperties = {
  background: "#fff", border: `1px solid ${PC.border}`, borderRadius: 14,
  width: "100%", maxWidth: 430, padding: 22, animation: "fanusRise .18s ease-out",
};

export interface ConfirmSpec {
  title: string;
  body: string;
  label: string;
  run: () => void;
}

export function ConfirmDialog({ spec, onClose }: { spec: ConfirmSpec | null; onClose: () => void }) {
  const { t } = useT();
  if (!spec) return null;
  return (
    <ModalScrim>
      <div style={modalBoxStyle}>
        <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.015em", margin: 0, color: PC.ink }}>{spec.title}</h3>
        <p style={{ fontSize: 13, color: PC.mut, lineHeight: 1.6, margin: "8px 0 0" }}>{spec.body}</p>
        <div style={{ display: "flex", gap: 10, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${PC.hair}` }}>
          <button type="button" onClick={() => { onClose(); spec.run(); }} style={btnDark}>{spec.label}</button>
          <button type="button" onClick={onClose} style={{ ...btnGhost, fontSize: 13, padding: "9px 15px" }}>{t("prof.cancel")}</button>
        </div>
      </div>
    </ModalScrim>
  );
}

/* ─── Form altlığı — saxla / saxlanılır / saxlandı / dəyişiklik yoxdur ───── */

export function SaveFooter({
  dirty, saving, saved, onSave, onDiscard, submitLabel, border = true,
}: {
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
  onDiscard?: () => void;
  submitLabel?: string;
  border?: boolean;
}) {
  const { t } = useT();
  const label = submitLabel ?? t("prof.save");
  return (
    <div style={border ? footerRow : { ...footerRow, marginTop: 18, paddingTop: 0, borderTop: "none" }}>
      {saving ? (
        <span style={btnIdle}><Spinner />{t("prof.saving")}</span>
      ) : dirty ? (
        <button type="submit" onClick={onSave} style={btnDark}>{label}</button>
      ) : (
        <span style={btnIdle}>{label}</span>
      )}
      {dirty && !saving && onDiscard && (
        <button type="button" onClick={onDiscard} style={{
          fontSize: 12.5, fontWeight: 500, color: PC.mut, background: "none", border: "none",
          padding: "6px 2px", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2,
        }}>
          {t("prof.discard")}
        </button>
      )}
      {!dirty && !saving && (
        saved ? (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5,
            fontWeight: 500, color: PC.ink, animation: "fanusRise .2s ease-out",
          }}>
            <IconCheck />{t("prof.saved")}
          </span>
        ) : (
          <span style={{ fontSize: 12.5, color: PC.faint }}>{t("prof.noChanges")}</span>
        )
      )}
    </div>
  );
}

/* ─── Şifrə sahəsi + göz düyməsi ─────────────────────────────────────────── */

function PasswordInput({
  value, onChange, autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  const { t } = useT();
  const [show, setShow] = useState(false);
  return (
    <span style={{
      display: "flex", alignItems: "center", border: `1px solid ${PC.border2}`,
      borderRadius: 8, background: "#fff", paddingRight: 4,
    }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
        style={{
          flex: "1 1 auto", minWidth: 0, fontSize: 13.5, color: PC.ink,
          background: "none", border: "none", padding: "9px 11px", outline: "none",
        }}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        title={t("prof.pwToggle")}
        aria-label={show ? t("uprof.pwHide") : t("uprof.pwShow")}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: PC.faint, background: "none", border: "none", padding: 6, cursor: "pointer",
        }}
      >
        <IconEye open={show} />
      </button>
    </span>
  );
}

const PHONE_RE = /^\+?[0-9 ()-]{9,}$/;

/* ─── ProfileShell — bütün panel rollarının vahid profil skeleti ─────────── */

export interface ProfileQuickLink {
  href: string;
  label: string;
  icon?: React.ReactNode;
  external?: boolean;
}

export interface ProfileShellProps {
  /** Başlıq (default: lokal "Profil") və alt başlıq. */
  title?: string;
  subtitle?: string;
  /** Əsas sütunda Əsas məlumat (+ pasientdə Təcili əlaqə) ilə Şifrə arasına düşən rol kartları. */
  extras?: React.ReactNode;
  /** Yan sütunda Hesab durumu kartından ƏVVƏL göstərilən kartlar (məs. risk kartı). */
  sideExtras?: React.ReactNode;
  /** Yan sütunda Sürətli keçidlərdən SONRA göstərilən kartlar (məs. təqvim, önizləmə). */
  sideBottom?: React.ReactNode;
  /** Sürətli keçidlər — verilməsə yalnız bildiriş parametrləri keçidi göstərilir. */
  quickLinks?: ProfileQuickLink[];
  /** Hesab durumu kartına rol-spesifik əlavə sətirlər (məs. Hesab tipi). */
  statusRows?: { label: string; value: React.ReactNode }[];
}

export default function ProfileShell({
  title, subtitle, extras, sideExtras, sideBottom, quickLinks, statusRows,
}: ProfileShellProps) {
  const { t } = useT();
  const [me, setMe] = useState<MeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [confirmSpec, setConfirmSpec] = useState<ConfirmSpec | null>(null);

  // GDPR hesab statusu — gözləyən silinmə bannerini idarə edir.
  const [status, setStatus] = useState<AccountStatus | null>(null);

  const refreshStatus = useCallback(() => {
    meApi.accountStatus().then(setStatus).catch(() => { /* qeyri-kritik */ });
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setErr(null);
    meApi.get()
      .then(setMe)
      .catch(e => setErr((e as Error).message))
      .finally(() => setLoading(false));
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => { load(); }, [load]);

  const head = (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.025em", margin: 0, color: PC.ink }}>
          {title ?? t("uprof.titleDefault")}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 13.5, color: PC.soft, lineHeight: 1.5, margin: "6px 0 0", maxWidth: "62ch" }}>
            {subtitle}
          </p>
        )}
      </div>
      {me?.lastLogin && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: PC.soft }}>
          <span>{t("prof.lastLogin")}</span>
          <span style={{ color: PC.ink, fontWeight: 500 }}>{azFormatDateTime(me.lastLogin)}</span>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {head}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ width: 180, height: 14, borderRadius: 4, background: "#e9edee", animation: "fanusPulse 1.4s ease-in-out infinite" }} />
            <div style={{ width: "100%", height: 11, borderRadius: 4, background: "#eef1f1", animation: "fanusPulse 1.4s ease-in-out .1s infinite" }} />
            <div style={{ width: "72%", height: 11, borderRadius: 4, background: "#eef1f1", animation: "fanusPulse 1.4s ease-in-out .2s infinite" }} />
          </div>
          <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ width: 140, height: 14, borderRadius: 4, background: "#e9edee", animation: "fanusPulse 1.4s ease-in-out infinite" }} />
            <div style={{ width: "90%", height: 11, borderRadius: 4, background: "#eef1f1", animation: "fanusPulse 1.4s ease-in-out .15s infinite" }} />
          </div>
          <div style={{ fontSize: 12.5, color: PC.faint }}>{t("prof.loadingNote")}</div>
        </div>
      </div>
    );
  }

  if (err || !me) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {head}
        <div style={{
          border: `1px solid ${PC.border3}`, borderRadius: 12, background: "#fff", padding: 26,
          display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12, maxWidth: 520,
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={PC.ink} strokeWidth="1.5" aria-hidden>
            <circle cx="10" cy="10" r="7.2" />
            <path d="M10 6.4v4M10 13.2v.6" strokeLinecap="round" />
          </svg>
          <div style={{ fontSize: 15, fontWeight: 600, color: PC.ink }}>{t("prof.errTitle")}</div>
          <div style={{ fontSize: 13, color: PC.mut, lineHeight: 1.55 }}>{err || t("prof.errBody")}</div>
          <button type="button" onClick={load} style={{ ...btnDark, marginTop: 2, padding: "8px 14px" }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M13 8a5 5 0 1 1-1.6-3.7M13 4.8V8M13 8H9.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t("prof.retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {status?.deletionRequestedAt && (
        <DeletionBanner status={status} onCancelled={refreshStatus} setConfirm={setConfirmSpec} />
      )}

      {head}

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 20 }}>
        <div style={{ flex: "1 1 620px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
          <IdentityCard me={me} onChanged={setMe} setConfirm={setConfirmSpec} />
          <BasicInfoCard me={me} onUpdated={setMe} />
          {me.role === "PATIENT" && <EmergencyContactCard />}
          {extras}
          <PasswordCard />
          <PrivacyCard status={status} onStatusChanged={refreshStatus} setConfirm={setConfirmSpec} />
        </div>

        <div style={{
          flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column",
          gap: 20, position: "sticky", top: 86,
        }}>
          {sideExtras}
          <AccountStatusCard me={me} statusRows={statusRows} />
          <QuickLinksCard role={me.role} links={quickLinks} />
          {sideBottom}
        </div>
      </div>

      <ConfirmDialog spec={confirmSpec} onClose={() => setConfirmSpec(null)} />
    </div>
  );
}

/* ─── Gözləyən silinmə banneri ───────────────────────────────────────────── */

function DeletionBanner({
  status, onCancelled, setConfirm,
}: {
  status: AccountStatus;
  onCancelled: () => void;
  setConfirm: (c: ConfirmSpec | null) => void;
}) {
  const { t } = useT();
  const requestedLabel = status.deletionRequestedAt ? azFormatDate(status.deletionRequestedAt) : "—";

  const openCancel = () => setConfirm({
    title: t("prof.delCancelTitle"),
    body: t("prof.delCancelBody"),
    label: t("prof.delCancelCta"),
    run: async () => {
      try {
        await meApi.cancelDeletionRequest();
        toast(t("prof.delCancelledToast"));
        onCancelled();
      } catch (e) {
        toast((e as Error).message, "error");
      }
    },
  });

  return (
    <div role="alert" style={{
      border: `1px solid ${PC.border3}`, borderRadius: 12, background: "#fff",
      padding: "16px 18px", display: "flex", alignItems: "flex-start", gap: 14,
    }}>
      <span style={{ flex: "0 0 auto", marginTop: 1 }}><IconWarn /></span>
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: PC.ink }}>{t("prof.delBannerTitle")}</div>
        <div style={{ fontSize: 12.5, color: PC.mut, lineHeight: 1.55, marginTop: 4 }}>
          {t("prof.delBannerBody", { date: requestedLabel })}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          <button type="button" onClick={openCancel} style={{ ...btnGhost, border: `1px solid ${PC.border3}`, padding: "7px 13px" }}>
            <IconUndo />
            {t("prof.delCancelCta")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Kimlik kartı — şəkil, ad, e-poçt, rol/status cədvəli ───────────────── */

function initialsOf(me: MeProfile) {
  const a = (me.firstName?.[0] ?? "").toUpperCase();
  const b = (me.lastName?.[0] ?? "").toUpperCase();
  const both = (a + b).trim();
  return both || (me.email[0] ?? "?").toUpperCase();
}

function IdentityCard({
  me, onChanged, setConfirm,
}: {
  me: MeProfile;
  onChanged: (m: MeProfile) => void;
  setConfirm: (c: ConfirmSpec | null) => void;
}) {
  const { t } = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // eyni faylı yenidən seçməyə imkan verir
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast(t("uprof.photoOnlyImage"), "error"); return; }
    if (file.size > 5 * 1024 * 1024) { toast(t("uprof.photoTooLarge"), "error"); return; }
    setPendingFile(file);
  };

  const onCropped = async (croppedFile: File) => {
    setUploading(true);
    try {
      const { url } = await meApi.uploadPhoto(croppedFile);
      onChanged({ ...me, photoUrl: url });
      window.dispatchEvent(new CustomEvent("profilePhotoChanged", { detail: { photoUrl: url } }));
      // Psixoloqun şəkli ictimai /psychologists/[slug] səhifəsində də görünür —
      // Next.js keşini dərhal yenilə.
      if (me.role === "PSYCHOLOGIST") revalidatePsychologistsCache();
      setPendingFile(null);
      toast(t("prof.photoUpdatedToast"));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setUploading(false);
    }
  };

  const openRemove = () => setConfirm({
    title: t("prof.photoRemoveTitle"),
    body: t("prof.photoRemoveBody"),
    label: t("prof.photoRemoveLabel"),
    run: async () => {
      try {
        await meApi.deletePhoto();
        onChanged({ ...me, photoUrl: null });
        window.dispatchEvent(new CustomEvent("profilePhotoChanged", { detail: { photoUrl: null } }));
        if (me.role === "PSYCHOLOGIST") revalidatePsychologistsCache();
        toast(t("prof.photoRemovedToast"));
      } catch (e) {
        toast((e as Error).message, "error");
      }
    },
  });

  const fullName = (me.firstName || me.lastName) ? `${me.firstName ?? ""} ${me.lastName ?? ""}`.trim() : "—";

  return (
    <section style={cardStyle}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 22 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, flex: "0 0 auto" }}>
          <div style={{
            width: 88, height: 88, borderRadius: "50%", border: `1px solid ${PC.border}`,
            background: PC.bg, overflow: "hidden", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 26, fontWeight: 600, color: PC.mut, letterSpacing: "-0.02em",
          }}>
            {me.photoUrl ? (
              <Image
                src={me.photoUrl}
                alt={me.firstName ?? me.email}
                width={88}
                height={88}
                unoptimized
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span>{initialsOf(me)}</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              style={{ ...btnGhost, padding: "6px 11px", gap: 6, opacity: uploading ? 0.6 : 1 }}
            >
              {uploading ? <Spinner /> : <IconCamera />}
              {me.photoUrl ? t("prof.photoChange") : t("prof.photoUpload")}
            </button>
            {me.photoUrl && (
              <button
                type="button"
                onClick={openRemove}
                title={t("prof.photoRemoveTitle")}
                style={{ ...btnGhost, padding: "6px 9px", color: PC.mut }}
              >
                <IconTrash />
              </button>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/*" onChange={onSelectFile} style={{ display: "none" }} />
        </div>

        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", margin: 0, color: PC.ink }}>{fullName}</h2>
          <div style={{ fontSize: 13, color: PC.soft, marginTop: 4 }}>{me.email}</div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "14px 20px", marginTop: 18, paddingTop: 16, borderTop: `1px solid ${PC.hair}`,
          }}>
            <div>
              <div style={{ fontSize: 11.5, color: PC.faint, fontWeight: 500 }}>{t("prof.role")}</div>
              <div style={{ fontSize: 13, fontWeight: 500, marginTop: 3, color: PC.ink }}>{roleLabel(t, me.role)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: PC.faint, fontWeight: 500 }}>{t("prof.emailStatus")}</div>
              {me.emailVerified ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, marginTop: 3, color: PC.ink }}>
                  <IconCheck />
                  {t("prof.verified")}
                </div>
              ) : (
                <div style={{ fontSize: 13, fontWeight: 500, marginTop: 3, color: PC.faint }}>{t("prof.unverified")}</div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: PC.faint, fontWeight: 500 }}>{t("prof.lastLogin")}</div>
              <div style={{ fontSize: 13, fontWeight: 500, marginTop: 3, color: PC.ink }}>
                {me.lastLogin ? azFormatDateTime(me.lastLogin) : "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

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

/* ─── Yan sütun kartları ─────────────────────────────────────────────────── */

function AccountStatusCard({
  me, statusRows,
}: {
  me: MeProfile;
  statusRows?: { label: string; value: React.ReactNode }[];
}) {
  const { t } = useT();
  return (
    <section style={sideCardStyle}>
      <h2 style={{ ...sectionH2, margin: "0 0 4px" }}>{t("prof.accTitle")}</h2>
      <div style={{ ...rowSplit, marginTop: 12 }}>
        <span style={rowKey}>{t("prof.role")}</span>
        <span style={rowVal}>{roleLabel(t, me.role)}</span>
      </div>
      {statusRows?.map(r => (
        <div key={r.label} style={rowSplit}>
          <span style={rowKey}>{r.label}</span>
          <span style={rowVal}>{r.value}</span>
        </div>
      ))}
      <div style={rowSplit}>
        <span style={rowKey}>{t("prof.emailStatus")}</span>
        <span style={rowVal}>{me.emailVerified ? t("prof.verified") : t("prof.unverified")}</span>
      </div>
      <div style={rowSplit}>
        <span style={rowKey}>{t("prof.lastLogin")}</span>
        <span style={rowVal}>{me.lastLogin ? azFormatDateTime(me.lastLogin) : "—"}</span>
      </div>
      <div style={{ ...rowSplit, padding: "11px 0 0" }}>
        <span style={rowKey}>{t("prof.memberSince")}</span>
        <span style={rowVal}>{azFormatDate(me.createdAt)}</span>
      </div>
    </section>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M6.1 12.8h3.8M4.4 12.8V7.4a3.6 3.6 0 0 1 7.2 0v5.4M3.2 12.8h9.6" strokeLinecap="round" />
    </svg>
  );
}

function QuickLinksCard({ role, links }: { role: string; links?: ProfileQuickLink[] }) {
  const { t } = useT();
  const base = role === "PSYCHOLOGIST" ? "/psycholog"
             : role === "OPERATOR"     ? "/operator"
             : role === "ADMIN"        ? "/admin"
             : "/patient";
  const items: ProfileQuickLink[] = links ?? [
    { href: `${base}/notifications`, label: t("prof.qlNotifications"), icon: <BellIcon /> },
  ];
  return (
    <section style={sideCardStyle}>
      <h2 style={{ ...sectionH2, margin: "0 0 12px" }}>{t("prof.quickTitle")}</h2>
      {items.map((l, i) => (
        <Link
          key={l.href + l.label}
          href={l.href}
          target={l.external ? "_blank" : undefined}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            padding: i === items.length - 1 ? "11px 0 0" : "11px 0",
            borderTop: `1px solid ${PC.hair}`, fontSize: 13, fontWeight: 500, color: PC.ink,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {l.icon}
            {l.label}
          </span>
          {l.external ? <IconExternal /> : <IconChevron />}
        </Link>
      ))}
    </section>
  );
}

/* ─── Əsas məlumat formu ─────────────────────────────────────────────────── */

function BasicInfoCard({ me, onUpdated }: { me: MeProfile; onUpdated: (m: MeProfile) => void }) {
  const { t } = useT();
  const [firstName, setFirstName] = useState(me.firstName ?? "");
  const [lastName, setLastName] = useState(me.lastName ?? "");
  const [phone, setPhone] = useState(me.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty =
    (firstName.trim() || null) !== (me.firstName ?? null) ||
    (lastName.trim() || null) !== (me.lastName ?? null) ||
    (phone.trim() || null) !== (me.phone ?? null);

  const sub = me.role === "PATIENT" ? t("prof.basicSubPat")
            : me.role === "PSYCHOLOGIST" ? t("prof.basicSubPsy")
            : t("prof.basicSubDefault");
  const emailHint = me.role === "PATIENT" ? t("prof.emailHintPat")
                  : me.role === "PSYCHOLOGIST" ? t("prof.emailHintPsy")
                  : t("prof.emailHintDefault");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) { toast(t("prof.errName"), "error"); return; }
    if (phone.trim() && !PHONE_RE.test(phone.trim())) { toast(t("prof.errPhone"), "error"); return; }
    setSaving(true);
    try {
      const updated = await meApi.update({
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        phone: phone.trim() || null,
      });
      onUpdated(updated);
      setSaved(true);
      toast(t("prof.savedToast"));
      setTimeout(() => setSaved(false), 3000);
    } catch (e2) {
      toast((e2 as Error).message || t("uprof.updateFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setFirstName(me.firstName ?? "");
    setLastName(me.lastName ?? "");
    setPhone(me.phone ?? "");
  };

  return (
    <form style={cardStyle} onSubmit={submit}>
      <h2 style={sectionH2}>{t("prof.basicTitle")}</h2>
      <p style={sectionSub}>{sub}</p>
      <div style={gridAutoFit}>
        <label style={{ display: "block" }}>
          <span style={labelStyle}>{t("prof.fFirstName")}</span>
          <input type="text" value={firstName} onChange={e => { setFirstName(e.target.value); setSaved(false); }} maxLength={100} style={inputStyle} />
        </label>
        <label style={{ display: "block" }}>
          <span style={labelStyle}>{t("prof.fLastName")}</span>
          <input type="text" value={lastName} onChange={e => { setLastName(e.target.value); setSaved(false); }} maxLength={100} style={inputStyle} />
        </label>
        <label style={{ display: "block" }}>
          <span style={labelStyle}>{t("prof.fPhone")}</span>
          <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); setSaved(false); }} placeholder="+994 50 000 00 00" maxLength={30} style={inputStyle} />
        </label>
        <label style={{ display: "block" }}>
          <span style={labelStyle}>{t("prof.fEmail")}</span>
          <input type="email" value={me.email} readOnly style={inputReadonlyStyle} />
          <span style={{ display: "block", fontSize: 11.5, color: PC.faint, lineHeight: 1.5, marginTop: 6 }}>{emailHint}</span>
        </label>
      </div>
      <SaveFooter dirty={dirty} saving={saving} saved={saved} onSave={() => {}} onDiscard={reset} />
    </form>
  );
}

/* ─── Pasient — təcili əlaqə (Modul G) ───────────────────────────────────── */

function EmergencyContactCard() {
  const { t } = useT();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState("");
  const [address, setAddress] = useState("");
  const [savedVals, setSavedVals] = useState({ name: "", phone: "", relation: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    patientApi.getEmergencyContact()
      .then(data => {
        if (cancelled) return;
        const vals = {
          name: data.emergencyContactName ?? "",
          phone: data.emergencyContactPhone ?? "",
          relation: data.emergencyContactRelation ?? "",
          address: data.residentialAddress ?? "",
        };
        setName(vals.name); setPhone(vals.phone); setRelation(vals.relation); setAddress(vals.address);
        setSavedVals(vals);
      })
      .catch(() => { /* qeyri-kritik — boş form */ });
    return () => { cancelled = true; };
  }, []);

  const dirty = name !== savedVals.name || phone !== savedVals.phone
    || relation !== savedVals.relation || address !== savedVals.address;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.trim() && !PHONE_RE.test(phone.trim())) { toast(t("prof.ecErrPhone"), "error"); return; }
    setSaving(true);
    try {
      const payload: EmergencyContact = {
        emergencyContactName: name.trim() || null,
        emergencyContactPhone: phone.trim() || null,
        emergencyContactRelation: relation.trim() || null,
        residentialAddress: address.trim() || null,
      };
      await patientApi.updateEmergencyContact(payload);
      setSavedVals({ name, phone, relation, address });
      setSaved(true);
      toast(t("prof.ecSavedToast"));
      setTimeout(() => setSaved(false), 3000);
    } catch (e2) {
      toast((e2 as Error).message || t("uprof.updateFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setName(savedVals.name); setPhone(savedVals.phone);
    setRelation(savedVals.relation); setAddress(savedVals.address);
  };

  return (
    <form style={cardStyle} onSubmit={submit}>
      <h2 style={sectionH2}>{t("prof.ecTitle")}</h2>
      <p style={{ ...sectionSub, maxWidth: "76ch" }}>{t("prof.ecSub")}</p>
      <div style={gridAutoFit}>
        <label style={{ display: "block" }}>
          <span style={labelStyle}>{t("prof.ecName")}</span>
          <input type="text" value={name} onChange={e => { setName(e.target.value); setSaved(false); }} maxLength={100} style={inputStyle} />
        </label>
        <label style={{ display: "block" }}>
          <span style={labelStyle}>{t("prof.ecPhone")}</span>
          <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); setSaved(false); }} maxLength={30} style={inputStyle} />
        </label>
        <label style={{ display: "block" }}>
          <span style={labelStyle}>{t("prof.ecRelation")}</span>
          <input type="text" value={relation} onChange={e => { setRelation(e.target.value); setSaved(false); }} maxLength={100} style={inputStyle} />
        </label>
        <label style={{ display: "block", gridColumn: "1 / -1" }}>
          <span style={labelStyle}>{t("prof.ecAddress")}</span>
          <textarea rows={2} value={address} onChange={e => { setAddress(e.target.value); setSaved(false); }} maxLength={255}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
        </label>
      </div>
      <SaveFooter dirty={dirty} saving={saving} saved={saved} onSave={() => {}} onDiscard={reset} />
    </form>
  );
}

/* ─── Şifrə dəyişmə — canlı tələb siyahısı ilə ───────────────────────────── */

function PasswordCard() {
  const { t } = useT();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const ruleLen = next.length >= 8;
  const ruleUpper = /[A-ZĞÜŞİÖÇƏ]/.test(next);
  const ruleLower = /[a-zğüşıöçə]/.test(next);
  const ruleDigit = /[0-9]/.test(next);
  const rules = [
    { key: "len", text: t("prof.pwReqLen"), ok: ruleLen },
    { key: "upper", text: t("prof.pwReqUpper"), ok: ruleUpper },
    { key: "lower", text: t("prof.pwReqLower"), ok: ruleLower },
    { key: "digit", text: t("prof.pwReqDigit"), ok: ruleDigit },
  ];
  const mismatch = confirm.length > 0 && next !== confirm;
  const valid = ruleLen && ruleUpper && ruleLower && ruleDigit && next === confirm && current.length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    try {
      await meApi.changePassword({ currentPassword: current, newPassword: next });
      setCurrent(""); setNext(""); setConfirm("");
      setDone(true);
      toast(t("prof.pwDoneToast"));
      setTimeout(() => setDone(false), 3000);
    } catch (e2) {
      toast((e2 as Error).message || t("uprof.pwChangeFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form style={cardStyle} onSubmit={submit}>
      <h2 style={sectionH2}>{t("prof.pwTitle")}</h2>
      <p style={sectionSub}>{t("prof.pwSub")}</p>
      <div style={gridAutoFit}>
        <label style={{ display: "block" }}>
          <span style={labelStyle}>{t("prof.pwCurrent")}</span>
          <PasswordInput value={current} onChange={v => { setCurrent(v); setDone(false); }} autoComplete="current-password" />
        </label>
        <label style={{ display: "block" }}>
          <span style={labelStyle}>{t("prof.pwNew")}</span>
          <PasswordInput value={next} onChange={v => { setNext(v); setDone(false); }} autoComplete="new-password" />
        </label>
        <label style={{ display: "block" }}>
          <span style={labelStyle}>{t("prof.pwRepeat")}</span>
          <PasswordInput value={confirm} onChange={v => { setConfirm(v); setDone(false); }} autoComplete="new-password" />
          {mismatch && (
            <span style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: PC.ink, marginTop: 6 }}>
              {t("prof.pwMismatch")}
            </span>
          )}
        </label>
      </div>

      <div style={{
        display: "flex", flexDirection: "column", gap: 7, marginTop: 16,
        padding: "14px 16px", border: `1px solid ${PC.hair}`, borderRadius: 10, background: PC.panel,
      }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: PC.mut }}>{t("prof.pwReqTitle")}</div>
        {rules.map(r => (
          <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: PC.mut }}>
            {r.ok ? (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={PC.ink} strokeWidth="1.7" style={{ flex: "0 0 auto" }} aria-hidden>
                <path d="M3.4 8.4l2.6 2.6 6-6.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={PC.border3} strokeWidth="1.7" style={{ flex: "0 0 auto" }} aria-hidden>
                <path d="M4 8h8" strokeLinecap="round" />
              </svg>
            )}
            <span>{r.text}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 18 }}>
        {saving ? (
          <span style={btnIdle}><Spinner />{t("prof.pwSaving")}</span>
        ) : valid ? (
          <button type="submit" style={btnDark}>{t("prof.pwSubmit")}</button>
        ) : (
          <span style={btnIdle}>{t("prof.pwSubmit")}</span>
        )}
        {done && !saving && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5,
            fontWeight: 500, color: PC.ink, animation: "fanusRise .2s ease-out",
          }}>
            <IconCheck />{t("prof.saved")}
          </span>
        )}
      </div>
    </form>
  );
}

/* ─── Məxfilik (GDPR) — ixrac + hesab silmə ──────────────────────────────── */

function PrivacyCard({
  status, onStatusChanged, setConfirm,
}: {
  status: AccountStatus | null;
  onStatusChanged: () => void;
  setConfirm: (c: ConfirmSpec | null) => void;
}) {
  const { t } = useT();
  const [exportPhase, setExportPhase] = useState<"idle" | "busy" | "done">("idle");

  const [delOpen, setDelOpen] = useState(false);
  const [delPw, setDelPw] = useState("");
  const [delWord, setDelWord] = useState("");
  const [delReason, setDelReason] = useState("");
  const [delBusy, setDelBusy] = useState(false);

  const pending = !!status?.deletionRequestedAt;
  const pendingDate = status?.deletionRequestedAt ? azFormatDate(status.deletionRequestedAt) : "—";

  const startExport = async () => {
    setExportPhase("busy");
    try {
      await meApi.exportData();
      setExportPhase("done");
      setTimeout(() => setExportPhase("idle"), 5000);
    } catch (e) {
      toast((e as Error).message, "error");
      setExportPhase("idle");
    }
  };

  // "SİL" backend-ə göndərilən təsdiq sözüdür — tərcümə OLUNMUR.
  // Azərbaycan "i" hərfinin İ/I böyütmə fərqinə görə hər iki formanı qəbul edirik.
  const wordOk = ["SİL", "SIL"].includes(delWord.trim().toUpperCase());
  const delReady = delPw.length > 0 && wordOk && !delBusy;

  const submitDelete = async () => {
    if (!delReady) return;
    setDelBusy(true);
    try {
      await meApi.deleteAccount({
        currentPassword: delPw,
        confirmation: delWord.trim(),
        reason: delReason.trim() || undefined,
      });
      setDelOpen(false);
      setDelPw(""); setDelWord(""); setDelReason("");
      toast(t("prof.delSentToast"));
      onStatusChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setDelBusy(false);
    }
  };

  const openCancel = () => setConfirm({
    title: t("prof.delCancelTitle"),
    body: t("prof.delCancelBody"),
    label: t("prof.delCancelCta"),
    run: async () => {
      try {
        await meApi.cancelDeletionRequest();
        toast(t("prof.delCancelledToast"));
        onStatusChanged();
      } catch (e) {
        toast((e as Error).message, "error");
      }
    },
  });

  return (
    <section style={cardStyle}>
      <h2 style={sectionH2}>{t("prof.privTitle")}</h2>
      <p style={sectionSub}>{t("prof.privSub")}</p>

      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between",
        gap: 14, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${PC.hair}`,
      }}>
        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: PC.ink }}>{t("prof.exportTitle")}</div>
          <div style={{ fontSize: 12.5, color: PC.soft, lineHeight: 1.55, marginTop: 4 }}>{t("prof.exportSub")}</div>
        </div>
        <div style={{ flex: "0 0 auto" }}>
          {exportPhase === "idle" && (
            <button type="button" onClick={startExport} style={btnGhost}>
              <IconDownload />
              {t("prof.exportCta")}
            </button>
          )}
          {exportPhase === "busy" && (
            <span style={{ ...btnIdle, fontSize: 12.5, padding: "8px 13px" }}>
              <Spinner />{t("prof.exportBusy")}
            </span>
          )}
          {exportPhase === "done" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: PC.ink }}>
              <IconCheck />{t("prof.exportDone")}
            </span>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${PC.hair}` }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: PC.ink }}>{t("prof.delTitle")}</div>
        <div style={{ fontSize: 12.5, color: PC.soft, lineHeight: 1.55, marginTop: 4, maxWidth: "74ch" }}>
          {t("prof.delBody")}
        </div>
        {pending ? (
          <div style={{
            display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 14,
            padding: "13px 15px", border: `1px solid ${PC.border}`, borderRadius: 10, background: PC.panel,
          }}>
            <span style={{ fontSize: 12.5, color: PC.mut }}>{t("prof.delPendingNote", { date: pendingDate })}</span>
            <button type="button" onClick={openCancel} style={{ ...btnGhost, padding: "7px 12px" }}>
              {t("prof.delCancelCta")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setDelOpen(true); setDelPw(""); setDelWord(""); setDelReason(""); }}
            style={{ ...btnGhost, border: `1px solid ${PC.border3}`, marginTop: 14 }}
          >
            <IconTrash />
            {t("prof.delCta")}
          </button>
        )}
      </div>

      {delOpen && !pending && (
        <ModalScrim>
          <div style={{ ...modalBoxStyle, maxWidth: 460 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <IconWarn />
              <h3 style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.015em", margin: 0, color: PC.ink }}>
                {t("prof.delCta")}
              </h3>
            </div>
            <p style={{ fontSize: 13, color: PC.mut, lineHeight: 1.6, margin: "12px 0 0" }}>{t("prof.delBody")}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 18 }}>
              <label style={{ display: "block" }}>
                <span style={labelStyle}>{t("prof.pwCurrent")}</span>
                <input type="password" value={delPw} onChange={e => setDelPw(e.target.value)} autoComplete="current-password" style={inputStyle} />
              </label>
              <label style={{ display: "block" }}>
                <span style={labelStyle}>{t("prof.delWord")}</span>
                <input type="text" value={delWord} onChange={e => setDelWord(e.target.value)} placeholder="SİL"
                  style={{ ...inputStyle, letterSpacing: ".06em" }} />
              </label>
              <label style={{ display: "block" }}>
                <span style={labelStyle}>{t("prof.delReason")}</span>
                <textarea rows={3} value={delReason} onChange={e => setDelReason(e.target.value)} maxLength={500}
                  style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
              </label>
            </div>
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
              marginTop: 18, paddingTop: 16, borderTop: `1px solid ${PC.hair}`,
            }}>
              {delBusy ? (
                <span style={{ ...btnIdle, padding: "9px 15px" }}><Spinner />{t("prof.delSending")}</span>
              ) : delReady ? (
                <button type="button" onClick={submitDelete} style={{ ...btnDark, padding: "9px 15px" }}>{t("prof.delSubmit")}</button>
              ) : (
                <span style={{ ...btnIdle, padding: "9px 15px" }}>{t("prof.delSubmit")}</span>
              )}
              <button type="button" onClick={() => setDelOpen(false)} disabled={delBusy}
                style={{ ...btnGhost, fontSize: 13, padding: "9px 15px" }}>
                {t("prof.cancel")}
              </button>
              {!delReady && !delBusy && (
                <span style={{ fontSize: 11.5, color: PC.faint, flex: "1 1 100%" }}>{t("prof.delBlockedHint")}</span>
              )}
            </div>
          </div>
        </ModalScrim>
      )}
    </section>
  );
}
