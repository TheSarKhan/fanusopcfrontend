"use client";

/**
 * Operatorun pasiyent adına randevu yaratması (telefon intake).
 * İki istifadə:
 *   - Randevular səhifəsi: pasiyenti axtar/yarat → psixoloq → (ops.) paket → seans.
 *   - Müştəri 360° profili: {@code presetPatientId} verilir → pasiyent kilidli,
 *     birbaşa psixoloq + (ops.) paket + seans.
 * Paket seçilərsə ilk seans paketdən sərf olunur ({@code patientPackageId}).
 */

import { useEffect, useState, type CSSProperties } from "react";
import { operatorApi, type OperatorSearchHit, type PackageDto } from "@/lib/api";
import DatePicker from "@/components/DatePicker";

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
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Opsional paket satışı
  const [sellPkg, setSellPkg] = useState(false);
  const [pkgMode, setPkgMode] = useState<"catalog" | "custom">("catalog");
  const [catalog, setCatalog] = useState<PackageDto[]>([]);
  const [catalogId, setCatalogId] = useState<number | null>(null);
  const [pkgName, setPkgName] = useState("");
  const [pkgSessions, setPkgSessions] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");

  useEffect(() => { operatorApi.listPsychologists().then(setPsys).catch(() => {}); }, []);
  useEffect(() => {
    setCatalog([]); setCatalogId(null);
    if (!sellPkg || !psyId) return;
    operatorApi.psychologistPackages(psyId)
      .then(list => setCatalog(list.filter(p => p.active !== false)))
      .catch(() => setCatalog([]));
  }, [sellPkg, psyId]);
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
      // Seçilmiş psixoloqun standart seans müddəti — server də eyni dəyərdən
      // hesablayır (createOnBehalf), ona görə göstərilən önizləmə də ona uyğun olmalıdır.
      const sessionMin = psys.find(p => p.id === psyId)?.defaultSessionMinutes || 50;
      const d = new Date(v); d.setMinutes(d.getMinutes() + sessionMin);
      const p = (n: number) => String(n).padStart(2, "0");
      setEndAt(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`);
    }
  };

  const submit = async () => {
    setErr(null);
    if (!psyId) { setErr("Psixoloq seçin"); return; }
    if (!startAt || !endAt) { setErr("Başlanğıc və bitiş vaxtını seçin"); return; }
    setSaving(true);
    try {
      let pid = patientId;
      if (!locked && mode === "new") {
        if (!email.trim()) { setErr("Email tələb olunur"); setSaving(false); return; }
        const r = await operatorApi.createPatient({ firstName, lastName, phone, email: email.trim() });
        pid = r.patientId;
      }
      if (!pid) { setErr("Pasiyent seçin"); setSaving(false); return; }

      // Opsional: paket sat → ilk seans paketdən sərf olunsun.
      let packageId: number | null = null;
      if (sellPkg) {
        if (pkgMode === "catalog") {
          if (!catalogId) { setErr("Kataloqdan paket seçin"); setSaving(false); return; }
          const sold = await operatorApi.sellPackage(pid, { sessionPackageId: catalogId });
          packageId = sold.id;
        } else {
          const s = Number(pkgSessions), p = Number(pkgPrice);
          if (!Number.isFinite(s) || s < 1) { setErr("Paket: seans sayı düzgün deyil"); setSaving(false); return; }
          if (!Number.isFinite(p) || p < 0) { setErr("Paket: qiymət düzgün deyil"); setSaving(false); return; }
          const sold = await operatorApi.sellPackage(pid, { psychologistId: psyId, packageName: pkgName.trim() || undefined, sessionCount: s, price: p });
          packageId = sold.id;
        }
      }

      await operatorApi.createOnBehalf({ patientId: pid, psychologistId: psyId, startAt, endAt, note: note.trim() || undefined, patientPackageId: packageId });
      onDone();
    } catch (e) { setErr((e as Error).message); setSaving(false); }
  };

  const inp: CSSProperties = { width: "100%", padding: 9, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, boxSizing: "border-box" };

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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Ad" style={inp} />
                  <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Soyad" style={inp} />
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Telefon" style={inp} />
                  <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (claim üçün)" style={inp} />
                </div>
              )}
            </>
          )}

          <select value={psyId ?? ""} onChange={e => setPsyId(e.target.value ? Number(e.target.value) : null)} style={{ ...inp, background: "#fff" }}>
            <option value="">Psixoloq seçin…</option>
            {psys.map(p => <option key={p.id} value={p.id}>{p.name ?? `Psixoloq #${p.id}`}</option>)}
          </select>

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
                          {catalog.map(c => <option key={c.id} value={c.id}>{c.name} · {c.sessionCount} seans · {c.packagePrice} {c.currency}</option>)}
                        </select>
                      )
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <input value={pkgName} onChange={e => setPkgName(e.target.value)} placeholder="Paket adı (ops.)" style={{ ...inp, gridColumn: "1 / -1" }} />
                        <input value={pkgSessions} onChange={e => setPkgSessions(e.target.value)} placeholder="Seans sayı" type="number" min={1} style={inp} />
                        <input value={pkgPrice} onChange={e => setPkgPrice(e.target.value)} placeholder="Qiymət (AZN)" type="number" min={0} step="0.01" style={inp} />
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#52718F" }}>İlk seans paketdən sərf olunacaq; qalan seansları randevu detalından təyin edin.</div>
                  </>
                )}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#52718F", display: "grid", gap: 4 }}>Başlanğıc
              <DatePicker value={startAt} onChange={v => onStart(v)} theme="light" withTime size="sm" style={{ width: "100%" }} /></label>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#52718F", display: "grid", gap: 4 }}>Bitiş
              <DatePicker value={endAt} onChange={v => setEndAt(v)} theme="light" withTime size="sm" style={{ width: "100%" }} /></label>
          </div>

          <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Qeyd (məcburi deyil)" style={{ ...inp, fontFamily: "inherit", resize: "vertical" }} />

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
