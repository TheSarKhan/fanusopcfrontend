"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { operatorApi, type PackageDto, type Psychologist, type SessionRequest } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import DatePicker from "@/components/DatePicker";
import { toast as uiToast } from "@/components/Toast";

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  NEW:       { label: "Yeni",        bg: "#FEF3C7", color: "#92400E" },
  IN_REVIEW: { label: "Baxılır",     bg: "#DBEAFE", color: "#1E40AF" },
  CONVERTED: { label: "Çevrilib",    bg: "#D1FAE5", color: "#065F46" },
  CANCELLED: { label: "Ləğv edilib", bg: "#FEE2E2", color: "#991B1B" },
};

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <div style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid #F3F4F6" }}>
      <span style={{ minWidth: 160, color: "#6B7280", fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export default function SessionRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const me = getStoredUser();

  const [req, setReq] = useState<SessionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimBusy, setClaimBusy] = useState(false);
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);

  // Randevuya çevir
  const [psyId, setPsyId] = useState<number | "">("");
  const [startAt, setStartAt] = useState("");
  const [note, setNote] = useState("");
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState("");

  // Paket sat
  const [pkgOpen, setPkgOpen] = useState(false);
  const [pkgMode, setPkgMode] = useState<"catalog" | "custom">("catalog");
  const [catalog, setCatalog] = useState<PackageDto[]>([]);
  const [catalogId, setCatalogId] = useState<number | "">("");
  const [pkgName, setPkgName] = useState("");
  const [pkgSessions, setPkgSessions] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  const [sellingPkg, setSellingPkg] = useState(false);
  const [pkgError, setPkgError] = useState("");

  const [cancelBusy, setCancelBusy] = useState(false);

  const load = useCallback(() => {
    operatorApi.getSessionRequest(Number(id)).then(data => {
      setReq(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { operatorApi.listPsychologists().then(setPsychologists).catch(() => {}); }, []);

  useEffect(() => {
    setCatalog([]); setCatalogId("");
    if (!pkgOpen || pkgMode !== "catalog" || !psyId) return;
    operatorApi.psychologistPackages(Number(psyId))
      .then(list => setCatalog(list.filter(p => p.active !== false)))
      .catch(() => setCatalog([]));
  }, [pkgOpen, pkgMode, psyId]);

  if (loading) return <div style={{ padding: 32, color: "#6B7280" }}>Yüklənir...</div>;
  if (!req) return <div style={{ padding: 32, color: "#991B1B" }}>Müraciət tapılmadı.</div>;

  const badge = STATUS_BADGE[req.status] ?? { label: req.status, bg: "#F3F4F6", color: "#374151" };
  const mine = me != null && req.claimedByUserId === me.userId;
  const unclaimed = req.claimedByUserId == null;
  const claimedByOther = !unclaimed && !mine;
  const isConverted = req.status === "CONVERTED";
  const isCancelled = req.status === "CANCELLED";
  const canAct = mine && !isConverted && !isCancelled;

  const claim = () => {
    setClaimBusy(true);
    operatorApi.claimSessionRequest(req.id)
      .then(() => { uiToast("Müraciət götürüldü", "success"); load(); })
      .catch(e => uiToast((e as Error).message, "error"))
      .finally(() => setClaimBusy(false));
  };

  const release = () => {
    setClaimBusy(true);
    operatorApi.releaseSessionRequest(req.id)
      .then(() => { uiToast("Müraciət hovuza buraxıldı", "success"); load(); })
      .catch(e => uiToast((e as Error).message, "error"))
      .finally(() => setClaimBusy(false));
  };

  const cancel = () => {
    if (!window.confirm("Müraciəti ləğv etmək istədiyinizə əminsiniz?")) return;
    setCancelBusy(true);
    operatorApi.updateSessionRequestStatus(req.id, { status: "CANCELLED" })
      .then(() => { uiToast("Müraciət ləğv edildi", "success"); load(); })
      .catch(e => uiToast((e as Error).message, "error"))
      .finally(() => setCancelBusy(false));
  };

  const convertToAppointment = async () => {
    if (!psyId) { setConvertError("Psixoloq seçin"); return; }
    if (!startAt) { setConvertError("Vaxt seçin"); return; }
    setConvertError("");
    setConverting(true);
    try {
      const updated = await operatorApi.convertSessionRequestToAppointment(req.id, {
        psychologistId: Number(psyId), startAt, note: note.trim() || undefined,
      });
      setReq(updated);
      uiToast("Randevu yaradıldı", "success");
    } catch (e) {
      setConvertError((e as Error).message ?? "Xəta baş verdi");
    } finally {
      setConverting(false);
    }
  };

  const sellPackage = async () => {
    if (!psyId) { setPkgError("Psixoloq seçin"); return; }
    setPkgError("");
    if (pkgMode === "catalog" && !catalogId) { setPkgError("Kataloqdan paket seçin"); return; }
    if (pkgMode === "custom") {
      const s = Number(pkgSessions), p = Number(pkgPrice);
      if (!Number.isFinite(s) || s < 1) { setPkgError("Seans sayı düzgün deyil"); return; }
      if (!Number.isFinite(p) || p < 0) { setPkgError("Qiymət düzgün deyil"); return; }
    }
    setSellingPkg(true);
    try {
      const updated = await operatorApi.convertSessionRequestToPackage(req.id,
        pkgMode === "catalog"
          ? { sessionPackageId: Number(catalogId) }
          : { psychologistId: Number(psyId), packageName: pkgName.trim() || undefined, sessionCount: Number(pkgSessions), price: Number(pkgPrice) });
      setReq(updated);
      uiToast("Paket satıldı", "success");
    } catch (e) {
      setPkgError((e as Error).message ?? "Xəta baş verdi");
    } finally {
      setSellingPkg(false);
    }
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <button onClick={() => router.push("/operator/session-requests")}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#52718F", fontSize: 13, padding: 0 }}>
          ← Geri
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0B1A35" }}>Müraciət #{req.id}</h1>
        <span style={{ background: badge.bg, color: badge.color, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
          {badge.label}
        </span>
        {req.priority && (
          <span style={{ background: "#FEF3C7", color: "#92400E", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700, border: "1px solid #FCD34D" }}>
            Prioritet
          </span>
        )}
      </div>

      {claimedByOther && (
        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 13.5, color: "#1E40AF", fontWeight: 600 }}>
          Bu müraciəti hazırda {req.claimedByName} aparır — yalnız o çevirmə/ləğv edə bilər.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: unclaimed || claimedByOther || isConverted || isCancelled ? "1fr" : "1fr 380px", gap: 24, alignItems: "start" }}>
        <div>
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#0B1A35", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Müraciət məlumatları
            </h2>
            <InfoRow label="Ad Soyad" value={req.name} />
            <InfoRow label="Telefon" value={req.phone} />
            <InfoRow label="E-poçt" value={req.email} />
            <InfoRow label="Yaş" value={req.age} />
            <InfoRow label="Büdcə" value={req.budget} />
            <InfoRow label="Göndərildi" value={new Date(req.createdAt).toLocaleString("az-AZ")} />
          </div>

          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "#0B1A35", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Müraciətin səbəbi
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: "#111827", lineHeight: 1.6 }}>{req.reason}</p>
          </div>

          {(req.preferredDate || req.preferredTime || req.notes) && (
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
              <h2 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#0B1A35", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Əlavə məlumat
              </h2>
              <InfoRow label="Üstünlük verilən tarix" value={req.preferredDate} />
              <InfoRow label="Üstünlük verilən saat" value={req.preferredTime} />
              {req.notes && (
                <div style={{ marginTop: 12, fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                  <span style={{ color: "#6B7280" }}>Əlavə qeydlər: </span>{req.notes}
                </div>
              )}
            </div>
          )}

          {isConverted && (
            <div style={{ background: "#D1FAE5", border: "1px solid #6EE7B7", borderRadius: 12, padding: "20px 24px" }}>
              <h2 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#065F46", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Çevrilib
              </h2>
              {req.convertedAppointmentId && (
                <button onClick={() => router.push(`/operator/appointments/${req.convertedAppointmentId}`)}
                  style={{ background: "#065F46", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginRight: 10 }}>
                  Randevuya bax
                </button>
              )}
              {req.convertedPatientId && (
                <button onClick={() => router.push(`/operator/customers/${req.convertedPatientId}`)}
                  style={{ background: "#fff", color: "#065F46", border: "1px solid #6EE7B7", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Müştəri profilinə bax
                </button>
              )}
            </div>
          )}

          {isCancelled && (
            <div style={{ background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 12, padding: "16px 20px" }}>
              <p style={{ margin: 0, fontSize: 13, color: "#991B1B", fontWeight: 500 }}>Bu müraciət ləğv edilib.</p>
              {mine && (
                <button onClick={() => operatorApi.updateSessionRequestStatus(req.id, { status: "IN_REVIEW" }).then(load)}
                  style={{ marginTop: 10, padding: "7px 14px", background: "#fff", color: "#374151", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                  Bərpa et
                </button>
              )}
            </div>
          )}
        </div>

        {unclaimed && (
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "20px 24px" }}>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6B7280" }}>
              Bu müraciət hələ heç kimə aid deyil. Götürsəniz yalnız siz görəcəksiniz.
            </p>
            <button onClick={claim} disabled={claimBusy}
              style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, background: "#047857", color: "#fff", border: "none", borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, cursor: claimBusy ? "wait" : "pointer", opacity: claimBusy ? 0.6 : 1 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              Götür
            </button>
          </div>
        )}

        {canAct && !req.email && (
          <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 12, padding: "16px 20px" }}>
            <p style={{ margin: 0, fontSize: 13, color: "#92400E", fontWeight: 600 }}>
              Bu müraciətdə email yoxdur. Pasiyent hesabı yaratmaq üçün email tələb olunur —
              zəng edib email öyrənin, sonra çevirməyə davam edin.
            </p>
          </div>
        )}

        {canAct && req.email && (
          <div>
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
              <h2 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#0B1A35", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Randevuya çevir
              </h2>
              {convertError && (
                <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>{convertError}</div>
              )}
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Psixoloq *</label>
              <select value={psyId} onChange={e => setPsyId(e.target.value === "" ? "" : Number(e.target.value))}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13, marginBottom: 12, boxSizing: "border-box" }}>
                <option value="">Psixoloq seçin...</option>
                {psychologists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>

              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Seans tarixi/saatı *</label>
              <DatePicker value={startAt} onChange={setStartAt} placeholder="gg.aa.iiii ss:dd" theme="light" withTime style={{ width: "100%", marginBottom: 12 }} />

              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Qeyd</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="Daxili qeyd (istifadəçiyə göstərilmir)"
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13, resize: "vertical", boxSizing: "border-box", marginBottom: 14 }} />

              <button onClick={convertToAppointment} disabled={converting}
                style={{ width: "100%", padding: "10px 0", background: "#5A4FC8", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: converting ? "not-allowed" : "pointer", opacity: converting ? 0.7 : 1 }}>
                {converting ? "Göndərilir..." : "Randevu yarat"}
              </button>
              <p style={{ margin: "8px 0 0", fontSize: 11, color: "#9CA3AF", textAlign: "center" }}>
                {req.email ? "Yeni hesab yaransa pasiyentə şifrə təyini üçün email göndəriləcək." : "Email yoxdur — hesab yaransa dəvət göndərilməyəcək."}
              </p>
            </div>

            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: pkgOpen ? 16 : 0 }}>
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#0B1A35", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Paket sat
                </h2>
                <button onClick={() => setPkgOpen(o => !o)} style={{ background: "none", border: "none", color: "#5A4FC8", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                  {pkgOpen ? "Bağla" : "Aç"}
                </button>
              </div>
              {pkgOpen && (
                <>
                  {pkgError && (
                    <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>{pkgError}</div>
                  )}
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Psixoloq *</label>
                  <select value={psyId} onChange={e => setPsyId(e.target.value === "" ? "" : Number(e.target.value))}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13, marginBottom: 12, boxSizing: "border-box" }}>
                    <option value="">Psixoloq seçin...</option>
                    {psychologists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>

                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <button onClick={() => setPkgMode("catalog")}
                      style={{ flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: pkgMode === "catalog" ? "1px solid #5A4FC8" : "1px solid #D1D5DB", background: pkgMode === "catalog" ? "#EEF2FF" : "#fff", color: pkgMode === "catalog" ? "#5A4FC8" : "#374151" }}>
                      Kataloqdan
                    </button>
                    <button onClick={() => setPkgMode("custom")}
                      style={{ flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: pkgMode === "custom" ? "1px solid #5A4FC8" : "1px solid #D1D5DB", background: pkgMode === "custom" ? "#EEF2FF" : "#fff", color: pkgMode === "custom" ? "#5A4FC8" : "#374151" }}>
                      Xüsusi
                    </button>
                  </div>

                  {pkgMode === "catalog" ? (
                    <select value={catalogId} onChange={e => setCatalogId(e.target.value === "" ? "" : Number(e.target.value))}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13, marginBottom: 12, boxSizing: "border-box" }}>
                      <option value="">Paket seçin...</option>
                      {catalog.map(p => <option key={p.id} value={p.id}>{p.name} — {p.sessionCount} seans — {p.packagePrice} AZN</option>)}
                    </select>
                  ) : (
                    <>
                      <input type="text" value={pkgName} onChange={e => setPkgName(e.target.value)} placeholder="Paket adı (opsional)"
                        style={{ width: "100%", padding: "8px 10px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13, marginBottom: 8, boxSizing: "border-box" }} />
                      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                        <input type="number" min={1} value={pkgSessions} onChange={e => setPkgSessions(e.target.value)} placeholder="Seans sayı"
                          style={{ flex: 1, padding: "8px 10px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
                        <input type="number" min={0} value={pkgPrice} onChange={e => setPkgPrice(e.target.value)} placeholder="Qiymət (AZN)"
                          style={{ flex: 1, padding: "8px 10px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
                      </div>
                    </>
                  )}

                  <button onClick={sellPackage} disabled={sellingPkg}
                    style={{ width: "100%", padding: "10px 0", background: "#B45309", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: sellingPkg ? "not-allowed" : "pointer", opacity: sellingPkg ? 0.7 : 1 }}>
                    {sellingPkg ? "Göndərilir..." : "Paketi sat"}
                  </button>
                </>
              )}
            </div>

            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "20px 24px", display: "flex", gap: 10 }}>
              <button onClick={release} disabled={claimBusy}
                style={{ flex: 1, padding: "9px 0", background: "#fff", color: "#374151", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: claimBusy ? "not-allowed" : "pointer" }}>
                Hovuza buraxdır
              </button>
              <button onClick={cancel} disabled={cancelBusy}
                style={{ flex: 1, padding: "9px 0", background: "#FEE2E2", color: "#991B1B", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: cancelBusy ? "not-allowed" : "pointer" }}>
                Ləğv et
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
