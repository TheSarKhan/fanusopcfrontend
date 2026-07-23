"use client";

import { useEffect, useState } from "react";
import { patientApi, type PatientPackageItem, type AppointmentDetail } from "@/lib/api";
import DatePicker from "@/components/DatePicker";
import TimePicker from "@/components/TimePicker";
import PageHeader from "@/components/PageHeader";
import { toast } from "@/components/Toast";
import { azLocalToISO, azFormatDate, azFormatDateTime } from "@/lib/datetime";
import { formatAzn } from "@/lib/money";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

/** Maps backend status → pkg.* label key. */
const STATUS_LABEL: Record<string, MessageKey> = {
  PENDING_PAYMENT: "pkg.pendingPayment",
  ACTIVE: "pkg.active",
  EXHAUSTED: "pkg.exhausted",
  EXPIRED: "pkg.expired",
  CANCELLED: "pkg.cancelled",
};

const STATUS_TONE: Record<string, { color: string; bg: string }> = {
  PENDING_PAYMENT: { color: "#92400E", bg: "#FEF3C7" },
  ACTIVE:    { color: "#065F46", bg: "#D1FAE5" },
  EXHAUSTED: { color: "#374151", bg: "#F3F4F6" },
  EXPIRED:   { color: "#92400E", bg: "#FEF3C7" },
  CANCELLED: { color: "#991B1B", bg: "#FEE2E2" },
};

const PAGE_SIZE = 30;

export default function PatientPackagesPage() {
  const { t } = useT();
  const [items, setItems] = useState<PatientPackageItem[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Paketdən planlanmış seanslar: randevular `patientPackageId` daşıyır, ona görə
  // bir dəfə çəkib paket üzrə qruplaşdırırıq (backend dəyişikliyi lazım deyil).
  // Əvvəl kartda yalnız "qalan/ümumi" vardı — hansı tarixlərin seçildiyi görünmürdü.
  const [byPackage, setByPackage] = useState<Record<number, AppointmentDetail[]>>({});

  const loadSessions = () => {
    patientApi.myAppointments()
      .then(list => {
        const map: Record<number, AppointmentDetail[]> = {};
        for (const a of list) {
          if (a.patientPackageId == null) continue;
          (map[a.patientPackageId] ??= []).push(a);
        }
        for (const k of Object.keys(map)) {
          map[Number(k)].sort((x, y) =>
            new Date(x.startAt ?? 0).getTime() - new Date(y.startAt ?? 0).getTime());
        }
        setByPackage(map);
      })
      .catch(() => {});
  };

  const load = () => {
    setLoading(true);
    patientApi.myPackagesPaged({ page: 0, size: PAGE_SIZE })
      .then(res => {
        setItems(res.content);
        setTotalElements(res.totalElements);
        setPage(0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    loadSessions();
  };

  useEffect(load, []);

  const loadMore = () => {
    setLoadingMore(true);
    patientApi.myPackagesPaged({ page: page + 1, size: PAGE_SIZE })
      .then(res => {
        setItems(prev => [...prev, ...res.content]);
        setTotalElements(res.totalElements);
        setPage(res.page);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  const hasMore = items.length < totalElements;

  return (
    <div className="psy-appt-page">
      <PageHeader title={t("pkg.myPackages")} subtitle="Aldığınız paketləri və qalan seansları buradan izləyin" />

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "var(--oxford-60)" }}>
          Yüklənir…
        </div>
      ) : items.length === 0 ? (
        <div style={{
          background: "#fff", borderRadius: 12, padding: 28,
          textAlign: "center", color: "var(--oxford-60)", fontSize: 13,
          border: "1px dashed var(--brand-100)",
        }}>
          {t("pkg.noPackages")}
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 12 }}>
            {items.map(p => (
              <PackageCard key={p.id} pkg={p} sessions={byPackage[p.id] ?? []} onScheduled={load} />
            ))}
          </div>

          {hasMore && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button type="button" onClick={loadMore} disabled={loadingMore}
                style={{ background: "#fff", color: "var(--brand)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 22px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: loadingMore ? "wait" : "pointer", opacity: loadingMore ? 0.7 : 1 }}>
                {loadingMore ? "Yüklənir…" : `Daha çox göstər (+${Math.min(PAGE_SIZE, totalElements - items.length)})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PackageCard({ pkg, sessions, onScheduled }:
  { pkg: PatientPackageItem; sessions: AppointmentDetail[]; onScheduled: () => void }) {
  const { t } = useT();
  // Tarix və saat AYRI sahələrdir. Əvvəl tək `withTime` DatePicker vardı: saat
  // sətri təqvimin altında qaldığı üçün gözə dəymirdi və seçilməyəndə cari
  // vaxt (məs. 15:28) möhürlənirdi. İndi saat açıq şəkildə seçilir.
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  // Planlaşdırma forması daimi açıq idi — kartı ağırlaşdırırdı. İndi istəyə görə açılır.
  const [formOpen, setFormOpen] = useState(false);

  const tone = STATUS_TONE[pkg.status] ?? STATUS_TONE.ACTIVE;
  const statusLabel = t(STATUS_LABEL[pkg.status] ?? "pkg.active");
  const canSchedule = pkg.status === "ACTIVE" && pkg.remaining > 0;

  const submit = async () => {
    if (!date) { toast("Tarix seçin", "error"); return; }
    if (!time) { toast("Saat seçin", "error"); return; }
    setSaving(true);
    try {
      await patientApi.schedulePackageSession(pkg.id, { startAt: azLocalToISO(`${date}T${time}`) });
      setScheduled(true);
      setDate(""); setTime("");
      onScheduled();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  // "İstifadə olunub" = KEÇİRİLMİŞ seans. Əvvəl total-remaining işlədilirdi,
  // o isə REZERV sayıdır: paket alınıb bütün vaxtlar seçiləndə kart dərhal
  // "hamısı istifadə olunub, 0 qalıb" göstərirdi, halbuki heç bir seans
  // keçirilməmişdi. İki fərqli rəqəm var və ikisi də ayrıca göstərilir.
  const used = pkg.completed;
  const unscheduled = pkg.remaining;
  const usedPct = pkg.total > 0 ? Math.round((used / pkg.total) * 100) : 0;

  return (
    <div className="pnl-card">
      {/* 1) Kimlik — paket + psixoloq, sağda status. */}
      <div className="pnl-card__head">
        <div style={{ minWidth: 0 }}>
          <h2 className="pnl-card__title">{pkg.packageName}</h2>
          <p className="pnl-card__sub">{pkg.psychologistName}</p>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: "none" }}>
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: tone.color }} />
          <span style={{ fontSize: 12.5, color: "var(--oxford-60)", whiteSpace: "nowrap" }}>{statusLabel}</span>
        </span>
      </div>

      {/* 2) Əsas rəqəm — üç üzən "etiket/dəyər" cütü əvəzinə tək aydın cümlə + zolaq. */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--oxford)" }}>
            {pkg.total} seansdan {used} keçirilib
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)", fontVariantNumeric: "tabular-nums" }}>
            {unscheduled > 0 ? `${unscheduled} seans planlaşdırılmayıb` : "Bütün seanslar planlaşdırılıb"}
          </span>
        </div>
        <div style={{ marginTop: 8, height: 4, borderRadius: 999, background: "var(--oxford-10)", overflow: "hidden" }}>
          <div style={{ width: `${usedPct}%`, height: "100%", background: "var(--brand)", borderRadius: 999 }} />
        </div>
      </div>

      {/* Ödəniş gözlənilir — pasiyent paketi görür, amma operator ödənişi təsdiqləyənə
          qədər seans planlaya bilmir (canSchedule=false). Səbəbi açıq göstərilir. */}
      {pkg.status === "PENDING_PAYMENT" && (
        <div style={{ marginBottom: 12, background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 8, padding: "8px 11px", fontSize: 12, color: "#92400E", lineHeight: 1.5 }}>
          Ödəniş operator tərəfindən təsdiqləndikdən sonra seansları planlaya biləcəksiniz.
        </div>
      )}

      {/* 3) Əsas məzmun — seanslar. Düymə başlığın sağındadır, forma gizlidir. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--oxford)" }}>Seans tarixləri</span>
        {canSchedule && !formOpen && (
          <button type="button" onClick={() => setFormOpen(true)} className="pnl-btn pnl-btn--ghost" style={{ flex: "none" }}>
            {t("pkg.scheduleSession")}
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--oxford-60)" }}>
          Hələ seans planlaşdırılmayıb.
        </p>
      ) : (
        <div>
          {sessions.map(sess => (
            <div key={sess.id} className="pnl-row">
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--oxford)", fontVariantNumeric: "tabular-nums" }}>
                {sess.startAt ? azFormatDateTime(sess.startAt) : "Vaxt təyin edilməyib"}
              </span>
              <SessionStatus status={sess.status} />
            </div>
          ))}
        </div>
      )}

      {/* 4) Planlaşdırma — yalnız istənəndə açılır (daimi forma kartı ağırlaşdırırdı). */}
      {canSchedule && formOpen && (
        <div style={{ marginTop: 12, background: "var(--brand-50)", border: "1px solid var(--brand-100)", borderRadius: 10, padding: 12 }}>
          {pkg.schedulingMode === "SCHEDULE_LATER" && (
            <p style={{ fontSize: 12, color: "var(--oxford-60)", margin: "0 0 8px", lineHeight: 1.5 }}>
              {t("pkg.scheduleLaterHint")}
            </p>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <DatePicker
              value={date}
              onChange={v => { setDate(v); setScheduled(false); }}
              placeholder="gg.aa.iiii"
              theme="light"
              size="sm"
              style={{ flex: "1 1 170px" }}
            />
            <TimePicker
              value={time}
              onChange={v => { setTime(v); setScheduled(false); }}
              theme="light"
              size="sm"
              style={{ flex: "0 1 120px" }}
            />
            <button type="button" onClick={submit} disabled={saving} className="pnl-btn" style={{ flex: "none" }}>
              {saving ? "Göndərilir…" : "Təsdiqlə"}
            </button>
            <button type="button" onClick={() => { setFormOpen(false); setDate(""); setTime(""); }}
              className="pnl-btn pnl-btn--ghost" style={{ flex: "none" }}>
              Ləğv
            </button>
          </div>
          {scheduled && (
            <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--brand-700)", lineHeight: 1.5 }}>
              {t("pkg.pendingNote")}
            </p>
          )}
        </div>
      )}

      {/* 5) Meta — ikinci dərəcəli, tək sətir. Ödəniş hələ təsdiqlənməyibsə
          "ödənilib" yazmaq yanlışdır — status PENDING_PAYMENT olanda məbləğ
          gözlənilən ödənişdir, edilmiş deyil. */}
      <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--oxford-60)" }}>
        {pkg.status === "PENDING_PAYMENT"
          ? `${formatAzn(pkg.pricePaid)} ödəniləcək, ${azFormatDate(pkg.purchasedAt)} tarixində alınıb`
          : `${formatAzn(pkg.pricePaid)} ödənilib, ${azFormatDate(pkg.purchasedAt)} tarixində alınıb`}
      </p>
    </div>
  );
}

/** Seans statusu — pill deyil, rəngli nöqtə + düz mətn (panel dili ilə eyni). */
const SESSION_STATUS: Record<string, { label: string; color: string }> = {
  PENDING:   { label: "Gözləyir",   color: "#D97706" },
  ASSIGNED:  { label: "Təyin olunub", color: "#2563EB" },
  CONFIRMED: { label: "Təsdiqli",   color: "#16A34A" },
  COMPLETED: { label: "Tamamlandı", color: "#64748B" },
  CANCELLED: { label: "Ləğv",       color: "#991B1B" },
  REJECTED:  { label: "Rədd",       color: "#991B1B" },
  DISPUTED:  { label: "Mübahisəli", color: "#991B1B" },
};

function SessionStatus({ status }: { status: string }) {
  const s = SESSION_STATUS[status] ?? { label: status, color: "var(--oxford-60)" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: "none" }}>
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
      <span style={{ fontSize: 12.5, color: "var(--oxford-60)", whiteSpace: "nowrap" }}>{s.label}</span>
    </span>
  );
}

