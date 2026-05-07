"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getPsychologistAvailability,
  getPsychologists,
  patientApi,
  type AvailableSlot,
  type Psychologist,
} from "@/lib/api";
import { buildPanelUrl, getStoredUser } from "@/lib/auth";

const WEEKDAYS_AZ = ["B.e", "Ç.a", "Ç", "C.a", "C", "Ş", "B"]; // Mon..Sun (ISO order)

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  // ISO weekday: 1..7 (Mon..Sun); JS getDay returns 0..6 (Sun..Sat)
  const isoDow = ((d.getDay() + 6) % 7);
  return `${WEEKDAYS_AZ[isoDow]} · ${fmtDate(iso)}`;
}

function isoDateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function BookPsychologistPage() {
  const params = useParams<{ psychologistId: string }>();
  const router = useRouter();
  const psychologistId = Number(params.psychologistId);

  const [psychologist, setPsychologist] = useState<Psychologist | null>(null);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickedSlot, setPickedSlot] = useState<AvailableSlot | null>(null);
  const [sessionFormat, setSessionFormat] = useState<"ONLINE" | "IN_PERSON">("ONLINE");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [appointmentsUrl, setAppointmentsUrl] = useState("/patient/appointments");

  useEffect(() => {
    setAppointmentsUrl(`${buildPanelUrl("PATIENT")}/appointments`);
  }, []);

  // Auth check
  useEffect(() => {
    const user = getStoredUser();
    if (!user) {
      const back = `/book/${psychologistId}`;
      router.replace(`/login?next=${encodeURIComponent(back)}`);
      return;
    }
    if (user.role !== "PATIENT") {
      setError("Yalnız pasiyent hesabı ilə müraciət edə bilərsiniz");
    }
  }, [psychologistId, router]);

  // Load psychologist + availability
  useEffect(() => {
    if (!Number.isFinite(psychologistId)) return;
    const today = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 21);
    setLoading(true);
    Promise.all([
      getPsychologists().then(list => list.find(p => p.id === psychologistId) ?? null),
      getPsychologistAvailability(psychologistId, isoDateOnly(today), isoDateOnly(to)).catch(() => []),
    ])
      .then(([psy, sl]) => {
        setPsychologist(psy);
        setSlots(sl);
      })
      .catch(() => setError("Məlumatları yükləmək alınmadı"))
      .finally(() => setLoading(false));
  }, [psychologistId]);

  const grouped = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const s of slots) {
      const k = dayKey(s.startAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (note.trim().length < 5) {
      setError("Qısa olsa belə problem təsvirini yazın");
      return;
    }
    setSubmitting(true);
    try {
      await patientApi.book({
        note: note.trim(),
        requestedPsychologistId: psychologistId,
        requestedStartAt: pickedSlot ? pickedSlot.startAt : null,
        sessionFormat,
      });
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message || "Müraciət göndərilərkən xəta baş verdi");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <main style={{ minHeight: "100vh", background: "#F3F6FB", padding: "3rem 1rem" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", background: "#fff", borderRadius: 16, padding: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A2535", marginBottom: 8 }}>Müraciətiniz qəbul edildi</h1>
          <p style={{ color: "#52718F", marginBottom: 24, lineHeight: 1.6 }}>
            Operator komandamız tezliklə müraciətinizə baxıb sizə geri dönəcək.
            Statusu &laquo;Randevularım&raquo; bölməsindən izləyə bilərsiniz.
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <a href={appointmentsUrl}
               style={{ background: "linear-gradient(135deg,#002147,#5A4FC8)", color: "#fff", padding: "10px 18px", borderRadius: 10, textDecoration: "none", fontWeight: 600, fontSize: 14 }}>
              Randevularıma keç
            </a>
            <a href="/psychologists" style={{ padding: "10px 18px", border: "1px solid #E5E7EB", borderRadius: 10, color: "#1A2535", textDecoration: "none", fontWeight: 500, fontSize: 14 }}>
              Psixoloqlara qayıt
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#F3F6FB", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <a href={`/psychologists/${psychologistId}`}
           style={{ color: "#52718F", textDecoration: "none", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          ← Profilə qayıt
        </a>

        {loading ? (
          <div style={{ background: "#fff", padding: 40, borderRadius: 16, textAlign: "center", color: "#52718F" }}>
            Yüklənir…
          </div>
        ) : !psychologist ? (
          <div style={{ background: "#fff", padding: 40, borderRadius: 16, textAlign: "center", color: "#991B1B" }}>
            Psixoloq tapılmadı.
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid #EFF2F7" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: psychologist.bgColor, color: psychologist.accentColor, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18 }}>
                {psychologist.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={psychologist.photoUrl} alt={psychologist.name} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  psychologist.name.split(" ").filter(Boolean).map(s => s[0]).slice(0, 2).join("")
                )}
              </div>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1A2535", margin: 0 }}>Randevu al</h1>
                <p style={{ color: "#52718F", fontSize: 14, margin: "2px 0 0" }}>{psychologist.name} · {psychologist.title}</p>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, color: "#1A2535", fontWeight: 600, marginBottom: 8 }}>Vaxt seçin</label>
              {grouped.length === 0 ? (
                <div style={{ background: "#FFFBEB", border: "1px solid #FEF3C7", borderRadius: 8, padding: 16, fontSize: 13, color: "#92400E" }}>
                  Bu psixoloq hələ açıq vaxt göstərməyib. İstənilən halda müraciət göndərə bilərsiniz — operator sizə uyğun başqa vaxt təklif edəcək.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {grouped.map(([date, daySlots]) => (
                    <div key={date}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#52718F", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                        {dayLabel(daySlots[0].startAt)}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {daySlots.map(s => {
                          const active = pickedSlot?.startAt === s.startAt;
                          return (
                            <button
                              type="button"
                              key={s.startAt}
                              onClick={() => setPickedSlot(active ? null : s)}
                              style={{
                                padding: "8px 14px",
                                borderRadius: 10,
                                border: active ? `2px solid ${psychologist.accentColor}` : "1px solid #E5E7EB",
                                background: active ? psychologist.bgColor : "#fff",
                                color: active ? psychologist.accentColor : "#1A2535",
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              {fmtTime(s.startAt)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {pickedSlot && (
                <p style={{ marginTop: 8, fontSize: 12, color: "#52718F" }}>
                  Seçilmiş vaxt: <strong>{dayLabel(pickedSlot.startAt)}, {fmtTime(pickedSlot.startAt)}</strong>
                </p>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, color: "#1A2535", fontWeight: 600, marginBottom: 8 }}>Seans formatı</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["ONLINE", "IN_PERSON"] as const).map(f => (
                  <button
                    type="button"
                    key={f}
                    onClick={() => setSessionFormat(f)}
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: sessionFormat === f ? "2px solid #5A4FC8" : "1px solid #E5E7EB",
                      background: sessionFormat === f ? "#EEECFB" : "#fff",
                      color: "#1A2535",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {f === "ONLINE" ? "💻 Online" : "🏢 Üzbəüz"}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, color: "#1A2535", fontWeight: 600, marginBottom: 8 }}>Mövzu / Qısa təsvir</label>
              <textarea
                rows={4}
                placeholder="Məsələn: son aylarda anksiyete və yuxu problemləri…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 14, resize: "vertical", fontFamily: "inherit", color: "#1A2535" }}
              />
            </div>

            {error && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => router.back()}
                style={{ padding: "10px 18px", border: "1px solid #E5E7EB", background: "#fff", borderRadius: 10, color: "#1A2535", fontWeight: 500, fontSize: 14, cursor: "pointer" }}>
                Ləğv et
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{ padding: "10px 22px", border: "none", background: "linear-gradient(135deg,#002147,#5A4FC8)", borderRadius: 10, color: "#fff", fontWeight: 600, fontSize: 14, cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.7 : 1 }}>
                {submitting ? "Göndərilir…" : "Müraciət göndər"}
              </button>
            </div>

            <p style={{ marginTop: 16, fontSize: 12, color: "#52718F" }}>
              Müraciət göndərildikdən sonra operator sizə uyğun vaxtı təsdiqləyəcək və ya başqa təklif verəcək.
              Status dəyişikliyi haqqında email bildirişi alacaqsınız.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
