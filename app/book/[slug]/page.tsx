"use client";

import Image from "next/image";
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
import { withSlugs } from "@/lib/slug";

const WEEKDAYS_AZ = ["B.e", "Ç.a", "Ç", "C.a", "C", "Ş", "B"];

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
  const isoDow = (d.getDay() + 6) % 7;
  return `${WEEKDAYS_AZ[isoDow]} · ${fmtDate(iso)}`;
}
function isoDateOnly(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function initials(name: string) {
  return name.split(" ").filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase();
}

type FormatT = "ONLINE" | "IN_PERSON";

export default function BookPsychologistPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const rawSlug = decodeURIComponent(params.slug ?? "");

  const [psychologist, setPsychologist] = useState<(Psychologist & { slug: string }) | null>(null);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);
  const [pickedSlot, setPickedSlot] = useState<AvailableSlot | null>(null);
  const [sessionFormat, setSessionFormat] = useState<FormatT>("ONLINE");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [appointmentsUrl, setAppointmentsUrl] = useState("/patient/appointments");

  useEffect(() => {
    setAppointmentsUrl(`${buildPanelUrl("PATIENT")}/appointments`);
  }, []);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(`/book/${rawSlug}`)}`);
      return;
    }
    if (user.role !== "PATIENT") {
      setError("Yalnız pasiyent hesabı ilə müraciət edə bilərsiniz");
    }
  }, [rawSlug, router]);

  useEffect(() => {
    setLoading(true);
    getPsychologists()
      .then((list) => {
        const withSlug = withSlugs(list);
        const numeric = Number(rawSlug);
        let match: (Psychologist & { slug: string }) | undefined;
        if (Number.isFinite(numeric)) {
          match = withSlug.find(p => p.id === numeric);
          if (match && match.slug !== rawSlug) {
            router.replace(`/book/${match.slug}`);
            return;
          }
        }
        if (!match) match = withSlug.find(p => p.slug === rawSlug);
        if (!match) {
          setError("Psixoloq tapılmadı");
          setLoading(false);
          return;
        }
        setPsychologist(match);
        const today = new Date();
        const to = new Date();
        to.setDate(to.getDate() + 21);
        getPsychologistAvailability(match.id, isoDateOnly(today), isoDateOnly(to))
          .then(setSlots)
          .catch(() => setSlots([]))
          .finally(() => setLoading(false));
      })
      .catch(() => {
        setError("Məlumatları yükləmək alınmadı");
        setLoading(false);
      });
  }, [rawSlug, router]);

  const grouped = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const s of slots) {
      const k = dayKey(s.startAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  useEffect(() => {
    if (!activeDayKey && grouped.length > 0) setActiveDayKey(grouped[0][0]);
  }, [grouped, activeDayKey]);

  const activeSlots = useMemo(
    () => grouped.find(([k]) => k === activeDayKey)?.[1] ?? [],
    [grouped, activeDayKey],
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!psychologist) return;
    if (note.trim().length < 5) {
      setError("Qısa olsa belə problem təsvirini yazın");
      return;
    }
    setSubmitting(true);
    try {
      await patientApi.book({
        note: note.trim(),
        requestedPsychologistId: psychologist.id,
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
      <main className="bk-page">
        <div className="bk-success">
          <div className="bk-success-icon" aria-hidden>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1>Müraciətiniz qəbul edildi</h1>
          <p>
            Operator komandamız tezliklə müraciətinizə baxıb sizə geri dönəcək.
            Statusu <strong>Randevularım</strong> bölməsindən izləyə bilərsiniz.
          </p>
          <div className="bk-success-actions">
            <a className="bk-btn bk-btn-primary" href={appointmentsUrl}>Randevularıma keç</a>
            <a className="bk-btn bk-btn-ghost" href="/psychologists">Psixoloqlara qayıt</a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bk-page">
      <div className="bk-shell">
        <a href={`/psychologists/${rawSlug}`} className="bk-back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Profilə qayıt
        </a>

        {loading ? (
          <div className="bk-card bk-card-loading">Yüklənir…</div>
        ) : !psychologist ? (
          <div className="bk-card bk-card-error">{error ?? "Psixoloq tapılmadı."}</div>
        ) : (
          <div className="bk-grid">
            <aside className="bk-aside">
              <div className="bk-aside-card">
                <div className="bk-avatar">
                  {psychologist.photoUrl ? (
                    <Image src={psychologist.photoUrl} alt={psychologist.name} width={88} height={88} />
                  ) : (
                    <span>{initials(psychologist.name)}</span>
                  )}
                </div>
                <h2 className="bk-name">{psychologist.name}</h2>
                <p className="bk-title">{psychologist.title}</p>
                {psychologist.specializations && psychologist.specializations.length > 0 && (
                  <div className="bk-tags">
                    {psychologist.specializations.slice(0, 4).map(t => (
                      <span key={t} className="bk-tag">{t}</span>
                    ))}
                  </div>
                )}
                <div className="bk-aside-meta">
                  <div>
                    <span>Seans müddəti</span>
                    <strong>{psychologist.defaultSessionMinutes ?? 50} dəq</strong>
                  </div>
                  <div>
                    <span>Format</span>
                    <strong>Onlayn & Əyani</strong>
                  </div>
                </div>
              </div>

              <ol className="bk-steps">
                <li><span>1</span>Vaxt seçin</li>
                <li><span>2</span>Format və qeyd</li>
                <li><span>3</span>Operator təsdiqi</li>
              </ol>
            </aside>

            <form onSubmit={onSubmit} className="bk-form">
              <header className="bk-form-head">
                <p className="bk-eyebrow">Randevu al</p>
                <h1>Sizə uyğun vaxtı seçin</h1>
                <p className="bk-form-sub">
                  Operator müraciətinizi 24 saat ərzində təsdiqləyəcək. İstədiyiniz vaxt mümkün deyilsə, ən yaxın alternativi təklif edəcək.
                </p>
              </header>

              <section className="bk-section">
                <div className="bk-section-head">
                  <h3>Vaxt</h3>
                  {pickedSlot && (
                    <span className="bk-pill bk-pill-brand">
                      {dayLabel(pickedSlot.startAt)}, {fmtTime(pickedSlot.startAt)}
                    </span>
                  )}
                </div>

                {grouped.length === 0 ? (
                  <div className="bk-empty">
                    Bu psixoloq hələ açıq vaxt göstərməyib. İstənilən halda müraciət göndərə bilərsiniz — operator sizə uyğun başqa vaxt təklif edəcək.
                  </div>
                ) : (
                  <>
                    <div className="bk-day-tabs" role="tablist">
                      {grouped.map(([k, daySlots]) => {
                        const active = k === activeDayKey;
                        return (
                          <button
                            type="button"
                            key={k}
                            role="tab"
                            aria-selected={active}
                            className={`bk-day-tab${active ? " is-active" : ""}`}
                            onClick={() => setActiveDayKey(k)}
                          >
                            {dayLabel(daySlots[0].startAt)}
                            <small>{daySlots.length} vaxt</small>
                          </button>
                        );
                      })}
                    </div>

                    <div className="bk-slots">
                      {activeSlots.map(s => {
                        const active = pickedSlot?.startAt === s.startAt;
                        return (
                          <button
                            type="button"
                            key={s.startAt}
                            className={`bk-slot${active ? " is-active" : ""}`}
                            onClick={() => setPickedSlot(active ? null : s)}
                          >
                            {fmtTime(s.startAt)}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>

              <section className="bk-section">
                <div className="bk-section-head">
                  <h3>Seans formatı</h3>
                </div>
                <div className="bk-format">
                  {(["ONLINE", "IN_PERSON"] as const).map(f => {
                    const active = sessionFormat === f;
                    return (
                      <button
                        type="button"
                        key={f}
                        className={`bk-format-card${active ? " is-active" : ""}`}
                        onClick={() => setSessionFormat(f)}
                      >
                        <span className="bk-format-icon" aria-hidden>
                          {f === "ONLINE" ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="4" width="20" height="14" rx="2" />
                              <path d="M8 22h8M12 18v4" />
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h2M9 13h2M9 17h2M13 9h2M13 13h2M13 17h2" />
                            </svg>
                          )}
                        </span>
                        <span className="bk-format-text">
                          <strong>{f === "ONLINE" ? "Onlayn" : "Əyani"}</strong>
                          <small>{f === "ONLINE" ? "Video zəng üzərindən" : "Mərkəzdə üzbəüz görüş"}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="bk-section">
                <div className="bk-section-head">
                  <h3>Mövzu / Qısa təsvir</h3>
                </div>
                <textarea
                  rows={4}
                  className="bk-textarea"
                  placeholder="Məsələn: son aylarda anksiyete və yuxu problemləri…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <p className="bk-hint">Məlumatlarınız tam məxfi saxlanılır və yalnız təyin olunan psixoloq və operator görəcək.</p>
              </section>

              {error && <div className="bk-error">{error}</div>}

              <div className="bk-actions">
                <button type="button" className="bk-btn bk-btn-ghost" onClick={() => router.back()}>
                  Ləğv et
                </button>
                <button type="submit" className="bk-btn bk-btn-primary" disabled={submitting}>
                  {submitting ? "Göndərilir…" : "Müraciət göndər"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
