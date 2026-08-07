"use client";

import { useEffect, useState } from "react";
import { psychologistApi, type MyPlan } from "@/lib/api";
import { PC, cardStyle, sectionH2, sectionSub } from "@/components/ProfileShell";
import PlanTickIcon from "@/components/PlanTickIcon";
import { azFormatDate } from "@/lib/datetime";
import { useT } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * Psixoloqun öz planı — ad, plana daxil olan xidmətlər, etibar tarixi və «Yenilə».
 *
 * Sidebar-dakı nişan bu səhifəyə keçirdi, amma burada plan haqqında heç nə yazılmırdı:
 * psixoloq nişanın nə demək olduğunu və planının nə vaxt bitdiyini görə bilmirdi.
 *
 * Xidmət siyahısı backend-dən gələn AÇIQ modul açarlarından qurulur — planın öz
 * siyahısından yox. Fərq var: Fanus psixoloqunda «Paketlər» modulu plana daxil olsa
 * belə bağlı qalır, ona görə plandakı siyahı yanlış vəd verərdi.
 */

/** Modul açarı → görünən ad. Admin paneldəki siyahı ilə eyni dəst. */
const MODULE_LABEL_KEYS: Record<string, MessageKey> = {
  packages: "planCard.modPackages",
  tests: "planCard.modTests",
  homework: "planCard.modHomework",
  articles: "planCard.modArticles",
  community: "planCard.modCommunity",
  resources: "planCard.modResources",
  reviews: "planCard.modReviews",
  calendar: "planCard.modCalendar",
  appointments: "planCard.modAppointments",
  clients: "planCard.modClients",
  availability: "planCard.modAvailability",
  dashboard: "planCard.modDashboard",
};

/** Bitməsinə bu qədər gün qalanda xəbərdarlıq rəngi işə düşür. */
const WARN_DAYS = 14;

const RENEW_WHATSAPP = "https://wa.me/994993585888?text=";

export default function PsyPlanCard() {
  const { t } = useT();
  const [plan, setPlan] = useState<MyPlan | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    psychologistApi.getMyPlan().then(setPlan).catch(() => setFailed(true));
  }, []);

  // Yüklənmə/xəta halında kart ümumiyyətlə göstərilmir — profil səhifəsi
  // plan olmadan da tam işlək qalmalıdır.
  if (failed || !plan) return null;

  const color = plan.assigned ? (plan.tikColor || "var(--brand)") : "var(--oxford-30, #B8C6D6)";
  const days = plan.daysLeft ?? null;
  const expired = days !== null && days < 0;
  const soon = days !== null && days >= 0 && days <= WARN_DAYS;

  const renewHref = RENEW_WHATSAPP + encodeURIComponent(
    plan.assigned
      ? t("planCard.waNamed", { name: plan.name ?? "" })
      : t("planCard.waNone"),
  );

  const modules = (plan.modules ?? []).filter(m => MODULE_LABEL_KEYS[m]);

  return (
    <section style={cardStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 4 }}>
        <span style={{ marginTop: 2 }}><PlanTickIcon color={color} size={26} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={sectionH2}>
            {plan.assigned ? t("psyPlan.named", { name: plan.name ?? "" }) : t("psyPlan.none")}
          </h2>
          <p style={sectionSub}>
            {plan.assigned ? t("planCard.sub") : t("planCard.subNone")}
          </p>
        </div>
      </div>

      {/* Etibar müddəti. Tarix təyin olunmayıbsa sətir yazılmır — «müddətsiz»
          yazmaq admin sadəcə tarix qoymağı unutduqda yanlış vəd olardı. */}
      {plan.expiresAt && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          marginTop: 14, padding: "10px 12px", borderRadius: 10,
          border: `1px solid ${expired || soon ? "#FECACA" : PC.border}`,
          background: expired || soon ? "#FEF2F2" : "transparent",
        }}>
          <span style={{ fontSize: 13, color: expired || soon ? "#B91C1C" : PC.mut }}>
            {expired ? t("planCard.expiredOn", { date: azFormatDate(plan.expiresAt) })
              : t("planCard.validUntil", { date: azFormatDate(plan.expiresAt) })}
          </span>
          {!expired && days !== null && (
            <span style={{ fontSize: 12, fontWeight: 700, color: soon ? "#B91C1C" : PC.mut }}>
              {t("planCard.daysLeft", { n: days })}
            </span>
          )}
        </div>
      )}

      {modules.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: PC.mut, marginBottom: 8 }}>
            {t("planCard.includes")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {modules.map(m => (
              <span key={m} style={{
                fontSize: 12, fontWeight: 600, color: PC.ink,
                border: `1px solid ${PC.border}`, borderRadius: 8, padding: "5px 9px",
              }}>
                {t(MODULE_LABEL_KEYS[m])}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <a
          href={renewHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            height: 42, padding: "0 18px", borderRadius: 10,
            background: "var(--brand)", color: "#fff",
            fontSize: 14, fontWeight: 700, textDecoration: "none",
          }}
        >
          {t("planCard.renewCta")}
        </a>
      </div>
    </section>
  );
}
