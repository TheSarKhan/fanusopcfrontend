"use client";

/**
 * Müraciət Pool-u — ayrıca intake səhifəsi. Yeni (sahibsiz) müraciətlər
 * (seans/paket) burada toplanır. Operator buradan "Götür" → müraciət
 * daimi olaraq onun üzərinə keçir və pooldan çıxır. Ayrıca ödəniş pool-u
 * yoxdur — müraciətin ödənişi bu götürmə ilə birlikdə avtomatik operatorun
 * üzərinə keçir (bax OperatorPaymentsPage). Pool artıq siyahı içində filtr
 * deyil — öz səhifəsidir.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import {
  operatorApi,
  type AppointmentDetail,
  type PackagePoolItem,
} from "@/lib/api";
import { subscribeNotifications, subscribeOperatorClaims } from "@/lib/notificationsSocket";
import { useT } from "@/lib/i18n/LocaleProvider";
import { azFormatDateTime } from "@/lib/datetime";
import { statusMeta, isPoolEligible } from "@/lib/appointmentStatus";
import { toast as uiToast } from "@/components/Toast";
import ErrorState from "@/components/ErrorState";

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  return digits || null;
}
function whatsappLink(phone: string): string {
  return `https://wa.me/${phone.replace(/^\+/, "").replace(/[^\d]/g, "")}`;
}
function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "indicə";
  if (min < 60) return `${min} dəq öncə`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} saat öncə`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} gün öncə`;
  return `${Math.round(d / 30)} ay öncə`;
}
function fmtDt(iso?: string | null) {
  return iso ? azFormatDateTime(iso) : "—";
}
function initialsOf(name?: string | null) {
  if (!name) return "—";
  return name.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase() || "—";
}
// Avatar rəng variantı (--1..--4) sabit seçilir — eyni pasiyent həmişə eyni ton.
function avatarVariant(seed: string | number): number {
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i)) % 4;
  return h + 1;
}
// Yalnız görünüş: status etiketi statusMeta-dan gəlir, rəng fx-pill sinfindən.
function statusPill(status?: string | null): string {
  switch (status) {
    case "CONFIRMED": return "fx-pill--paid";
    case "CANCELLED":
    case "DISPUTED": return "fx-pill--refunded";
    case "COMPLETED": return "fx-pill--cancelled";
    case "ASSIGNED": return "fx-pill--info";
    default: return "fx-pill--pending"; // PENDING / NEW / REJECTED / IN_REVIEW ...
  }
}

export default function OperatorPoolPage() {
  const { t } = useT();
  const router = useRouter();

  const [appts, setAppts] = useState<AppointmentDetail[]>([]);
  // Randevusu olmayan (SCHEDULE_LATER) sahibsiz paketlər — pasiyent paket alıb, hələ
  // heç bir seans planlanmayıb, ona görə appointment pool-unda görünmür. Ayrıca çəkilir.
  const [pkgs, setPkgs] = useState<PackagePoolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([
      operatorApi.listPoolAppointments(),
      operatorApi.listPoolPackages().catch(() => [] as PackagePoolItem[]),
    ])
      .then(([a, p]) => { setAppts(a); setPkgs(p); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Yeni müraciət gəldikdə pool-u canlı yenilə.
  useEffect(() => {
    return subscribeNotifications((n) => {
      const ty = typeof n.type === "string" ? n.type : "";
      if (ty.startsWith("APPOINTMENT_") || ty.startsWith("PACKAGE_")) load();
    });
  }, [load]);

  // Başqası seans müraciətini götürəndə pooldan çıxsın (sahibli artıq pool deyil).
  useEffect(() => {
    return subscribeOperatorClaims((ev) => {
      setAppts(prev => prev.map(a => a.id === ev.appointmentId
        ? { ...a, claimedByUserId: ev.claimedByUserId ?? null, claimedByName: ev.claimedByName ?? null, claimedAt: ev.claimedAt ?? null }
        : a));
    });
  }, []);

  // Pool = sahibsiz + yeni müraciət (randevu tələbi, PENDING/NEW/REJECTED).
  // Ayrıca "ödəniş pool"u yoxdur — müraciəti götürəndə onun ödənişi də
  // avtomatik operatorun üzərinə keçir (Ödənişlər səhifəsində idarə olunur).
  const poolAppts = useMemo(
    () => appts.filter(a => a.claimedByUserId == null && isPoolEligible(a.status)),
    [appts]);

  // Paket alışı arxa planda hər seans üçün ayrı appointment sətri kimi yaranır,
  // amma operator üçün bu SEANS müraciəti deyil — PAKET müraciətidir, öz biznes
  // məntiqi ilə (paket adı, neçə seanslıq, kimə aiddir). Ona görə seans siyahısında
  // fərdi ticket kimi yox, ayrıca "paket" kartı kimi göstərilir.
  const { poolPackages, poolStandaloneAppts } = useMemo(() => {
    const groups = new Map<number, AppointmentDetail[]>();
    const standalone: AppointmentDetail[] = [];
    for (const a of poolAppts) {
      if (a.patientPackageId != null) {
        if (!groups.has(a.patientPackageId)) groups.set(a.patientPackageId, []);
        groups.get(a.patientPackageId)!.push(a);
      } else {
        standalone.push(a);
      }
    }
    for (const list of groups.values()) {
      list.sort((x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime());
    }
    return { poolPackages: Array.from(groups.values()), poolStandaloneAppts: standalone };
  }, [poolAppts]);

  // Appointment-dən törəyən paket qruplarında OLMAYAN sahibsiz paketlər (SCHEDULE_LATER —
  // seansı yoxdur). SCHEDULE_NOW paketi onsuz da öz seansları ilə yuxarıda görünür → dublikatı süz.
  const pendingPkgs = useMemo(() => {
    const apptPkgIds = new Set(poolPackages.map(g => g[0].patientPackageId));
    return pkgs.filter(p => !apptPkgIds.has(p.id));
  }, [pkgs, poolPackages]);

  const total = poolAppts.length + pendingPkgs.length;

  const takeAppt = useCallback((a: AppointmentDetail) => {
    setBusyId(`a${a.id}`);
    operatorApi.claim(a.id)
      .then(() => {
        setAppts(prev => prev.filter(x => x.id !== a.id)); // götürüldü → pooldan çıxır
        uiToast(t("staff.opPoolTaken"), "success");
      })
      .catch((e) => uiToast((e as Error).message, "error"))
      .finally(() => setBusyId(null));
  }, [t]);

  // Paket vahid götürülür: backend bir seansı claim edəndə eyni patientPackageId-ə
  // aid bütün qalan sətirləri avtomatik operatora bağlayır (AppointmentClaimService
  // .maybeAdoptPackage) — ayrı-ayrı hər seans üçün claim göndərmək lazım deyil, əksinə
  // paralel claim-lər paket sahibliyi üzərində eyni-vaxtlı yazı toqquşmasına (500) səbəb olurdu.
  const takePackage = useCallback((sessions: AppointmentDetail[]) => {
    const pkgId = sessions[0].patientPackageId;
    setBusyId(`pkg${pkgId}`);
    operatorApi.claim(sessions[0].id)
      .then(() => {
        const ids = new Set(sessions.map(a => a.id));
        setAppts(prev => prev.filter(x => !ids.has(x.id)));
        uiToast(t("staff.opPoolTaken"), "success");
      })
      .catch((e) => uiToast((e as Error).message, "error"))
      .finally(() => setBusyId(null));
  }, [t]);

  // Sahibsiz (SCHEDULE_LATER) paketi götür: backend paketi operatora bağlayır
  // (ownerOperatorId) → paket pooldan çıxır və ödənişi operatorun "Ödənişlər"ində görünür.
  const takePendingPackage = useCallback((p: PackagePoolItem) => {
    setBusyId(`ppkg${p.id}`);
    operatorApi.claimPackage(p.id)
      .then(() => {
        setPkgs(prev => prev.filter(x => x.id !== p.id));
        uiToast(t("staff.opPoolTaken"), "success");
      })
      .catch((e) => uiToast((e as Error).message, "error"))
      .finally(() => setBusyId(null));
  }, [t]);

  return (
    <div style={{ width: "100%" }}>
      {/* HEADER */}
      <PageHeader
        title={t("staff.opPoolTitle")}
        subtitle={t("staff.opPoolSub")}
        actions={
          <button type="button" onClick={load} className="fx-btn fx-btn--ghost">
            <IconRefresh />
            Yenilə
          </button>
        }
      />

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))", gap: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => <PoolSkeleton key={i} />)}
        </div>
      ) : error ? (
        <ErrorState
          title="Müraciət sırası yüklənmədi"
          sub="Bağlantı və ya server problemi ola bilər. Yenidən cəhd edin."
          onRetry={load}
        />
      ) : total === 0 ? (
        <div className="fx-card--empty" style={{ padding: "56px 24px" }}>
          <span style={{ width: 56, height: 56, borderRadius: 16, background: "var(--brand-50)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--brand)" }}>
            <IconInbox />
          </span>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)" }}>{t("staff.opPoolEmpty")}</div>
          <div style={{ fontSize: 13.5, color: "var(--oxford-60)", fontWeight: 500 }}>Yeni müraciət gələndə burada görünəcək.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))", gap: 16 }}>
          {pendingPkgs.map(p => (
            <PoolPendingPackageCard
              key={`ppkg-${p.id}`}
              p={p}
              busy={busyId === `ppkg${p.id}`}
              onTake={() => takePendingPackage(p)}
              onOpen={() => { if (p.patientId != null) router.push(`/operator/customers/${p.patientId}`); }}
            />
          ))}
          {poolPackages.map(sessions => (
            <PoolPackageCard
              key={sessions[0].patientPackageId}
              sessions={sessions}
              busy={busyId === `pkg${sessions[0].patientPackageId}`}
              onTake={() => takePackage(sessions)}
              onOpen={() => router.push(`/operator/customers/${sessions[0].patientId}`)}
            />
          ))}
          {poolStandaloneAppts.map(a => (
            <PoolApptCard
              key={a.id}
              a={a}
              busy={busyId === `a${a.id}`}
              onTake={() => takeAppt(a)}
              onOpen={() => router.push(`/operator/appointments/${a.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ContactBtn({ href, target, label, variant = "ghost", children }: {
  href: string;
  target?: string;
  label: string;
  variant?: "ghost" | "warn-ghost";
  children: React.ReactNode;
}) {
  return (
    <a href={href} target={target} rel={target ? "noopener noreferrer" : undefined} title={label}
      onClick={e => e.stopPropagation()}
      className={`fx-btn fx-btn--${variant} fx-btn--sm`}
      style={{ textDecoration: "none" }}>
      {children}{label}
    </a>
  );
}

function PoolApptCard({
  a, busy, onTake, onOpen,
}: {
  a: AppointmentDetail;
  busy: boolean;
  onTake: () => void;
  onOpen: () => void;
}) {
  const { t } = useT();
  const meta = statusMeta(a.status);
  const phone = normalizePhone(a.patientPhone);

  return (
    <div role="button" tabIndex={0} data-pool-appt={a.id} onClick={onOpen} onKeyDown={e => { if (e.key === "Enter") onOpen(); }}
      className="fx-card"
      style={{ padding: 18, display: "flex", flexDirection: "column", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="fx-pill fx-pill--info">Seans</span>
          <span className="fx-num" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--oxford-60)", letterSpacing: ".02em" }}>#FNS-{String(a.id).padStart(4, "0")}</span>
        </div>
        <span className={`fx-pill ${statusPill(a.status)}`}>{meta.label}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 13 }}>
        <span className={`fx-avatar fx-avatar--${avatarVariant(a.patientId ?? a.id)}`}>{initialsOf(a.patientName)}</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{a.patientName ?? "—"}</div>
          <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500 }}>{timeAgo(a.createdAt) || `${fmtDt(a.createdAt)} yaradılıb`}</div>
        </div>
      </div>

      {(phone || a.patientEmail) && (
        <div style={{ display: "flex", gap: 7, marginBottom: 13, flexWrap: "wrap" }}>
          {phone && (
            <>
              <ContactBtn href={`tel:${phone}`} label="Zəng"><IconPhone /></ContactBtn>
              <ContactBtn href={whatsappLink(phone)} target="_blank" label="WhatsApp" variant="warn-ghost"><IconChat /></ContactBtn>
            </>
          )}
          {a.patientEmail && (
            <ContactBtn href={`mailto:${a.patientEmail}`} label="Email"><IconMail /></ContactBtn>
          )}
        </div>
      )}

      {a.note && (
        <div style={{ display: "flex", gap: 9, background: "var(--surface-muted)", border: "1px solid var(--hairline)", borderRadius: 8, padding: "11px 13px", marginBottom: 13 }}>
          <span style={{ color: "var(--oxford-60)", flex: "none", marginTop: 1, display: "inline-flex" }}><IconMessage /></span>
          <span style={{ fontSize: 13.5, color: "var(--oxford-80)", fontStyle: "italic", fontWeight: 500, lineHeight: 1.45 }}>«{a.note}»</span>
        </div>
      )}

      {a.requestedPsychologistName ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12.5, fontWeight: 600, color: a.origin === "DIRECT" ? "#15803D" : "var(--brand-700)", marginBottom: 15 }}>
          <IconUser />
          {/* Ad və istənilən vaxt ayrı span-larda — flex boşluğu ayırır. */}
          <span>{a.origin === "DIRECT" ? "Müştəri seçdi" : "İstənilən"}: {a.requestedPsychologistName}</span>
          {a.requestedStartAt && <span className="fx-num" style={{ color: "var(--oxford-60)" }}>{fmtDt(a.requestedStartAt)}</span>}
        </div>
      ) : (
        <div style={{ fontSize: 12.5, fontStyle: "italic", color: "var(--oxford-60)", fontWeight: 500, marginBottom: 15 }}>Psixoloq seçilməyib — operator təyin edəcək</div>
      )}

      <div style={{ display: "flex", gap: 9, marginTop: "auto" }}>
        <button type="button" onClick={e => { e.stopPropagation(); onTake(); }} disabled={busy}
          className="fx-btn fx-btn--primary" style={{ flex: 1 }}>
          <IconCheck />
          {t("staff.opTake")}
        </button>
        <button type="button" onClick={e => { e.stopPropagation(); onOpen(); }}
          className="fx-btn fx-btn--ghost" style={{ flex: "none" }}>
          {t("staff.opOpenTicket")}
        </button>
      </div>
    </div>
  );
}

const PKG_STATUS: Record<string, { label: string; pill: string }> = {
  PENDING_PAYMENT: { label: "Ödəniş gözlənilir", pill: "fx-pill--pending" },
  ACTIVE:    { label: "Aktiv",       pill: "fx-pill--paid" },
  EXHAUSTED: { label: "Tamamlanıb",  pill: "fx-pill--cancelled" },
  EXPIRED:   { label: "Vaxtı keçib", pill: "fx-pill--pending" },
  CANCELLED: { label: "Ləğv",        pill: "fx-pill--refunded" },
};

/** Paket müraciəti — SEANS deyil, öz biznes məntiqi olan ayrıca müraciət növüdür:
 *  patiyent paket alıb, operator paketi (kimin, neçə seanslıq) götürüb daxil olur.
 *  Backend bir sətri claim edəndə eyni paketə aid bütün sətirləri avtomatik operatora
 *  bağlayır (AppointmentClaimService.maybeAdoptPackage) — ona görə kart daxilində
 *  seansları ayrı-ayrı göstərmək / götürmək YOXDUR, "Götür" bütöv paketi götürür.
 *  Digər pool kartları (seans/lead) ilə eyni sıxlıqda: badge+id sətri, əsas kimlik
 *  sətri, zəngin kontent bloku (proqres), əlaqə düymələri, əməliyyat düymələri. */
function PoolPackageCard({
  sessions, busy, onTake, onOpen,
}: {
  sessions: AppointmentDetail[];
  busy: boolean;
  onTake: () => void;
  onOpen: () => void;
}) {
  const { t } = useT();
  const first = sessions[0];
  const phone = normalizePhone(first.patientPhone);
  const total = first.packageTotal ?? sessions.length;
  // completed = faktiki KEÇİRİLMİŞ seans (COMPLETED). Proqres bunun üzərində qurulur.
  const completed = first.packageCompleted ?? 0;
  // remaining = hələ PLANLAŞDIRILMAMIŞ (rezervasiya balansı) seans sayı — "qalıb" DEYİL.
  const unscheduled = Math.max(0, first.packageRemaining ?? 0);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const st = PKG_STATUS[first.packageStatus ?? "ACTIVE"] ?? PKG_STATUS.ACTIVE;
  // Pasiyentin vaxt seçdiyi seanslar — yaranış sırası ilə (qrup onsuz da sıralanıb).
  const scheduledTimes = sessions.filter(s => s.requestedStartAt || s.startAt);

  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={e => { if (e.key === "Enter") onOpen(); }}
      className="fx-card"
      style={{ padding: 18, display: "flex", flexDirection: "column", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="fx-pill" style={{ background: "var(--lilac-bg)", color: "var(--lilac)" }}>Paket müraciəti</span>
          <span className="fx-num" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--oxford-60)", letterSpacing: ".02em" }}>#PKG-{String(first.patientPackageId).padStart(4, "0")}</span>
        </div>
        <span className={`fx-pill ${st.pill}`}>{st.label}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 13 }}>
        <span style={{ width: 42, height: 42, borderRadius: 12, background: "var(--lilac-bg)", color: "var(--lilac)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <IconPackage />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{first.packageName ?? "Paket"}</div>
          <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500 }}>{timeAgo(first.createdAt) || `${fmtDt(first.createdAt)} yaradılıb`}</div>
        </div>
      </div>

      <div style={{ background: "var(--surface-muted)", border: "1px solid var(--hairline)", borderRadius: 10, padding: "11px 13px", marginBottom: 13 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--oxford)" }}><span className="fx-num">{completed}/{total}</span> seans keçirilib</span>
        </div>
        <div className="fx-progress">
          <div className="fx-progress__fill" style={{ width: `${pct}%` }} />
        </div>
        {unscheduled > 0 && (
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--oxford-60)", marginTop: 7 }}>
            <span className="fx-num">{unscheduled}</span> seans planlaşdırılmayıb
          </div>
        )}
      </div>

      {/* Pasiyentin planlaşdırdığı seans vaxtları — hər seans ayrıca sətirdə.
          Kart paketi bütöv götürür, amma operator hansı vaxtların seçildiyini
          görməlidir (əvvəl yalnız aqreqat proqres vardı, ayrı vaxtlar görünmürdü). */}
      {scheduledTimes.length > 0 && (
        <div style={{ marginBottom: 13 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--oxford)", marginBottom: 6 }}>Planlaşdırılmış seanslar</div>
          <div style={{ display: "grid", gap: 5 }}>
            {scheduledTimes.map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12.5 }}>
                <span className="fx-num" style={{ fontWeight: 600, color: "var(--oxford)" }}>{fmtDt(s.requestedStartAt ?? s.startAt)}</span>
                <span style={{ color: "var(--oxford-60)", fontWeight: 500 }}>{statusMeta(s.status).label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 13 }}>
        <span className={`fx-avatar fx-avatar--${avatarVariant(first.patientId ?? first.id)}`}>{initialsOf(first.patientName)}</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{first.patientName ?? "—"}</div>
          <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600 }}>Pasiyent</div>
        </div>
      </div>

      {(phone || first.patientEmail) && (
        <div style={{ display: "flex", gap: 7, marginBottom: 15, flexWrap: "wrap" }}>
          {phone && (
            <>
              <ContactBtn href={`tel:${phone}`} label="Zəng"><IconPhone /></ContactBtn>
              <ContactBtn href={whatsappLink(phone)} target="_blank" label="WhatsApp" variant="warn-ghost"><IconChat /></ContactBtn>
            </>
          )}
          {first.patientEmail && (
            <ContactBtn href={`mailto:${first.patientEmail}`} label="Email"><IconMail /></ContactBtn>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 9, marginTop: "auto" }}>
        <button type="button" onClick={e => { e.stopPropagation(); onTake(); }} disabled={busy}
          className="fx-btn fx-btn--primary" style={{ flex: 1 }}>
          <IconCheck />
          {t("staff.opTake")}
        </button>
        <button type="button" onClick={e => { e.stopPropagation(); onOpen(); }}
          className="fx-btn fx-btn--ghost" style={{ flex: "none" }}>
          Müştəri profili
        </button>
      </div>
    </div>
  );
}

/** Randevusu olmayan (SCHEDULE_LATER) SAHİBSİZ paket — pasiyent alıb, ödəniş hələ
 *  təsdiqlənməyib. Operator "Götür"ür → paket ona keçir, ödənişi onun "Ödənişlər"ində
 *  görünür (ayrıca ödəniş pool-u yoxdur). Progress yoxdur (heç bir seans planlanmayıb). */
function PoolPendingPackageCard({
  p, busy, onTake, onOpen,
}: {
  p: PackagePoolItem;
  busy: boolean;
  onTake: () => void;
  onOpen: () => void;
}) {
  const { t } = useT();
  const phone = normalizePhone(p.patientPhone);

  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={e => { if (e.key === "Enter") onOpen(); }}
      className="fx-card"
      style={{ padding: 18, display: "flex", flexDirection: "column", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="fx-pill" style={{ background: "var(--lilac-bg)", color: "var(--lilac)" }}>Paket müraciəti</span>
          <span className="fx-num" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--oxford-60)", letterSpacing: ".02em" }}>#PKG-{String(p.id).padStart(4, "0")}</span>
        </div>
        <span className="fx-pill fx-pill--pending">Ödəniş gözlənilir</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 13 }}>
        <span style={{ width: 42, height: 42, borderRadius: 12, background: "var(--lilac-bg)", color: "var(--lilac)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <IconPackage />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{p.packageName ?? "Paket"}</div>
          <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 500 }}>{timeAgo(p.purchasedAt) || `${fmtDt(p.purchasedAt)} alınıb`}</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "var(--surface-muted)", border: "1px solid var(--hairline)", borderRadius: 10, padding: "11px 13px", marginBottom: 13, fontSize: 12.5, fontWeight: 600, color: "var(--oxford)" }}>
        <span className="fx-num">{p.totalSessions}</span> seanslıq paket
        {p.psychologistName && <span style={{ color: "var(--oxford-60)" }}>· {p.psychologistName}</span>}
        {p.pricePaid != null && <span className="fx-num" style={{ marginLeft: "auto", color: "var(--brand-700)" }}>{p.pricePaid} {p.currency ?? "AZN"}</span>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 13 }}>
        <span className={`fx-avatar fx-avatar--${avatarVariant(p.patientId ?? p.id)}`}>{initialsOf(p.patientName)}</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--oxford)" }}>{p.patientName ?? "—"}</div>
          <div style={{ fontSize: 12.5, color: "var(--oxford-60)", fontWeight: 600 }}>Pasiyent</div>
        </div>
      </div>

      {(phone || p.patientEmail) && (
        <div style={{ display: "flex", gap: 7, marginBottom: 15, flexWrap: "wrap" }}>
          {phone && (
            <>
              <ContactBtn href={`tel:${phone}`} label="Zəng"><IconPhone /></ContactBtn>
              <ContactBtn href={whatsappLink(phone)} target="_blank" label="WhatsApp" variant="warn-ghost"><IconChat /></ContactBtn>
            </>
          )}
          {p.patientEmail && (
            <ContactBtn href={`mailto:${p.patientEmail}`} label="Email"><IconMail /></ContactBtn>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 9, marginTop: "auto" }}>
        <button type="button" onClick={e => { e.stopPropagation(); onTake(); }} disabled={busy}
          className="fx-btn fx-btn--primary" style={{ flex: 1 }}>
          <IconCheck />
          {t("staff.opTake")}
        </button>
        <button type="button" onClick={e => { e.stopPropagation(); onOpen(); }}
          className="fx-btn fx-btn--ghost" style={{ flex: "none" }}>
          Müştəri profili
        </button>
      </div>
    </div>
  );
}

function PoolSkeleton() {
  return (
    <div className="fx-card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <div className="fx-skeleton" style={{ width: 90, height: 14 }} />
        <div className="fx-skeleton" style={{ width: 54, height: 20, borderRadius: 999 }} />
      </div>
      <div style={{ display: "flex", gap: 11, marginBottom: 14 }}>
        <div className="fx-skeleton fx-skeleton--circle" style={{ width: 40, height: 40 }} />
        <div style={{ flex: 1, paddingTop: 3 }}>
          <div className="fx-skeleton" style={{ width: "60%", height: 14, marginBottom: 8 }} />
          <div className="fx-skeleton" style={{ width: "35%", height: 11 }} />
        </div>
      </div>
      <div className="fx-skeleton" style={{ width: "100%", height: 42, borderRadius: 10, marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 9 }}>
        <div className="fx-skeleton" style={{ flex: 1, height: 42, borderRadius: 10 }} />
        <div className="fx-skeleton" style={{ width: 84, height: 42, borderRadius: 10 }} />
      </div>
    </div>
  );
}

/* ---------- İkonlar (inline SVG, icons.svg-dən) ---------- */
function IconRefresh() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" /><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
function IconPhone() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><path d="M22 6l-10 7L2 6" />
    </svg>
  );
}
function IconMessage() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
function IconUser() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IconPackage() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" />
    </svg>
  );
}
function IconInbox() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}
