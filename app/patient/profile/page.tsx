"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ProfileShell from "@/components/ProfileShell";
import {
  getPsychologists,
  patientApi,
  type AppointmentDetail,
  type Homework,
  type PatientGoalView,
  type PatientRiskLevel,
  type Psychologist,
} from "@/lib/api";
import { withSlugs } from "@/lib/slug";

const RISK_LABEL: Record<PatientRiskLevel, { label: string; bg: string; fg: string }> = {
  LOW:      { label: "Aşağı risk",  bg: "#FEF3C7", fg: "#92400E" },
  MEDIUM:   { label: "Orta risk",   bg: "#FED7AA", fg: "#9A3412" },
  HIGH:     { label: "Yüksək risk", bg: "#FEE2E2", fg: "#991B1B" },
  CRITICAL: { label: "Kritik risk", bg: "#FEE2E2", fg: "#7F1D1D" },
};

function initials(name?: string | null): string {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}

export default function PatientProfilePage() {
  const [appts, setAppts] = useState<AppointmentDetail[]>([]);
  const [tasks, setTasks] = useState<Homework[]>([]);
  const [goals, setGoals] = useState<PatientGoalView[]>([]);
  const [favorites, setFavorites] = useState<Psychologist[]>([]);
  const [riskLevel, setRiskLevel] = useState<PatientRiskLevel | null>(null);

  useEffect(() => {
    Promise.allSettled([
      patientApi.myAppointments(),
      patientApi.homework(),
      patientApi.goals(),
      patientApi.favorites(),
      patientApi.crisisStatus(),
    ]).then(res => {
      if (res[0].status === "fulfilled") setAppts(res[0].value);
      if (res[1].status === "fulfilled") setTasks(res[1].value);
      if (res[2].status === "fulfilled") setGoals(res[2].value);
      if (res[3].status === "fulfilled") setFavorites(res[3].value);
      if (res[4].status === "fulfilled") setRiskLevel(res[4].value.riskLevel);
    });
  }, []);

  const stats = useMemo(() => ({
    totalSessions: appts.filter(a => a.status === "COMPLETED").length,
    activeGoals: goals.filter(g => g.status === "OPEN" || g.status === "IN_PROGRESS").length,
    pendingTasks: tasks.filter(t => t.status === "PENDING").length,
    favoriteCount: favorites.length,
  }), [appts, tasks, goals, favorites]);

  // Find the patient's most recent active psychologist for the contact card.
  const [psyDetails, setPsyDetails] = useState<(Psychologist & { slug?: string }) | null>(null);
  useEffect(() => {
    const recentPsyId = appts
      .filter(a => a.psychologistId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.psychologistId;
    if (!recentPsyId) return;
    getPsychologists().then(list => {
      const withSlug = withSlugs(list);
      setPsyDetails(withSlug.find(p => p.id === recentPsyId) ?? null);
    }).catch(() => {});
  }, [appts]);

  return (
    <ProfileShell
      title="Profilim"
      subtitle="Şəxsi məlumatlarınızı və hesab parametrlərinizi idarə edin"
      sideExtras={
        <div className="ppr-side">
          {riskLevel && (RISK_LABEL[riskLevel]) && (
            <div className="ppr-side-risk" style={{
              background: RISK_LABEL[riskLevel].bg,
              color: RISK_LABEL[riskLevel].fg,
            }}>
              <div className="ppr-side-risk__label">Klinik işarələnmə</div>
              <div className="ppr-side-risk__value">{RISK_LABEL[riskLevel].label}</div>
              <Link href="/patient/support" className="ppr-side-risk__link">
                Dəstək paneli →
              </Link>
            </div>
          )}

          <div className="ppr-side-card">
            <div className="ppr-side-card__head">
              <h3>Sizin haqqınızda</h3>
            </div>
            <div className="ppr-side-stats">
              <StatItem label="Tamamlanmış seans" value={stats.totalSessions} href="/patient/appointments" />
              <StatItem label="Aktiv hədəf" value={stats.activeGoals} href="/patient/goals" />
              <StatItem label="Açıq tapşırıq" value={stats.pendingTasks} href="/patient/homework" />
              <StatItem label="Sevimli psixoloq" value={stats.favoriteCount} href="/patient/favorites" />
            </div>
          </div>

          <div className="ppr-side-card">
            <div className="ppr-side-card__head">
              <h3>Sürətli giriş</h3>
            </div>
            <Link href="/patient/psychologists" className="ppr-side-link">
              <span className="ppr-side-link__icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </span>
              <span className="ppr-side-link__text">
                <strong>Psixoloq tap</strong>
                <small>Yeni mütəxəssis seç</small>
              </span>
              <span className="ppr-side-link__arrow">›</span>
            </Link>
            <Link href="/patient/support" className="ppr-side-link" style={{ borderTop: "1px solid var(--brand-100)" }}>
              <span className="ppr-side-link__icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </span>
              <span className="ppr-side-link__text">
                <strong>Dəstək</strong>
                <small>Hotline-lar və check-in</small>
              </span>
              <span className="ppr-side-link__arrow">›</span>
            </Link>
          </div>
        </div>
      }
      extras={
        psyDetails ? (
          <div className="ppr-card">
            <div className="ppr-card__head">
              <h2>Mənim psixoloqum</h2>
              <p>Son seanslarınız bu mütəxəssislədir</p>
            </div>
            <div className="ppr-psy">
              <div className="ppr-psy__avatar">
                {psyDetails.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={psyDetails.photoUrl} alt={psyDetails.name} />
                ) : (
                  <span>{initials(psyDetails.name)}</span>
                )}
              </div>
              <div className="ppr-psy__body">
                <div className="ppr-psy__name">{psyDetails.name}</div>
                <div className="ppr-psy__title">{psyDetails.title}</div>
                {psyDetails.specializations && psyDetails.specializations.length > 0 && (
                  <div className="ppr-psy__tags">
                    {psyDetails.specializations.slice(0, 3).map(s => (
                      <span key={s} className="ppr-psy__tag">{s}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="ppr-psy__actions">
                {psyDetails.slug && (
                  <>
                    <Link href={`/patient/psychologists/${psyDetails.slug}`}
                      className="ppr-btn ppr-btn--ghost">
                      Profil
                    </Link>
                    <Link href={`/patient/book/${psyDetails.slug}`}
                      className="ppr-btn ppr-btn--primary">
                      Rezerv et
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null
      }
    />
  );
}

function StatItem({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="ppr-stat">
      <div className="ppr-stat__val">{value}</div>
      <div className="ppr-stat__label">{label}</div>
    </Link>
  );
}
