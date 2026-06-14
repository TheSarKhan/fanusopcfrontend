"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProfileShell from "@/components/ProfileShell";
import GoogleCalendarCard from "@/components/GoogleCalendarCard";
import { psychologistApi, type Psychologist, type PackageDto, type PackageReq } from "@/lib/api";
import { formatAzn } from "@/lib/money";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function PsychologProfilePage() {
  const [me, setMe] = useState<Psychologist | null>(null);

  useEffect(() => {
    psychologistApi.me().then(setMe).catch(() => setMe(null));
  }, []);

  return (
    <ProfileShell
      title="Profilim"
      subtitle="Şəxsi məlumatlarınızı və psixoloq profilinizi idarə edin"
      sideExtras={
        me?.slug ? (
          <div className="uprof-card uprof-side-card">
            <div className="uprof-side-card-head">
              <h3>Sürətli giriş</h3>
            </div>
            <Link href={`/psychologists/${me.slug}`} target="_blank" className="uprof-side-link">
              <div className="uprof-side-link-icon">👤</div>
              <div className="uprof-side-link-text">
                <strong>Public profilim</strong>
                <small>Pasiyentlərə görünən səhifə</small>
              </div>
              <span className="uprof-side-link-arrow">›</span>
            </Link>
            <Link href="/psycholog/availability" className="uprof-side-link" style={{ borderTop: "1px solid var(--brand-100)" }}>
              <div className="uprof-side-link-icon">🕓</div>
              <div className="uprof-side-link-text">
                <strong>İş vaxtları</strong>
                <small>Həftəlik cədvəl və istisnalar</small>
              </div>
              <span className="uprof-side-link-arrow">›</span>
            </Link>
            <Link href="/psycholog/calendar" className="uprof-side-link" style={{ borderTop: "1px solid var(--brand-100)" }}>
              <div className="uprof-side-link-icon">📅</div>
              <div className="uprof-side-link-text">
                <strong>Cədvəl</strong>
                <small>Həftəlik randevu izləməsi</small>
              </div>
              <span className="uprof-side-link-arrow">›</span>
            </Link>
          </div>
        ) : null
      }
      extras={
        me ? (
          <>
          <GoogleCalendarCard />
          <PricingCard editable={me.psychologistType === "NORMAL"} />
          <StatsSourceCard
            initialSource={me.statsSource ?? "FANUS_PLATFORM"}
            fanusCount={me.fanusSessionCount ?? 0}
            priorCount={me.priorExperienceSessions ?? 0}
            onSaved={(p) => setMe(prev => prev ? { ...prev, ...p } : prev)}
          />
          <div className="uprof-card">
            <div className="uprof-card-head">
              <h2>Public psixoloq profili</h2>
              <p>Pasiyentlərin gördüyü məlumatlar</p>
            </div>
            <div style={{ padding: 20, display: "grid", gap: 16 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: "var(--brand-50)", color: "var(--brand-700)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 22, flexShrink: 0,
                  border: "1px solid var(--brand-100)", overflow: "hidden",
                }}>
                  {me.photoUrl ? (
                     
                    <img src={me.photoUrl} alt={me.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    me.name.split(" ").filter(Boolean).map(s => s[0]).slice(0, 2).join("").toUpperCase()
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)" }}>{me.name}</div>
                  <div style={{ fontSize: 13, color: "var(--oxford-60)", marginTop: 2 }}>{me.title}</div>
                </div>
              </div>

              <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: 0, fontSize: 13 }}>
                <div>
                  <dt style={{ color: "var(--oxford-60)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>İxtisaslar</dt>
                  <dd style={{ margin: "4px 0 0", color: "var(--oxford)", fontWeight: 500 }}>
                    {me.specializations?.slice(0, 4).join(" · ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt style={{ color: "var(--oxford-60)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>Dillər</dt>
                  <dd style={{ margin: "4px 0 0", color: "var(--oxford)", fontWeight: 500 }}>{me.languages || "—"}</dd>
                </div>
                <div>
                  <dt style={{ color: "var(--oxford-60)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>Təcrübə</dt>
                  <dd style={{ margin: "4px 0 0", color: "var(--oxford)", fontWeight: 500 }}>{me.experience ?? "—"}</dd>
                </div>
                <div>
                  <dt style={{ color: "var(--oxford-60)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>Seans müddəti</dt>
                  <dd style={{ margin: "4px 0 0", color: "var(--oxford)", fontWeight: 500 }}>{me.defaultSessionMinutes ?? 50} dəq</dd>
                </div>
              </dl>

              <p style={{ fontSize: 11.5, color: "var(--oxford-60)", margin: 0, lineHeight: 1.6, padding: "10px 12px", background: "var(--brand-50)", borderRadius: 8, borderLeft: "3px solid var(--brand-200)" }}>
                Bio, ixtisas və sertifikat dəyişiklikləri üçün admin komandasıyla əlaqə saxlayın —
                hər güncəlləmə pasiyentlər tərəfindən görünür və yoxlanılır.
              </p>
            </div>
          </div>
          </>
        ) : null
      }
    />
  );
}

/* ─── Qiymət və Paketlər (Modul A/C) ───────────────────────────────────────── */

const fieldStyle: React.CSSProperties = {
  width: "100%", padding: "9px 11px", borderRadius: 8,
  border: "1px solid var(--oxford-10)", outline: "none",
  fontSize: 13, color: "var(--oxford)", background: "#fff",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 600, color: "var(--oxford-60)",
  textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 5,
};

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function PricingCard({ editable }: { editable: boolean }) {
  const { t } = useT();

  const [loading, setLoading] = useState(true);
  const [individualPrice, setIndividualPrice] = useState<number | null>(null);
  const [individualInput, setIndividualInput] = useState<string>("");
  const [savedPrice, setSavedPrice] = useState<number | null>(null);
  const [savingPrice, setSavingPrice] = useState(false);

  const [packages, setPackages] = useState<PackageDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // Add package form
  const [addName, setAddName] = useState("");
  const [addSessions, setAddSessions] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [adding, setAdding] = useState(false);

  // Edit package form (inline)
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editSessions, setEditSessions] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const flashSaved = () => {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2200);
  };

  const loadPackages = () =>
    psychologistApi.myPackages().then(setPackages).catch(() => setPackages([]));

  useEffect(() => {
    setLoading(true);
    Promise.all([
      psychologistApi.myPricing().catch(() => ({ individualPrice: null, currency: "AZN" })),
      psychologistApi.myPackages().catch(() => [] as PackageDto[]),
    ]).then(([pricing, pkgs]) => {
      setIndividualPrice(pricing.individualPrice);
      setSavedPrice(pricing.individualPrice);
      setIndividualInput(pricing.individualPrice != null ? String(pricing.individualPrice) : "");
      setPackages(pkgs);
    }).finally(() => setLoading(false));
  }, []);

  const priceDirty = Number(individualInput) !== (savedPrice ?? 0) && individualInput.trim() !== "";

  const saveIndividual = async () => {
    setError(null);
    const val = Number(individualInput);
    if (!Number.isFinite(val) || val < 0) {
      setError(t("pricing.individualPrice"));
      return;
    }
    setSavingPrice(true);
    try {
      const res = await psychologistApi.updateMyPricing(val);
      setIndividualPrice(res.individualPrice);
      setSavedPrice(res.individualPrice);
      setIndividualInput(res.individualPrice != null ? String(res.individualPrice) : "");
      flashSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingPrice(false);
    }
  };

  const addPackage = async () => {
    setError(null);
    const sessionCount = Number(addSessions);
    const packagePrice = Number(addPrice);
    if (!addName.trim() || !Number.isFinite(sessionCount) || sessionCount < 1
      || !Number.isFinite(packagePrice) || packagePrice < 0) {
      setError(t("pricing.addPackage"));
      return;
    }
    setAdding(true);
    try {
      const req: PackageReq = { name: addName.trim(), sessionCount, packagePrice };
      await psychologistApi.createMyPackage(req);
      await loadPackages();
      setAddName(""); setAddSessions(""); setAddPrice("");
      flashSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (p: PackageDto) => {
    setEditId(p.id);
    setEditName(p.name);
    setEditSessions(String(p.sessionCount));
    setEditPrice(String(p.packagePrice));
    setError(null);
  };

  const saveEdit = async (id: number) => {
    setError(null);
    const sessionCount = Number(editSessions);
    const packagePrice = Number(editPrice);
    if (!editName.trim() || !Number.isFinite(sessionCount) || sessionCount < 1
      || !Number.isFinite(packagePrice) || packagePrice < 0) {
      setError(t("pricing.packageName"));
      return;
    }
    setSavingEdit(true);
    try {
      const req: PackageReq = { name: editName.trim(), sessionCount, packagePrice };
      await psychologistApi.updateMyPackage(id, req);
      await loadPackages();
      setEditId(null);
      flashSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingEdit(false);
    }
  };

  const removePackage = async (id: number) => {
    if (!confirm(t("pricing.deleteConfirm"))) return;
    setError(null);
    try {
      await psychologistApi.deleteMyPackage(id);
      setPackages(prev => prev.filter(p => p.id !== id));
      flashSaved();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="uprof-card">
      <div className="uprof-card-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2>{t("pricing.sectionTitle")}</h2>
          <p>{editable ? t("pricing.individual") + " · " + t("pricing.packages") : t("pricing.managedByAdmin")}</p>
        </div>
        {savedFlash && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
            color: "var(--brand-700)", background: "var(--brand-50)", border: "1px solid var(--brand-200)",
          }}>
            <CheckIcon />{t("pricing.saved")}
          </span>
        )}
      </div>

      <div style={{ padding: 20, display: "grid", gap: 18 }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--oxford-60)", fontSize: 13 }}>Yüklənir…</div>
        ) : (
          <>
            {error && (
              <p style={{ margin: 0, fontSize: 12.5, color: "#b42318", background: "#fef3f2", border: "1px solid #fecdca", borderRadius: 8, padding: "8px 11px" }}>
                {error}
              </p>
            )}

            {/* Individual price */}
            <div>
              <label style={labelStyle}>{t("pricing.individualPrice")}</label>
              {editable ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    type="number" min={0} step="0.01" value={individualInput}
                    onChange={e => setIndividualInput(e.target.value)}
                    placeholder="0,00"
                    style={{ ...fieldStyle, maxWidth: 180 }}
                  />
                  <button onClick={saveIndividual} disabled={savingPrice || !priceDirty}
                    style={{
                      padding: "9px 16px", borderRadius: 8, border: "none",
                      background: priceDirty ? "var(--brand)" : "var(--oxford-10)",
                      color: priceDirty ? "#fff" : "var(--oxford-60)",
                      fontSize: 12.5, fontWeight: 700,
                      cursor: savingPrice || !priceDirty ? "default" : "pointer",
                      transition: "background 0.15s",
                    }}>
                    {savingPrice ? "…" : t("pricing.save")}
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--oxford)" }}>
                  {individualPrice != null ? formatAzn(individualPrice) : (
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--oxford-60)" }}>{t("pricing.noPrice")}</span>
                  )}
                </div>
              )}
            </div>

            {/* Packages */}
            <div>
              <div style={{ ...labelStyle, marginBottom: 10 }}>{t("pricing.packages")}</div>

              {packages.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: "var(--oxford-60)" }}>—</p>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {packages.map(p => (
                    editable && editId === p.id ? (
                      <div key={p.id} style={{ display: "grid", gap: 8, padding: 12, borderRadius: 10, border: "1px solid var(--brand-200)", background: "var(--brand-50)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 110px", gap: 8 }}>
                          <input value={editName} onChange={e => setEditName(e.target.value)} placeholder={t("pricing.packageName")} style={fieldStyle} />
                          <input type="number" min={1} step={1} value={editSessions} onChange={e => setEditSessions(e.target.value)} placeholder={t("pricing.sessionCount")} style={fieldStyle} />
                          <input type="number" min={0} step="0.01" value={editPrice} onChange={e => setEditPrice(e.target.value)} placeholder={t("pricing.packagePrice")} style={fieldStyle} />
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => saveEdit(p.id)} disabled={savingEdit}
                            style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--brand)", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: savingEdit ? "default" : "pointer" }}>
                            {savingEdit ? "…" : t("pricing.save")}
                          </button>
                          <button onClick={() => setEditId(null)}
                            style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--oxford-10)", background: "#fff", color: "var(--oxford-60)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div key={p.id} style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "11px 13px", borderRadius: 10,
                        border: "1px solid var(--oxford-10)", background: "#fff",
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--oxford)" }}>{p.name}</div>
                          <div style={{ fontSize: 11.5, color: "var(--oxford-60)", marginTop: 2 }}>
                            {p.sessionCount} {t("pricing.sessionCount").toLowerCase()} · {formatAzn(p.perSessionPrice)}{t("pricing.perSession")}
                          </div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--brand-700)", whiteSpace: "nowrap" }}>
                          {formatAzn(p.packagePrice)}
                        </div>
                        {editable && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => startEdit(p)} title={t("pricing.edit")}
                              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, border: "1px solid var(--oxford-10)", background: "#fff", color: "var(--oxford-60)", cursor: "pointer" }}>
                              <PencilIcon />
                            </button>
                            <button onClick={() => removePackage(p.id)} title={t("pricing.delete")}
                              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, border: "1px solid #fecdca", background: "#fff", color: "#b42318", cursor: "pointer" }}>
                              <TrashIcon />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  ))}
                </div>
              )}

              {/* Add package form */}
              {editable && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px dashed var(--oxford-10)", background: "var(--brand-50)" }}>
                  <div style={{ ...labelStyle, marginBottom: 8 }}>{t("pricing.addPackage")}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 110px auto", gap: 8, alignItems: "center" }}>
                    <input value={addName} onChange={e => setAddName(e.target.value)} placeholder={t("pricing.packageName")} style={fieldStyle} />
                    <input type="number" min={1} step={1} value={addSessions} onChange={e => setAddSessions(e.target.value)} placeholder={t("pricing.sessionCount")} style={fieldStyle} />
                    <input type="number" min={0} step="0.01" value={addPrice} onChange={e => setAddPrice(e.target.value)} placeholder={t("pricing.packagePrice")} style={fieldStyle} />
                    <button onClick={addPackage} disabled={adding}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, border: "none", background: "var(--brand)", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: adding ? "default" : "pointer", whiteSpace: "nowrap" }}>
                      <PlusIcon />{adding ? "…" : t("pricing.addPackage")}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!editable && (
              <p style={{
                display: "flex", alignItems: "center", gap: 7,
                fontSize: 11.5, color: "var(--oxford-60)", margin: 0, lineHeight: 1.6,
                padding: "10px 12px", background: "var(--brand-50)", borderRadius: 8, borderLeft: "3px solid var(--brand-200)",
              }}>
                <LockIcon />{t("pricing.managedByAdmin")}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Profil statistikası — statistika mənbəyi (Modul D) ────────────────────── */

type StatsSource = "FANUS_PLATFORM" | "PRIOR_EXPERIENCE";

function BoostIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M21 7v6h-6" />
    </svg>
  );
}

function StatsSourceCard({
  initialSource, fanusCount, priorCount, onSaved,
}: {
  initialSource: StatsSource;
  fanusCount: number;
  priorCount: number;
  onSaved: (p: Partial<Psychologist>) => void;
}) {
  const { t } = useT();

  const [selected, setSelected] = useState<StatsSource>(initialSource);
  const [savedSource, setSavedSource] = useState<StatsSource>(initialSource);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const flashSaved = () => {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2200);
  };

  const dirty = selected !== savedSource;

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const res = await psychologistApi.updateStatsSource(selected);
      const nextSource = res.statsSource ?? selected;
      setSelected(nextSource);
      setSavedSource(nextSource);
      onSaved({
        statsSource: res.statsSource,
        fanusSessionCount: res.fanusSessionCount,
        priorExperienceSessions: res.priorExperienceSessions,
        displayedSessionCount: res.displayedSessionCount,
      });
      flashSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const options: { value: StatsSource; label: string; count: number; boost: boolean }[] = [
    { value: "FANUS_PLATFORM", label: t("psyStats.fanusOption"), count: fanusCount, boost: true },
    { value: "PRIOR_EXPERIENCE", label: t("psyStats.priorOption"), count: priorCount, boost: false },
  ];

  return (
    <div className="uprof-card">
      <div className="uprof-card-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2>{t("psyStats.title")}</h2>
          <p>{t("psyStats.sessions")}</p>
        </div>
        {savedFlash && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
            color: "var(--brand-700)", background: "var(--brand-50)", border: "1px solid var(--brand-200)",
          }}>
            <CheckIcon />{t("psyStats.saved")}
          </span>
        )}
      </div>

      <div style={{ padding: 20, display: "grid", gap: 18 }}>
        {error && (
          <p style={{ margin: 0, fontSize: 12.5, color: "#b42318", background: "#fef3f2", border: "1px solid #fecdca", borderRadius: 8, padding: "8px 11px" }}>
            {error}
          </p>
        )}

        <div style={{ display: "grid", gap: 10 }}>
          {options.map(opt => {
            const active = selected === opt.value;
            return (
              <label key={opt.value}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "13px 14px", borderRadius: 10, cursor: "pointer",
                  border: active ? "1px solid var(--brand-200)" : "1px solid var(--oxford-10)",
                  background: active ? "var(--brand-50)" : "#fff",
                  transition: "background 0.15s, border-color 0.15s",
                }}>
                <input
                  type="radio"
                  name="stats-source"
                  value={opt.value}
                  checked={active}
                  onChange={() => setSelected(opt.value)}
                  style={{ marginTop: 3, accentColor: "var(--brand)", cursor: "pointer", flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--oxford)" }}>{opt.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "var(--brand-700)" }}>
                      {opt.count} {t("psyStats.sessions")}
                    </span>
                  </div>
                  {opt.boost && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6,
                      fontSize: 11.5, color: "var(--oxford-60)", lineHeight: 1.5,
                    }}>
                      <BoostIcon />{t("psyStats.boostNote")}
                    </span>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        <div>
          <button onClick={save} disabled={saving || !dirty}
            style={{
              padding: "9px 16px", borderRadius: 8, border: "none",
              background: dirty ? "var(--brand)" : "var(--oxford-10)",
              color: dirty ? "#fff" : "var(--oxford-60)",
              fontSize: 12.5, fontWeight: 700,
              cursor: saving || !dirty ? "default" : "pointer",
              transition: "background 0.15s",
            }}>
            {saving ? "…" : t("psyStats.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
