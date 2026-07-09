"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PsychResourceTabs from "@/components/PsychResourceTabs";
import {
  psychologistApi,
  type ClientSummary,
  type Paged,
  type PsyTestSummary,
  type TestAssignment,
} from "@/lib/api";

function fmt(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  ASSIGNED:    { label: "Təyin edilib", color: "var(--brand-700)", bg: "var(--brand-50)" },
  PENDING:     { label: "Gözləyir",     color: "#92400E",          bg: "#FEF3C7" },
  IN_PROGRESS: { label: "Davam edir",   color: "#92400E",          bg: "#FEF3C7" },
  COMPLETED:   { label: "Tamamlandı",   color: "#065F46",          bg: "#D1FAE5" },
  EXPIRED:     { label: "Vaxtı bitib",  color: "#991B1B",          bg: "#FEE2E2" },
  CANCELLED:   { label: "Ləğv",         color: "#991B1B",          bg: "#FEE2E2" },
  CLOSED:      { label: "Bağlı",        color: "#374151",          bg: "#F3F4F6" },
};

function StatusBadge({ status }: { status: string }) {
  const b = STATUS_BADGE[status] ?? { label: status, color: "#374151", bg: "#F3F4F6" };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, color: b.color, background: b.bg }}>
      {b.label}
    </span>
  );
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

function smallBtn(color: string, bg: string): React.CSSProperties {
  return {
    fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 7,
    color, background: bg, border: "1px solid transparent",
    textDecoration: "none", cursor: "pointer", whiteSpace: "nowrap",
  };
}

const PAGE_SIZE = 30;
const EMPTY_ASSIGN_PAGE: Paged<TestAssignment> = { content: [], totalElements: 0, totalPages: 0, page: 0, size: PAGE_SIZE };

/** Panel subdomenləri — public test linki bunların HEÇ birində deyil, kök domendə olmalıdır. */
const PANEL_SUBS = new Set(["patient", "psycholog", "operator", "admin"]);

/** Cari host-dan panel subdomenini (məs. psycholog.khansoft.az → khansoft.az) soyaraq
 *  public (kök domen) origin-i qaytarır. Public test səhifəsi (/test/{token}) yalnız kök
 *  domendə xidmət olunur; subdomen-də proxy onu /psycholog/... -ə yönləndirib 404 verər. */
function publicOrigin(): string {
  const { protocol, hostname, port } = window.location;
  const parts = hostname.split(".");
  if (parts.length > 1 && PANEL_SUBS.has(parts[0])) parts.shift();
  const portStr = port ? `:${port}` : "";
  return `${protocol}//${parts.join(".")}${portStr}`;
}

/** Backend-dən gələn linki — nisbi yol və ya (subdomenli də ola bilən) tam URL — həmişə
 *  public kök domen üzərində mütləq URL-ə çevirir. Yolu saxlayır, yalnız host-u dəyişir. */
function toPublicUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${publicOrigin()}${u.pathname}${u.search}${u.hash}`;
  } catch {
    return `${publicOrigin()}${url.startsWith("/") ? "" : "/"}${url}`;
  }
}

export default function PsychologTestsPage() {
  const [tests, setTests] = useState<PsyTestSummary[]>([]);
  const [myTests, setMyTests] = useState<PsyTestSummary[]>([]);
  const [assignments, setAssignments] = useState<TestAssignment[]>([]);
  const [assignTotal, setAssignTotal] = useState(0);
  const [assignPage, setAssignPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Assign modal state
  const [assignTest, setAssignTest] = useState<PsyTestSummary | null>(null);

  // Public link state (per test id -> generated link)
  const [links, setLinks] = useState<Record<number, { url: string; token: string }>>({});
  const [linkBusy, setLinkBusy] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      psychologistApi.assignableTests().catch(() => [] as PsyTestSummary[]),
      psychologistApi.testAssignmentsPaged({ page: 0, size: PAGE_SIZE }).catch(() => EMPTY_ASSIGN_PAGE),
      psychologistApi.clients().catch(() => [] as ClientSummary[]),
      psychologistApi.myTests().catch(() => [] as PsyTestSummary[]),
    ])
      .then(([ts, as, cs, mine]) => {
        setTests(ts);
        setAssignments(as.content);
        setAssignTotal(as.totalElements);
        setAssignPage(0);
        setClients(cs);
        setMyTests(mine);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Yeni təyinat / yeni public link sonrası siyahını 0-cı səhifədən yenilə.
  const reloadAssignments = () => {
    psychologistApi.testAssignmentsPaged({ page: 0, size: PAGE_SIZE })
      .then(res => {
        setAssignments(res.content);
        setAssignTotal(res.totalElements);
        setAssignPage(0);
      })
      .catch(() => {});
  };

  const loadMoreAssignments = () => {
    setLoadingMore(true);
    psychologistApi.testAssignmentsPaged({ page: assignPage + 1, size: PAGE_SIZE })
      .then(res => {
        setAssignments(prev => [...prev, ...res.content]);
        setAssignTotal(res.totalElements);
        setAssignPage(res.page);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  const sortedAssignments = useMemo(() => {
    return [...assignments].sort(
      (a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime()
    );
  }, [assignments]);

  const createLink = async (test: PsyTestSummary) => {
    setLinkBusy(test.id);
    try {
      const res = await psychologistApi.createTestLink({ testId: test.id });
      setLinks(prev => ({ ...prev, [test.id]: { url: toPublicUrl(res.url), token: res.token } }));
      // Refresh assignments so the new public link appears in the table.
      reloadAssignments();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLinkBusy(null);
    }
  };

  const copyLink = async (testId: number, url: string) => {
    try {
      // `url` artıq toPublicUrl ilə kök domenə normallaşdırılıb.
      await navigator.clipboard.writeText(url);
      setCopied(testId);
      setTimeout(() => setCopied(c => (c === testId ? null : c)), 1800);
    } catch {
      alert("Kopyalamaq alınmadı");
    }
  };

  const closeLink = async (assignmentId: number) => {
    if (!confirm("Bu linki bağlamaq istəyirsiniz? Sonra yeni cavab qəbul olunmayacaq (mövcud nəticələr qalır).")) return;
    try {
      const updated = await psychologistApi.closeTestLink(assignmentId);
      setAssignments(prev => prev.map(a => a.id === assignmentId ? updated : a));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const requestShare = async (test: PsyTestSummary) => {
    if (!confirm(`"${test.title}" testini digər psixoloqlarla paylaşmaq üçün admin təsdiqinə göndərək?`)) return;
    try {
      const updated = await psychologistApi.requestTestShare(test.id);
      setMyTests(prev => prev.map(t => t.id === test.id ? updated : t));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const deleteMyTest = async (test: PsyTestSummary) => {
    if (!confirm(`"${test.title}" testini silmək istəyirsiniz?`)) return;
    try {
      await psychologistApi.deleteMyTest(test.id);
      setMyTests(prev => prev.filter(t => t.id !== test.id));
      load();
    } catch (e) {
      alert((e as Error).message);
    }
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
            Testləri pasiyentlərə təyin edin və ya public link yaradın, nəticələri burada izləyin.
          </p>
        </div>
        <Link href="/psycholog/tests/manage/new" style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10,
          background: "var(--brand)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none",
        }}>+ Yeni test yarat</Link>
      </div>

      {/* ── My tests (psychologist-authored) ───────────────────────────────── */}
      {!loading && myTests.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A2535", margin: "0 0 12px" }}>Mənim testlərim</h2>
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", overflow: "hidden" }}>
            {myTests.map((t, idx) => (
              <div key={t.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                borderTop: idx > 0 ? "1px solid #EEF2F7" : "none", flexWrap: "wrap",
              }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 600, color: "#1A2535", fontSize: 14 }}>{t.title}</div>
                  <div style={{ fontSize: 11.5, color: "#52718F", marginTop: 2 }}>
                    {t.questionCount} sual · {t.scaleCount} şkala
                  </div>
                </div>
                <ShareStatusBadge status={t.shareStatus} />
                <div style={{ display: "flex", gap: 6 }}>
                  <a href={`/psycholog/tests/manage/${t.id}/edit`} style={smallBtn("#52718F", "#EEF2F7")}>Redaktə</a>
                  {(t.shareStatus === "PRIVATE" || t.shareStatus === "REJECTED") && (
                    <button onClick={() => requestShare(t)} style={smallBtn("var(--brand-700)", "var(--brand-50)")}>Paylaşım üçün göndər</button>
                  )}
                  <button onClick={() => deleteMyTest(t)} style={smallBtn("#991B1B", "#FEE2E2")}>Sil</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Available tests ────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A2535", margin: "0 0 12px" }}>Mövcud testlər</h2>

        {loading ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: 40, textAlign: "center", color: "#52718F" }}>
            Yüklənir…
          </div>
        ) : tests.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: 48, textAlign: "center", color: "#52718F", border: "1px dashed #DDE6F0" }}>
            Hələ təyin edilə bilən test yoxdur.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {tests.map(test => {
              const link = links[test.id];
              return (
                <div key={test.id} style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #EEF2F7", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1A2535", margin: 0 }}>{test.title}</h3>
                      {!test.published && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: "#92400E", background: "#FEF3C7" }}>
                          Qaralama
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#52718F" }}>
                      {test.questionCount} sual · {test.scaleCount} şkala
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                    <button
                      type="button"
                      onClick={() => setAssignTest(test)}
                      style={{ flex: 1, padding: "8px 12px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--brand)", color: "#fff", cursor: "pointer" }}
                    >
                      Pasiyentə təyin et
                    </button>
                    <button
                      type="button"
                      onClick={() => createLink(test)}
                      disabled={linkBusy === test.id}
                      style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--brand-200)", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--brand-50)", color: "var(--brand)", cursor: linkBusy === test.id ? "wait" : "pointer" }}
                    >
                      {linkBusy === test.id ? "Yaradılır…" : "Public link yarat"}
                    </button>
                  </div>

                  {link && (
                    <div style={{ background: "#F8FAFC", border: "1px solid #EEF2F7", borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#52718F", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
                        Public link
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                          readOnly
                          value={link.url}
                          onFocus={e => e.currentTarget.select()}
                          style={{ flex: 1, minWidth: 0, padding: "6px 8px", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 12, color: "#374151", background: "#fff" }}
                        />
                        <button
                          type="button"
                          onClick={() => copyLink(test.id, link.url)}
                          style={{ padding: "6px 12px", border: "1px solid var(--brand-200)", borderRadius: 6, fontSize: 12, fontWeight: 600, color: "var(--brand)", background: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}
                        >
                          {copied === test.id ? "Kopyalandı" : "Kopyala"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Assignments table ──────────────────────────────────────────────── */}
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A2535", margin: "0 0 12px" }}>Təyinatlar</h2>

        {loading ? null : sortedAssignments.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: 48, textAlign: "center", color: "#52718F", border: "1px dashed #DDE6F0" }}>
            Hələ təyinat yoxdur.
          </div>
        ) : (
          <>
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EEF2F7", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F8FAFC", textAlign: "left" }}>
                  <th style={thStyle}>Test</th>
                  <th style={thStyle}>Pasiyent</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Təyin edilib</th>
                  <th style={thStyle}>Tamamlanıb</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Nəticə</th>
                </tr>
              </thead>
              <tbody>
                {sortedAssignments.map(a => (
                  <tr key={a.id} style={{ borderTop: "1px solid #EEF2F7" }}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600, color: "#1A2535" }}>{a.testTitle}</span>
                      {a.note && (
                        <div style={{ fontSize: 11.5, color: "#52718F", marginTop: 3, maxWidth: 240 }}>
                          {a.note}
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {a.patientName ? (
                        <span style={{ color: "#374151" }}>{a.patientName}</span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: "#52718F", fontStyle: "italic" }}>Public link</span>
                          <span title="Dolduran sayı" style={{
                            fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 999,
                            background: a.submissionCount > 0 ? "var(--brand-50)" : "#F1F5F9",
                            color: a.submissionCount > 0 ? "var(--brand-700)" : "#9AAFC4",
                          }}>{a.submissionCount} nəfər</span>
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}><StatusBadge status={a.publicToken && a.status === "CANCELLED" ? "CLOSED" : a.status} /></td>
                    <td style={{ ...tdStyle, color: "#52718F" }}>{fmt(a.assignedAt)}</td>
                    <td style={{ ...tdStyle, color: "#52718F" }}>{fmt(a.completedAt)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 12, justifyContent: "flex-end" }}>
                        {a.submissionCount > 0 ? (
                          <Link
                            href={`/psycholog/tests/${a.id}`}
                            style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)", textDecoration: "none" }}
                          >
                            {a.publicToken ? `${a.submissionCount} nəticə ›` : "Nəticə ›"}
                          </Link>
                        ) : (
                          <span style={{ color: "#9AAFC4" }}>—</span>
                        )}
                        {a.publicToken && a.status !== "CANCELLED" && (
                          <button onClick={() => closeLink(a.id)}
                            style={{ fontSize: 12, fontWeight: 600, color: "#991B1B", background: "transparent", border: "1px solid #FECACA", padding: "3px 10px", borderRadius: 7, cursor: "pointer" }}>
                            Bağla
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {assignments.length < assignTotal && (
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button type="button" onClick={loadMoreAssignments} disabled={loadingMore}
                style={{ background: "#fff", color: "var(--brand)", border: "1px solid #D6E2F7", borderRadius: 10, padding: "10px 22px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: loadingMore ? "wait" : "pointer", opacity: loadingMore ? 0.7 : 1 }}>
                {loadingMore ? "Yüklənir…" : `Daha çox göstər (+${Math.min(PAGE_SIZE, assignTotal - assignments.length)})`}
              </button>
            </div>
          )}
          </>
        )}
      </section>

      {assignTest && (
        <AssignModal
          test={assignTest}
          clients={clients}
          onClose={() => setAssignTest(null)}
          onAssigned={() => {
            reloadAssignments();
            setAssignTest(null);
          }}
        />
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "11px 16px",
  fontSize: 11,
  fontWeight: 700,
  color: "#52718F",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  verticalAlign: "middle",
};

/* ─── Assign modal ───────────────────────────────────────────────────────── */

function AssignModal({
  test, clients, onClose, onAssigned,
}: {
  test: PsyTestSummary;
  clients: ClientSummary[];
  onClose: () => void;
  onAssigned: (a: TestAssignment) => void;
}) {
  const [search, setSearch] = useState("");
  const [patientId, setPatientId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      (c.name + " " + (c.email ?? "") + " " + (c.phone ?? "")).toLowerCase().includes(q)
    );
  }, [clients, search]);

  const submit = async () => {
    if (patientId === null) { setErr("Pasiyent seçin"); return; }
    setSaving(true); setErr(null);
    try {
      const created = await psychologistApi.assignTest({
        testId: test.id,
        patientId,
        note: note.trim() || undefined,
      });
      onAssigned(created);
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "min(560px, 100%)", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #EFF2F7" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A2535", margin: 0 }}>Testi təyin et</h2>
          <p style={{ fontSize: 12, color: "#52718F", marginTop: 4 }}>
            «{test.title}» — pasiyent seçin, ona bildiriş gedəcək.
          </p>
        </div>

        <div style={{ padding: 22, overflowY: "auto" }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pasiyent axtar (ad, email, telefon)…"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, marginBottom: 12, boxSizing: "border-box" }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto", marginBottom: 14 }}>
            {filtered.length === 0 ? (
              <div style={{ fontSize: 13, color: "#52718F", padding: "16px 4px", textAlign: "center" }}>
                Pasiyent tapılmadı.
              </div>
            ) : (
              filtered.map(c => {
                const active = patientId === c.patientId;
                return (
                  <button
                    key={c.patientId}
                    type="button"
                    onClick={() => setPatientId(c.patientId)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "flex-start",
                      padding: "10px 12px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                      border: active ? "1.5px solid var(--brand)" : "1px solid #E5E7EB",
                      background: active ? "var(--brand-50)" : "#fff",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1A2535" }}>{c.name}</span>
                    <span style={{ fontSize: 12, color: "#52718F" }}>
                      {c.email || c.phone || "—"}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A2535", marginBottom: 6 }}>
            Qeyd (məcburi deyil)
          </label>
          <textarea
            rows={3} value={note} maxLength={500}
            onChange={e => setNote(e.target.value)}
            placeholder="Pasiyentə göstərilən qısa təlimat…"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
          />

          {err && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: 10, borderRadius: 8, fontSize: 12, marginTop: 10 }}>
              {err}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid #EFF2F7" }}>
          <button onClick={onClose} disabled={saving}
            style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff", cursor: saving ? "wait" : "pointer" }}>
            Bağla
          </button>
          <button onClick={submit} disabled={saving || patientId === null}
            style={{ padding: "8px 18px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--brand)", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving || patientId === null ? 0.6 : 1 }}>
            {saving ? "Təyin edilir…" : "Təyin et"}
          </button>
        </div>
      </div>
    </div>
  );
}
