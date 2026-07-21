"use client";

/**
 * Operatorun pasiyent adına randevu yaratması (telefon intake).
 * İki istifadə:
 *   - Randevular səhifəsi: pasiyenti axtar/yarat → psixoloq → (ops.) paket → seans.
 *   - Müştəri 360° profili: {@code presetPatientId} verilir → pasiyent kilidli,
 *     birbaşa psixoloq + (ops.) paket + seans.
 * Paket seçilərsə ilk seans paketdən sərf olunur ({@code patientPackageId}).
 */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { operatorApi, getPsychologistAvailability, type OperatorSearchHit, type PackageDto, type IntroEligibility, type AvailableSlot, type PatientLookupResult } from "@/lib/api";
import DatePicker from "@/components/DatePicker";
import { azFormatDate, azFormatTime, azFormatWeekday, isoToAzLocal } from "@/lib/datetime";
import { toast as uiToast } from "@/components/Toast";

/** Dublikat xəbərdarlığında rolun Azərbaycanca adı. */
function roleLabel(role?: string | null): string {
  switch (role) {
    case "PSYCHOLOGIST": return "psixoloq";
    case "OPERATOR": return "operator";
    case "ADMIN": return "admin";
    default: return "başqa";
  }
}

/** Yerli tarixi YYYY-MM-DD formatına salır (availability sorğu sərhədləri üçün). */
function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function OnBehalfBookingModal({ onClose, onDone, presetPatientId, presetPatientLabel }: {
  onClose: () => void;
  onDone: () => void;
  presetPatientId?: number;
  presetPatientLabel?: string;
}) {
  const locked = presetPatientId != null;
  const [mode, setMode] = useState<"search" | "new">("search");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<OperatorSearchHit[]>([]);
  const [patientId, setPatientId] = useState<number | null>(presetPatientId ?? null);
  const [patientLabel, setPatientLabel] = useState(presetPatientLabel ?? "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [psyId, setPsyId] = useState<number | null>(null);
  const [psys, setPsys] = useState<{ id: number; name?: string | null; defaultSessionMinutes?: number | null }[]>([]);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  // Seçilmiş psixoloqun boş vaxtları (yaxın 14 gün) — operator uyğun slot seçsin.
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // "Yeni pasiyent" formasında email/telefon artıq bazadadırsa — operator dublikat
  // yaratdığını düşünməsin deyə forma yazılarkən xəbərdarlıq göstərilir.
  const [dup, setDup] = useState<PatientLookupResult | null>(null);
  // Paketsiz tək seansın qiyməti — ilkin dəyər psixoloqun fərdi qiyməti, operator dəyişə bilər.
  const [price, setPrice] = useState("");
  const [priceBase, setPriceBase] = useState<number | null>(null);
  // Pasient bu psixoloqu özü seçib müraciət edibsə komissiyasız/azaldılmış faiz tətbiq olunur.
  const [patientChoseDirectly, setPatientChoseDirectly] = useState(false);
  // Pulsuz tanışlıq (INTRO, 15 dəq) görüşü — yalnız pasiyent məlum olduqda yoxlanır.
  const [introStatus, setIntroStatus] = useState<IntroEligibility | null>(null);
  const [sessionKind, setSessionKind] = useState<"STANDARD" | "INTRO">("STANDARD");
  // Opsional paket satışı
  const [sellPkg, setSellPkg] = useState(false);
  const [pkgMode, setPkgMode] = useState<"catalog" | "custom">("catalog");
  const [catalog, setCatalog] = useState<PackageDto[]>([]);
  const [catalogId, setCatalogId] = useState<number | null>(null);
  const [pkgName, setPkgName] = useState("");
  const [pkgSessions, setPkgSessions] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  // Paketin qalan seansları üçün də operator burada vaxt seçə bilər (boş buraxıla bilər — sonra randevu detalından təyin edilir).
  const [extraTimes, setExtraTimes] = useState<{ start: string; end: string }[]>([]);

  useEffect(() => { operatorApi.listPsychologists().then(setPsys).catch(() => {}); }, []);
  useEffect(() => {
    setIntroStatus(null);
    setSessionKind("STANDARD");
    if (!patientId) return;
    operatorApi.freeIntroStatus(patientId, psyId ?? undefined).then(setIntroStatus).catch(() => {});
  }, [patientId, psyId]);
  useEffect(() => {
    setCatalog([]); setCatalogId(null);
    if (!sellPkg || !psyId) return;
    operatorApi.psychologistPackages(psyId)
      .then(list => setCatalog(list.filter(p => p.active !== false)))
      .catch(() => setCatalog([]));
  }, [sellPkg, psyId]);
  // Psixoloq (və ya seans növü) dəyişəndə boş slotları yenidən yüklə.
  useEffect(() => {
    setSlots([]);
    if (!psyId) return;
    setSlotsLoading(true);
    const from = ymd(new Date());
    const toDate = new Date(); toDate.setDate(toDate.getDate() + 14);
    getPsychologistAvailability(psyId, from, ymd(toDate), sessionKind === "INTRO" ? "INTRO" : "STANDARD")
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [psyId, sessionKind]);

  // Boş slotları günlərə görə qruplaşdır (render üçün).
  const slotsByDay = useMemo(() => {
    const m = new Map<string, AvailableSlot[]>();
    for (const s of slots) {
      const day = s.startAt.slice(0, 10); // "YYYY-MM-DD"
      const arr = m.get(day);
      if (arr) arr.push(s); else m.set(day, [s]);
    }
    return Array.from(m.entries());
  }, [slots]);

  const pickSlot = (s: AvailableSlot) => {
    setStartAt(isoToAzLocal(s.startAt));
    setEndAt(isoToAzLocal(s.endAt));
    setErr(null);
  };

  // Kataloq paketinin seans sayı (xüsusi paketdə operatorun daxil etdiyi say) — qalan seansların vaxt sırasını göstərmək üçün.
  const sessionCount = useMemo(() => {
    if (!sellPkg) return 1;
    if (pkgMode === "catalog") {
      const c = catalog.find(x => x.id === catalogId);
      return c?.sessionCount ?? 1;
    }
    const n = Number(pkgSessions);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  }, [sellPkg, pkgMode, catalog, catalogId, pkgSessions]);

  useEffect(() => {
    const need = Math.max(0, sessionCount - 1);
    setExtraTimes(prev => {
      if (prev.length === need) return prev;
      const next = prev.slice(0, need);
      while (next.length < need) next.push({ start: "", end: "" });
      return next;
    });
  }, [sessionCount]);

  const computeEnd = (v: string) => {
    if (!v) return "";
    const sessionMin = sessionKind === "INTRO" ? 15 : (psys.find(p => p.id === psyId)?.defaultSessionMinutes || 50);
    const d = new Date(v); d.setMinutes(d.getMinutes() + sessionMin);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const setExtraStart = (i: number, v: string) => {
    setExtraTimes(prev => prev.map((t, idx) => idx === i ? { start: v, end: v && !t.end ? computeEnd(v) : t.end } : t));
  };
  const setExtraEnd = (i: number, v: string) => {
    setExtraTimes(prev => prev.map((t, idx) => idx === i ? { ...t, end: v } : t));
  };
  // Psixoloq seçiləndə onun cari seans qiymətini gətir (operator dəyişə bilər).
  useEffect(() => {
    setPrice(""); setPriceBase(null);
    if (!psyId) return;
    let cancelled = false;
    operatorApi.psychologistPricing(psyId)
      .then(p => {
        if (cancelled) return;
        setPriceBase(p.individualPrice ?? null);
        setPrice(p.individualPrice != null ? String(p.individualPrice) : "");
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [psyId]);

  // Yeni pasiyent formasında email/telefon yazıldıqca dublikat yoxlaması.
  useEffect(() => {
    if (locked || mode !== "new") { setDup(null); return; }
    const e = email.trim(), p = phone.trim();
    if (e.length < 5 && p.length < 7) { setDup(null); return; }
    let cancelled = false;
    const h = setTimeout(() => {
      operatorApi.lookupPatient({ email: e || undefined, phone: p || undefined })
        .then(r => { if (!cancelled) setDup(r.found ? r : null); })
        .catch(() => { if (!cancelled) setDup(null); });
    }, 400);
    return () => { cancelled = true; clearTimeout(h); };
  }, [email, phone, mode, locked]);

  /** Tapılan mövcud pasiyentə keç — forma "mövcud pasiyent" rejiminə qayıdır. */
  const useExistingPatient = () => {
    if (!dup?.patientId) return;
    setPatientId(dup.patientId);
    setPatientLabel(dup.name ?? dup.email ?? `#${dup.patientId}`);
    setQ(dup.email ?? dup.name ?? "");
    setMode("search");
    setDup(null);
    setErr(null);
  };

  useEffect(() => {
    if (locked || mode !== "search") return;
    const term = q.trim();
    if (term.length < 2) { setHits([]); return; }
    const h = setTimeout(() => {
      operatorApi.search(term, 8).then(r => setHits(r.patients)).catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(h);
  }, [q, mode, locked]);

  const onStart = (v: string) => {
    setStartAt(v);
    if (v && !endAt) {
      // Seçilmiş psixoloqun standart seans müddəti (və ya INTRO üçün sabit 15 dəq) —
      // server də eyni dəyərdən hesablayır (createOnBehalf), önizləmə ona uyğun olmalıdır.
      const sessionMin = sessionKind === "INTRO" ? 15 : (psys.find(p => p.id === psyId)?.defaultSessionMinutes || 50);
      const d = new Date(v); d.setMinutes(d.getMinutes() + sessionMin);
      const p = (n: number) => String(n).padStart(2, "0");
      setEndAt(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`);
    }
  };

  const submit = async () => {
    setErr(null);
    if (!psyId) { setErr("Psixoloq seçin"); return; }
    if (!startAt || !endAt) { setErr("Başlanğıc və bitiş vaxtını seçin"); return; }
    if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      setErr("Bitiş vaxtı başlanğıc vaxtından sonra olmalıdır");
      return;
    }
    if (sessionKind === "INTRO" && sellPkg) { setErr("Tanışlıq görüşü paketlə birgə satıla bilməz"); return; }
    if (sellPkg) {
      for (const t of extraTimes) {
        if (!t.start) continue;
        if (!t.end) { setErr("Bütün seçilmiş seanslar üçün bitiş vaxtı olmalıdır"); return; }
        if (new Date(t.end).getTime() <= new Date(t.start).getTime()) {
          setErr("Seansların bitiş vaxtı başlanğıcdan sonra olmalıdır");
          return;
        }
      }
    }
    setSaving(true);
    try {
      let pid = patientId;
      if (!locked && mode === "new") {
        if (!email.trim()) { setErr("Email tələb olunur"); setSaving(false); return; }
        // Email başqa rola aiddirsə hesab pasiyent kimi istifadə edilə bilməz.
        if (dup?.blocking) {
          setErr(dup.blockReason ?? `Bu email ${roleLabel(dup.role)} hesabına aiddir — istifadə edilə bilməz.`);
          setSaving(false); return;
        }
        // Mövcud pasiyentdirsə operator bunu təsdiqləməlidir (yuxarıdakı düymə ilə).
        if (dup?.found && dup.patientId) {
          setErr("Bu pasiyent artıq sistemdədir — «Mövcud pasiyenti seç» düyməsi ilə davam edin.");
          setSaving(false); return;
        }
        const r = await operatorApi.createPatient({ firstName, lastName, phone, email: email.trim() });
        pid = r.patientId;
        if (!r.created) uiToast("Bu email artıq mövcud idi — həmin pasiyentə bağlandı", "info");
      }
      if (!pid) { setErr("Pasiyent seçin"); setSaving(false); return; }

      if (sellPkg) {
        // Paket + ilk seans bronu TƏK atomik sorğu ilə. Əvvəllər bu iki ayrı çağırış
        // idi (sellPackage → createOnBehalf); ikinci uğursuz olduqda birinci artıq
        // commit olub sahibsiz PENDING ödəniş qalırdı, təkrar cəhdlər isə onu
        // çoxaldırdı (məs. 4 × 90 AZN = 360 AZN səhv "Ödənişlər"). İndi seans bronu
        // atılarsa paket + ödəniş də serverdə geri qaytarılır — orphan ödəniş qalmır.
        let sell;
        if (pkgMode === "catalog") {
          if (!catalogId) { setErr("Kataloqdan paket seçin"); setSaving(false); return; }
          sell = { sessionPackageId: catalogId, patientChoseDirectly };
        } else {
          const s = Number(pkgSessions), p = Number(pkgPrice);
          if (!Number.isFinite(s) || s < 1) { setErr("Paket: seans sayı düzgün deyil"); setSaving(false); return; }
          if (!Number.isFinite(p) || p < 0) { setErr("Paket: qiymət düzgün deyil"); setSaving(false); return; }
          sell = { psychologistId: psyId, packageName: pkgName.trim() || undefined, sessionCount: s, price: p, patientChoseDirectly };
        }
        const res = await operatorApi.sellPackageAndBook(pid, {
          sell, psychologistId: psyId, startAt, endAt, note: note.trim() || undefined,
        });
        // Paketin qalan seansları üçün operator burada vaxt seçibsə, onları da ardıcıl planlaşdır.
        // Paket + ilk seans artıq commit olub — bunlardan biri uğursuz olsa belə, qalanları
        // operator sonra randevu/paket detalından təyin edə bilər.
        const packageId = res.patientPackageId;
        if (packageId) {
          for (const t of extraTimes) {
            if (!t.start) continue;
            try {
              await operatorApi.schedulePackageSession(pid, packageId, { startAt: t.start, endAt: t.end || undefined, note: note.trim() || undefined });
            } catch (e) {
              uiToast(`Seans planlaşdırılmadı: ${(e as Error).message}`, "error");
            }
          }
        }
      } else {
        const priceNum = price.trim() === "" ? null : Number(price);
        if (priceNum != null && (!Number.isFinite(priceNum) || priceNum < 0)) {
          setErr("Seans qiyməti düzgün deyil"); setSaving(false); return;
        }
        await operatorApi.createOnBehalf({
          patientId: pid, psychologistId: psyId, startAt, endAt, note: note.trim() || undefined,
          patientPackageId: null, patientChoseDirectly,
          sessionKind: sessionKind === "INTRO" ? "INTRO" : undefined,
          // INTRO pulsuzdur — qiymət göndərilmir.
          sessionPrice: sessionKind === "INTRO" ? null : priceNum,
        });
      }
      onDone();
    } catch (e) { setErr((e as Error).message); setSaving(false); }
  };

  const inp: CSSProperties = { width: "100%", padding: 9, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" };

  const priceChanged = priceBase != null && price.trim() !== "" && Number(price) !== priceBase;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,22,51,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, maxWidth: 540, width: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #EEF2F7" }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1A2535", margin: 0 }}>Pasiyent adına randevu</h3>
          <p style={{ fontSize: 12.5, color: "#52718F", margin: "4px 0 0" }}>{locked ? "Psixoloq və vaxt təyin edin — randevu birbaşa təsdiqlənir." : "Pasiyenti seçin və ya yeni yaradın, sonra vaxt təyin edin — randevu birbaşa təsdiqlənir."}</p>
        </div>
        <div style={{ padding: 22, display: "grid", gap: 14 }}>
          {locked ? (
            <div style={{ fontSize: 13, color: "#065F46", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "9px 12px" }}>
              Pasiyent: <strong>{patientLabel || `#${presetPatientId}`}</strong>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <button type="button" onClick={() => setMode("search")} style={{ padding: 9, borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: mode === "search" ? "2px solid var(--brand)" : "1px solid #E5E7EB", background: mode === "search" ? "var(--brand-50)" : "#fff", color: mode === "search" ? "var(--brand-700)" : "#1A2535" }}>Mövcud pasiyent</button>
                <button type="button" onClick={() => { setMode("new"); setPatientId(null); }} style={{ padding: 9, borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: mode === "new" ? "2px solid var(--brand)" : "1px solid #E5E7EB", background: mode === "new" ? "var(--brand-50)" : "#fff", color: mode === "new" ? "var(--brand-700)" : "#1A2535" }}>Yeni pasiyent</button>
              </div>

              {mode === "search" ? (
                <div>
                  <input value={q} onChange={e => { setQ(e.target.value); setPatientId(null); }} placeholder="Ad / telefon / email ilə axtar…" style={inp} />
                  {patientId ? (
                    <div style={{ fontSize: 12.5, color: "#065F46", marginTop: 6 }}>Seçildi: <strong>{patientLabel}</strong></div>
                  ) : hits.length > 0 && (
                    <div style={{ display: "grid", gap: 4, marginTop: 6, maxHeight: 180, overflowY: "auto" }}>
                      {hits.map(h => (
                        <button key={h.id} type="button" onClick={() => { setPatientId(h.id); setPatientLabel(h.title); }} style={{ textAlign: "left", padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", cursor: "pointer" }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#1A2535" }}>{h.title}</div>
                          <div style={{ fontSize: 11, color: "#52718F" }}>{h.subtitle}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Ad" style={inp} />
                    <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Soyad" style={inp} />
                    <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Telefon" style={inp} />
                    <input value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="Email (claim üçün)"
                      style={{ ...inp, ...(dup ? { border: "1px solid #E0A33E" } : {}) }} />
                  </div>

                  {/* Dublikat xəbərdarlığı — mövcud hesab sükutla təkrar istifadə olunmasın */}
                  {dup && (
                    <div style={{
                      background: dup.blocking ? "#FBF1F1" : "#FFFBEB",
                      border: `1px solid ${dup.blocking ? "#EBC9C9" : "#F0DDB4"}`,
                      borderRadius: 10, padding: "10px 12px", display: "grid", gap: 8,
                    }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: dup.blocking ? "#B4534F" : "#8A5A15", lineHeight: 1.45 }}>
                        {dup.blocking
                          ? (dup.blockReason ?? `Bu ${dup.matchedBy === "PHONE" ? "telefon" : "email"} ${roleLabel(dup.role)} hesabına aiddir.`)
                            + " Bu hesabla randevu yaradıla bilməz."
                          : `Bu ${dup.matchedBy === "PHONE" ? "telefon" : "email"} artıq sistemdədir: ${dup.name}`}
                      </div>
                      {!dup.blocking && (
                        <>
                          <div style={{ fontSize: 12, color: "#52718F", lineHeight: 1.45 }}>
                            {dup.email}{dup.phone ? `, ${dup.phone}` : ""} — yeni hesab yaradılmayacaq, randevu mövcud pasiyentə yazılacaq.
                          </div>
                          {dup.patientId != null && (
                            <button type="button" onClick={useExistingPatient}
                              style={{ justifySelf: "start", padding: "8px 13px", borderRadius: 9, border: "none", background: "var(--brand)", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                              Mövcud pasiyenti seç
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <select value={psyId ?? ""} onChange={e => setPsyId(e.target.value ? Number(e.target.value) : null)} style={{ ...inp, background: "#fff" }}>
            <option value="">Psixoloq seçin…</option>
            {psys.map(p => <option key={p.id} value={p.id}>{p.name ?? `Psixoloq #${p.id}`}</option>)}
          </select>

          {introStatus?.eligible && (
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", border: "1px solid #E5E7EB", borderRadius: 10, padding: 12 }}>
              <input type="checkbox" checked={sessionKind === "INTRO"}
                onChange={e => {
                  const intro = e.target.checked;
                  setSessionKind(intro ? "INTRO" : "STANDARD");
                  if (intro) setSellPkg(false);
                  if (startAt) {
                    const sessionMin = intro ? 15 : (psys.find(p => p.id === psyId)?.defaultSessionMinutes || 50);
                    const d = new Date(startAt); d.setMinutes(d.getMinutes() + sessionMin);
                    const p = (n: number) => String(n).padStart(2, "0");
                    setEndAt(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`);
                  }
                }}
                style={{ width: 16, height: 16, marginTop: 1 }} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#1A2535", lineHeight: 1.4 }}>
                Pulsuz tanışlıq görüşü <span style={{ color: "#52718F", fontWeight: 500 }}>(15 dəq, ödənişsiz{introStatus.usedCount === 1 ? " — 2-ci pulsuz seans, əməliyyatdan sonra icazə söndürülür" : ""})</span>
              </span>
            </label>
          )}

          {/* Tək seansın qiyməti — psixoloqun qiyməti ilkin dəyərdir, operator dəyişə bilər.
              Paket satışında qiymət paketdən gəlir, INTRO isə pulsuzdur. */}
          {psyId && !sellPkg && sessionKind !== "INTRO" && (
            <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 12, display: "grid", gap: 7 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#1A2535" }}>Seans qiyməti (AZN)</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <input value={price} onChange={e => setPrice(e.target.value)} type="number" min={0} step="0.01"
                  placeholder={priceBase != null ? String(priceBase) : "0.00"}
                  style={{ ...inp, width: 140 }} />
                {priceChanged && (
                  <button type="button" onClick={() => setPrice(priceBase != null ? String(priceBase) : "")}
                    style={{ padding: "7px 11px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", fontSize: 12, fontWeight: 600, color: "#52718F", cursor: "pointer" }}>
                    Psixoloqun qiymətinə qaytar
                  </button>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: "#52718F", lineHeight: 1.45 }}>
                {priceBase != null
                  ? <>Psixoloqun cari qiyməti: <strong>{priceBase} AZN</strong>. {priceChanged ? "Bu randevu üçün fərqli qiymət tətbiq olunacaq — psixoloqun qiyməti dəyişmir." : "Dəyişdirsəniz yalnız bu randevuya tətbiq olunur."}</>
                  : "Psixoloqun fərdi qiyməti təyin edilməyib — bu seans üçün qiymət yazın."}
              </div>
            </div>
          )}

          {/* Opsional paket satışı */}
          <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#1A2535", cursor: "pointer" }}>
              <input type="checkbox" checked={sellPkg} onChange={e => setSellPkg(e.target.checked)} style={{ width: 16, height: 16 }} />
              Bu pasiyentə paket də sat (ödəniş PENDING)
            </label>
            {sellPkg && (
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {!psyId ? (
                  <div style={{ fontSize: 12, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "7px 10px" }}>Əvvəlcə psixoloq seçin.</div>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <button type="button" onClick={() => setPkgMode("catalog")} style={{ padding: 8, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: pkgMode === "catalog" ? "2px solid var(--brand)" : "1px solid #E5E7EB", background: pkgMode === "catalog" ? "var(--brand-50)" : "#fff", color: pkgMode === "catalog" ? "var(--brand-700)" : "#1A2535" }}>Kataloq</button>
                      <button type="button" onClick={() => setPkgMode("custom")} style={{ padding: 8, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: pkgMode === "custom" ? "2px solid var(--brand)" : "1px solid #E5E7EB", background: pkgMode === "custom" ? "var(--brand-50)" : "#fff", color: pkgMode === "custom" ? "var(--brand-700)" : "#1A2535" }}>Xüsusi</button>
                    </div>
                    {pkgMode === "catalog" ? (
                      catalog.length === 0 ? (
                        <div style={{ fontSize: 12, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "7px 10px" }}>Kataloq paketi yoxdur — «Xüsusi» seçin.</div>
                      ) : (
                        <select value={catalogId ?? ""} onChange={e => setCatalogId(e.target.value ? Number(e.target.value) : null)} style={{ ...inp, background: "#fff" }}>
                          <option value="">Paket seçin…</option>
                          {catalog.map(c => <option key={c.id} value={c.id}>{c.name}, {c.sessionCount} seans, {c.packagePrice} {c.currency}</option>)}
                        </select>
                      )
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <input value={pkgName} onChange={e => setPkgName(e.target.value)} placeholder="Paket adı (ops.)" style={{ ...inp, gridColumn: "1 / -1" }} />
                        <input value={pkgSessions} onChange={e => setPkgSessions(e.target.value)} placeholder="Seans sayı" type="number" min={1} style={inp} />
                        <input value={pkgPrice} onChange={e => setPkgPrice(e.target.value)} placeholder="Qiymət (AZN)" type="number" min={0} step="0.01" style={inp} />
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#52718F" }}>
                      İlk seans paketdən sərf olunacaq.
                      {sessionCount > 1 && " Digər seanslar üçün də indi vaxt seçə bilərsiniz — boş buraxılanlar sonra randevu detalından təyin edilə bilər."}
                    </div>
                    {sessionCount > 1 && (
                      <div style={{ display: "grid", gap: 8 }}>
                        {extraTimes.map((t, i) => (
                          <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: 8, alignItems: "center" }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#52718F", whiteSpace: "nowrap" }}>{i + 2}-ci seans</span>
                            <DatePicker value={t.start} onChange={v => setExtraStart(i, v)} theme="light" withTime size="sm" style={{ width: "100%" }} />
                            <DatePicker value={t.end} onChange={v => setExtraEnd(i, v)} theme="light" withTime size="sm" style={{ width: "100%" }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Seçilmiş psixoloqun boş gün/saatları — uyğun slot seçilir */}
          {psyId && (
            <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1A2535", marginBottom: 8 }}>
                Psixoloqun boş vaxtları <span style={{ color: "#52718F", fontWeight: 500 }}>(yaxın 14 gün)</span>
              </div>
              {slotsLoading ? (
                <div style={{ fontSize: 12, color: "#52718F" }}>Yüklənir…</div>
              ) : slotsByDay.length === 0 ? (
                <div style={{ fontSize: 12, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "7px 10px" }}>
                  Yaxın 14 gündə boş vaxt yoxdur — vaxtı əl ilə seçin.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10, maxHeight: 200, overflowY: "auto" }}>
                  {slotsByDay.map(([day, daySlots]) => (
                    <div key={day}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#52718F", marginBottom: 6 }}>
                        {azFormatWeekday(day)}, {azFormatDate(day)}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {daySlots.map(s => {
                          const active = startAt === isoToAzLocal(s.startAt);
                          return (
                            <button key={s.startAt} type="button" onClick={() => pickSlot(s)}
                              style={{
                                padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                                border: active ? "2px solid var(--brand)" : "1px solid #E5E7EB",
                                background: active ? "var(--brand-50)" : "#fff",
                                color: active ? "var(--brand-700)" : "#1A2535",
                              }}>
                              {azFormatTime(s.startAt)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#52718F", display: "grid", gap: 4 }}>Başlanğıc
              <DatePicker value={startAt} onChange={v => onStart(v)} theme="light" withTime size="sm" style={{ width: "100%" }} /></label>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#52718F", display: "grid", gap: 4 }}>Bitiş
              <DatePicker value={endAt} onChange={v => setEndAt(v)} theme="light" withTime size="sm" style={{ width: "100%" }} /></label>
          </div>
          {startAt && endAt && new Date(endAt).getTime() <= new Date(startAt).getTime() && (
            <div style={{ fontSize: 12, color: "#991B1B", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "7px 10px" }}>
              Bitiş vaxtı başlanğıc vaxtından sonra olmalıdır.
            </div>
          )}

          <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Qeyd (məcburi deyil)" style={{ ...inp, fontFamily: "inherit", resize: "vertical" }} />

          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={patientChoseDirectly} onChange={e => setPatientChoseDirectly(e.target.checked)} style={{ width: 16, height: 16, marginTop: 1 }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#1A2535", lineHeight: 1.4 }}>
              Pasient bu psixoloqu özü seçib müraciət edib <span style={{ color: "#52718F", fontWeight: 500 }}>(komissiyasız/azaldılmış faiz tətbiq olunur)</span>
            </span>
          </label>

          {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12 }}>{err}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer", fontWeight: 600 }}>Bağla</button>
            <button onClick={submit} disabled={saving} style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, background: "var(--brand)", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>{saving ? "Yaradılır…" : "Randevu yarat"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
