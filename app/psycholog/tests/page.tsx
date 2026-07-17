"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PsychResourceTabs from "@/components/PsychResourceTabs";
import AssignTestModal from "@/components/AssignTestModal";
import {
  psychologistApi,
  type ClientSummary,
  type PsyTestSummary,
  type PsyTestReq,
  type TestAssignment,
} from "@/lib/api";

/** Panel subdomeni soyaraq public (kök domen) origin qaytarır. */
const PANEL_SUBS = new Set(["patient", "psycholog", "operator", "admin"]);
function publicOrigin(): string {
  const { protocol, hostname, port } = window.location;
  const parts = hostname.split(".");
  if (parts.length > 1 && PANEL_SUBS.has(parts[0])) parts.shift();
  const portStr = port ? `:${port}` : "";
  return `${protocol}//${parts.join(".")}${portStr}`;
}
function toPublicUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${publicOrigin()}${u.pathname}${u.search}${u.hash}`;
  } catch {
    return `${publicOrigin()}${url.startsWith("/") ? "" : "/"}${url}`;
  }
}

const SHARE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  PRIVATE:  { label: "Şəxsi",            color: "#374151", bg: "#F3F4F6" },
  PENDING:  { label: "Təsdiq gözləyir",  color: "#92400E", bg: "#FEF3C7" },
  APPROVED: { label: "Paylaşılıb",       color: "#065F46", bg: "#D1FAE5" },
  REJECTED: { label: "Rədd edildi",      color: "#991B1B", bg: "#FEE2E2" },
};

function ShareStatusBadge({ status }: { status: string }) {
  const b = SHARE_BADGE[status] ?? SHARE_BADGE.PRIVATE;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: b.color, background: b.bg }}>
      {b.label}
    </span>
  );
}

export default function PsychologTestsPage() {
  const [tests, setTests] = useState<PsyTestSummary[]>([]);
  const [myTests, setMyTests] = useState<PsyTestSummary[]>([]);
  const [assignments, setAssignments] = useState<TestAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [tab, setTab] = useState<"mine" | "system">("mine");
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const router = useRouter();

  // Quick-share popup (created public link) + assign target.
  const [share, setShare] = useState<{ testId: number; testTitle: string; url: string; token: string } | null>(null);
  const [shareBusy, setShareBusy] = useState<number | null>(null);
  const [assignTarget, setAssignTarget] = useState<{ id: number; title: string } | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      psychologistApi.assignableTests().catch(() => [] as PsyTestSummary[]),
      psychologistApi.myTests().catch(() => [] as PsyTestSummary[]),
      psychologistApi.testAssignments().catch(() => [] as TestAssignment[]),
      psychologistApi.clients().catch(() => [] as ClientSummary[]),
    ])
      .then(([ts, mine, as, cs]) => {
        setTests(ts);
        setMyTests(mine);
        setAssignments(as);
        setClients(cs);
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const systemTests = useMemo(() => tests.filter((t) => !t.mine), [tests]);
  const totalSubs = useMemo(() => assignments.reduce((s, a) => s + a.submissionCount, 0), [assignments]);

  // "Paylaş" → create a public link (a single link many patients can fill in) and
  // pop up the created link.
  const onShare = async (test: PsyTestSummary) => {
    setShareBusy(test.id);
    try {
      const res = await psychologistApi.createTestLink({ testId: test.id });
      setShare({ testId: test.id, testTitle: test.title, url: toPublicUrl(res.url), token: res.token });
      load(); // refresh assignment counts
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setShareBusy(null);
    }
  };

  const deleteMyTest = async (test: PsyTestSummary) => {
    if (!confirm(`"${test.title}" testini silmək istəyirsiniz?`)) return;
    try {
      await psychologistApi.deleteMyTest(test.id);
      setMyTests((prev) => prev.filter((t) => t.id !== test.id));
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  // Duplicate one of my tests into a fresh copy ("(kopya)" suffix).
  const duplicate = async (test: PsyTestSummary) => {
    try {
      const full = await psychologistApi.myTest(test.id);
      const payload: PsyTestReq = {
        title: `${full.title} (kopya)`,
        description: full.description ?? undefined,
        instructions: full.instructions ?? undefined,
        scoreBasis: full.scoreBasis,
        published: false,
        questions: full.questions.map((q, qi) => ({
          text: q.text,
          imageUrl: q.imageUrl ?? undefined,
          displayOrder: qi,
          options: q.options.map((o, oi) => ({
            label: o.label,
            points: o.points,
            imageUrl: o.imageUrl ?? undefined,
            displayOrder: oi,
          })),
        })),
        scales: full.scales.map((s, si) => ({
          label: s.label,
          minScore: s.minScore,
          maxScore: s.maxScore,
          color: s.color ?? undefined,
          description: s.description ?? undefined,
          displayOrder: si,
        })),
      };
      await psychologistApi.createMyTest(payload);
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))", gap: 12 };
  const emptyStyle: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: 48, textAlign: "center", color: "#52718F", border: "1px dashed #DDE6F0" };

  // ── Rich test card (kebab menu + meta + navigation) ───────────────────────
  const renderTestCard = (test: PsyTestSummary, mine: boolean) => {
    const draft = test.status === "DRAFT";
    const menuOpen = openMenu === test.id;
    const letter = (test.title?.trim()?.[0] ?? "T").toUpperCase();
    return (
      <div key={test.id} style={{ position: "relative", background: "#fff", borderRadius: 16, padding: 18, border: "1px solid #EEF2F7", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Header: avatar + title + kebab */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, background: "var(--brand-50, #EEF4F9)", color: "var(--brand, #3B6FA5)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 17 }}>
            {letter}
          </div>
          <h3 style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: "#1A2535", margin: 0, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {test.title?.trim() || "Adsız qaralama"}
          </h3>
          {mine && (
            <div style={{ position: "relative", flexShrink: 0 }}>
              <button
                type="button"
                aria-label="Menyu"
                onClick={() => setOpenMenu(menuOpen ? null : test.id)}
                style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #EEF2F7", background: menuOpen ? "#F1F5F9" : "#fff", color: "#52718F", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              >
                <IconDots />
              </button>
              {menuOpen && (
                <>
                  <div onClick={() => setOpenMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 41, background: "#fff", border: "1px solid #EEF2F7", borderRadius: 12, boxShadow: "0 12px 32px rgba(10,26,51,0.16)", padding: 6, width: 200, display: "flex", flexDirection: "column", gap: 2 }}>
                    <MenuItem icon={<IconEdit />} onClick={() => { setOpenMenu(null); router.push(`/psycholog/tests/manage/${test.id}/edit`); }}>
                      {draft ? "Davam et" : "Redaktə et"}
                    </MenuItem>
                    {!draft && <MenuItem icon={<IconCopy />} onClick={() => { setOpenMenu(null); duplicate(test); }}>Köçür</MenuItem>}
                    {!draft && (
                      <MenuItem icon={<IconShareSm />} onClick={() => { setOpenMenu(null); onShare(test); }}>
                        {shareBusy === test.id ? "Paylaşılır…" : "Paylaş"}
                      </MenuItem>
                    )}
                    <MenuItem danger icon={<IconTrashSm />} onClick={() => { setOpenMenu(null); deleteMyTest(test); }}>Sil</MenuItem>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Status chip */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {draft ? (
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: "#92400E", background: "#FEF3C7" }}>Qaralama</span>
          ) : mine ? (
            <ShareStatusBadge status={test.shareStatus} />
          ) : (
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: "#065F46", background: "#D1FAE5" }}>Aktiv</span>
          )}
        </div>

        {/* Meta */}
        <div style={{ display: "flex", gap: 16, fontSize: 12.5, color: "#52718F", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><IconDoc /> {test.questionCount} sual</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><IconBands /> {test.scaleCount} zolaq</span>
        </div>

        {/* Primary actions → internal pages */}
        {draft ? (
          <div style={{ display: "flex", gap: 8 }}>
            <a href={`/psycholog/tests/manage/${test.id}/edit`} style={{ flex: 1, textAlign: "center", padding: "10px 12px", borderRadius: 10, fontSize: 13, fontWeight: 700, background: "var(--brand)", color: "#fff", textDecoration: "none" }}>
              Davam et
            </a>
            <button type="button" onClick={() => router.push(`/psycholog/tests/manage/${test.id}/preview`)}
              style={{ padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, border: "1px solid var(--brand-200)", background: "#fff", color: "var(--brand)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <IconEye /> Bax
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => router.push(`/psycholog/tests/manage/${test.id}/stats`)}
              style={{ flex: 1, padding: "10px 12px", borderRadius: 10, fontSize: 13, fontWeight: 700, border: "none", background: "var(--brand)", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <IconChart /> Statistika
            </button>
            <button type="button" onClick={() => router.push(`/psycholog/tests/manage/${test.id}/preview`)}
              style={{ padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, border: "1px solid var(--brand-200)", background: "#fff", color: "var(--brand)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <IconEye /> Bax
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <PsychResourceTabs />
      </div>

      <div style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1A2535", margin: 0 }}>Psixoloji testlər</h1>
          <p style={{ fontSize: 13, color: "#52718F", marginTop: 4 }}>
            Testləri yaradın, önizləyin və statistikaya baxın.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/psycholog/tests/manage/new")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, background: "var(--brand)", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}
        >
          + Yeni test yarat
        </button>
      </div>

      {/* ── KPI row ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
        <KpiCard label="Mənim testlərim" value={myTests.length} />
        <KpiCard label="Sistem testləri" value={systemTests.length} />
        <KpiCard label="Təyinatlar" value={assignments.length} />
        <KpiCard label="Ümumi cavablar" value={totalSubs} accent="var(--brand)" />
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 18, borderBottom: "1px solid #EEF2F7", marginBottom: 18 }}>
        <TabButton active={tab === "mine"} onClick={() => setTab("mine")} label="Mənim testlərim" count={myTests.length} />
        <TabButton active={tab === "system"} onClick={() => setTab("system")} label="Sistem testləri" count={systemTests.length} />
      </div>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "#52718F" }}>Yüklənir…</div>
      ) : tab === "mine" ? (
        myTests.length === 0 ? (
          <div style={emptyStyle}>Hələ öz testiniz yoxdur. Yuxarıdakı “+ Yeni test yarat” ilə başlayın.</div>
        ) : (
          <div style={gridStyle}>{myTests.map((t) => renderTestCard(t, true))}</div>
        )
      ) : systemTests.length === 0 ? (
        <div style={emptyStyle}>Hələ sizə təqdim olunan sistem testi yoxdur.</div>
      ) : (
        <div style={gridStyle}>{systemTests.map((t) => renderTestCard(t, false))}</div>
      )}

      {share && (
        <SharePopup
          share={share}
          onClose={() => setShare(null)}
          onAssign={() => {
            const t = { id: share.testId, title: share.testTitle };
            setShare(null);
            setAssignTarget(t);
          }}
        />
      )}

      {assignTarget && (
        <AssignTestModal
          testId={assignTarget.id}
          testTitle={assignTarget.title}
          clients={clients}
          onClose={() => setAssignTarget(null)}
          onAssigned={() => { setAssignTarget(null); load(); }}
        />
      )}
    </div>
  );
}

/* ── "Paylaş" success popup — created public link + assign option ────────────── */
function SharePopup({
  share, onClose, onAssign,
}: {
  share: { testTitle: string; url: string; token: string };
  onClose: () => void;
  onAssign: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      alert("Kopyalamaq alınmadı");
    }
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "min(460px, 100%)", padding: 24, boxShadow: "0 18px 50px rgba(10,26,51,0.28)", textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: 999, background: "#D1FAE5", color: "#065F46", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1A2535", margin: "0 0 6px" }}>Link yaradıldı</h3>
        <p style={{ fontSize: 13, color: "#52718F", lineHeight: 1.6, margin: "0 0 16px" }}>
          Bu linki paylaşın — bir neçə pasiyent öz məlumatlarını yazaraq testi işləyə bilər.
        </p>

        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 16 }}>
          <input readOnly value={share.url} onFocus={(e) => e.currentTarget.select()}
            style={{ flex: 1, minWidth: 0, padding: "9px 10px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12.5, color: "#374151", background: "#F8FAFC" }} />
          <button type="button" onClick={copy}
            style={{ padding: "9px 14px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--brand)", cursor: "pointer", whiteSpace: "nowrap" }}>
            {copied ? "Kopyalandı" : "Kopyala"}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 14px", color: "#9AAFC4", fontSize: 12 }}>
          <span style={{ flex: 1, height: 1, background: "#EEF2F7" }} /> və ya <span style={{ flex: 1, height: 1, background: "#EEF2F7" }} />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onAssign}
            style={{ flex: 1, padding: "9px 12px", border: "1px solid var(--brand-200)", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "var(--brand-50)", color: "var(--brand)", cursor: "pointer" }}>
            Pasiyentə təyin et
          </button>
          <button type="button" onClick={onClose}
            style={{ padding: "9px 16px", border: "1px solid #E5E7EB", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "#fff", color: "#374151", cursor: "pointer" }}>
            Bağla
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Helper components ──────────────────────────────────────────────────────── */

function KpiCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 150, background: "#fff", border: "1px solid #EEF2F7", borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent ?? "#1A2535", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12.5, color: "#52718F", marginTop: 6 }}>{label}</div>
    </div>
  );
}

function TabButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: "10px 2px",
        marginBottom: -1,
        fontFamily: "inherit",
        fontSize: 14,
        fontWeight: 700,
        color: active ? "var(--brand)" : "#52718F",
        borderBottom: `2px solid ${active ? "var(--brand)" : "transparent"}`,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {label}
      {count !== undefined && (
        <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: active ? "var(--brand-50)" : "#F1F5F9", color: active ? "var(--brand-700)" : "#9AAFC4" }}>
          {count}
        </span>
      )}
    </button>
  );
}


function MenuItem({ children, icon, onClick, danger }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={(e) => { e.currentTarget.style.background = danger ? "#FEE2E2" : "#F1F5F9"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: 8, border: "none", cursor: "pointer", background: "transparent", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: danger ? "#991B1B" : "#334155" }}
    >
      <span style={{ color: danger ? "#B91C1C" : "#64748B", display: "inline-flex", flexShrink: 0 }}>{icon}</span>
      {children}
    </button>
  );
}

function IconDots() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" />
    </svg>
  );
}
function IconEdit() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
function IconCopy() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}
function IconShareSm() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6" />
    </svg>
  );
}
function IconTrashSm() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" />
    </svg>
  );
}
function IconDoc() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" />
    </svg>
  );
}
function IconBands() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2l9 5-9 5-9-5 9-5z" /><path d="M3 12l9 5 9-5" /><path d="M3 17l9 5 9-5" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3v18h18" /><rect x="7" y="11" width="3" height="7" rx="0.5" /><rect x="12.5" y="7" width="3" height="11" rx="0.5" /><rect x="18" y="13" width="3" height="5" rx="0.5" />
    </svg>
  );
}
function IconEye() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}
