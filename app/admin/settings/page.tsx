"use client";

import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/lib/api";

type Tab = "notifications" | "payment" | "ai" | "integrations" | "team" | "branding";

const DEFAULTS: Record<string, string> = {
  // notifications
  "notif.email.newAppointment": "true",
  "notif.email.confirmation": "true",
  "notif.email.reminder": "true",
  "notif.email.weeklyReport": "false",
  "notif.sms.reminder": "true",
  "notif.sms.otp": "true",
  "notif.smtp.host": "smtp.fanus.az",
  // payment
  "payment.provider": "Azericard",
  "payment.basePrice": "80",
  "payment.currency": "AZN",
  "payment.commission": "15",
  "payment.refundPolicy": "24h-full",
  // ai routing
  "ai.routing.enabled": "true",
  "ai.routing.mode": "recommend",
  "ai.routing.confidence": "78",
  // branding
  "brand.siteTitle": "Fanus",
  "brand.tagline": "Mental sağlamlıq platforması",
};

type SettingsState = Record<string, string>;

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("notifications");
  const [data, setData] = useState<SettingsState>(DEFAULTS);
  const [original, setOriginal] = useState<SettingsState>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    adminApi
      .getSiteConfig()
      .then((cfg) => {
        const merged = { ...DEFAULTS, ...cfg };
        setData(merged);
        setOriginal(merged);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const isDirty = useMemo(() => Object.keys(data).some((k) => data[k] !== original[k]), [data, original]);

  const set = (key: string, value: string) => setData((d) => ({ ...d, [key]: value }));
  const toggle = (key: string) => set(key, data[key] === "true" ? "false" : "true");

  const save = async () => {
    setSaving(true);
    try {
      // only push changed keys
      const dirty: Record<string, string> = {};
      for (const k of Object.keys(data)) if (data[k] !== original[k]) dirty[k] = data[k];
      await adminApi.updateSiteConfig(dirty);
      setOriginal({ ...data });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => setData(original);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Sistem parametrləri</h1>
          <p className="page-sub">Bildiriş, ödəniş, AI yönləndirmə və inteqrasiya parametrlərini idarə edin.</p>
        </div>
        <div className="page-actions">
          {savedFlash && <span className="pill sage"><span className="dot" />Saxlandı</span>}
          <button className="btn" disabled={!isDirty} onClick={reset}>Geri qaytar</button>
          <button className="btn primary" disabled={!isDirty || saving} onClick={save}>
            {saving ? "Saxlanır…" : "Yadda saxla"}
          </button>
        </div>
      </div>

      <div className="tabs">
        {([
          { k: "notifications", l: "Bildirişlər" },
          { k: "payment", l: "Ödəniş" },
          { k: "ai", l: "AI yönləndirmə" },
          { k: "integrations", l: "İnteqrasiyalar" },
          { k: "team", l: "Komanda & rollar" },
          { k: "branding", l: "Brendinq" },
        ] as const).map((t) => (
          <button key={t.k} className={`tab${tab === t.k ? " active" : ""}`} onClick={() => setTab(t.k)}>
            {t.l}
          </button>
        ))}
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Yüklənir…</div>}

      {!loading && tab === "notifications" && (
        <>
          <div className="card">
            <div className="card-head">
              <div>
                <h3 className="card-title">E-mail bildirişləri</h3>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                  SMTP serveri: <span className="mono">{data["notif.smtp.host"]}</span>
                  <span className="pill sage" style={{ marginLeft: 6 }}><span className="dot" />operativ</span>
                </div>
              </div>
            </div>
            <div style={{ padding: "0 18px" }}>
              <SwitchRow
                title="Yeni randevu müraciəti"
                help="Admin və müvafiq psixoloqa göndərilir"
                value={data["notif.email.newAppointment"] === "true"}
                onChange={() => toggle("notif.email.newAppointment")}
              />
              <SwitchRow
                title="Randevu təsdiqi"
                help="Müştəriyə təsdiq e-maili göndərilir"
                value={data["notif.email.confirmation"] === "true"}
                onChange={() => toggle("notif.email.confirmation")}
              />
              <SwitchRow
                title="Sessiya öncəsi xatırlatma"
                help="Sessiyadan 24 saat və 1 saat əvvəl"
                value={data["notif.email.reminder"] === "true"}
                onChange={() => toggle("notif.email.reminder")}
              />
              <SwitchRow
                title="Həftəlik hesabat"
                help="Bazar günü göndərilir"
                value={data["notif.email.weeklyReport"] === "true"}
                onChange={() => toggle("notif.email.weeklyReport")}
              />
            </div>
          </div>

          <div className="card mt-16">
            <div className="card-head">
              <h3 className="card-title">SMS bildirişləri</h3>
            </div>
            <div style={{ padding: "0 18px" }}>
              <SwitchRow
                title="Sessiya xatırlatması (1 saat öncə)"
                help="SMS olaraq müştəriyə göndərilir"
                value={data["notif.sms.reminder"] === "true"}
                onChange={() => toggle("notif.sms.reminder")}
              />
              <SwitchRow
                title="OTP autentifikasiya"
                help="Login və şifrə yenilənməsi üçün"
                value={data["notif.sms.otp"] === "true"}
                onChange={() => toggle("notif.sms.otp")}
              />
            </div>
          </div>
        </>
      )}

      {!loading && tab === "payment" && (
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Ödəniş gateway-i</h3>
            <span className="pill sage"><span className="dot" />Test rejimindən kənar</span>
          </div>
          <div style={{ padding: "0 18px" }}>
            <Row title="Aktiv provayder" help="Hal-hazırda istifadə olunan ödəniş emalı">
              <select className="select" style={{ maxWidth: 280 }} value={data["payment.provider"]}
                onChange={(e) => set("payment.provider", e.target.value)}>
                <option>Azericard</option>
                <option>EPoint</option>
                <option>Stripe</option>
              </select>
            </Row>
            <Row title="Sessiya bazaqiyməti" help="Default — psixoloq özü dəyişə bilər">
              <div className="row" style={{ gap: 8 }}>
                <input className="input" value={data["payment.basePrice"]}
                  style={{ maxWidth: 120, textAlign: "right", fontFeatureSettings: "'tnum'" }}
                  onChange={(e) => set("payment.basePrice", e.target.value)} />
                <select className="select" style={{ maxWidth: 90 }} value={data["payment.currency"]}
                  onChange={(e) => set("payment.currency", e.target.value)}>
                  <option>AZN</option>
                  <option>USD</option>
                  <option>EUR</option>
                </select>
              </div>
            </Row>
            <Row title="Komissiya (platforma payı)" help="Hər tamamlanmış sessiyadan tutulur">
              <div className="row" style={{ gap: 8 }}>
                <input className="input" value={data["payment.commission"]}
                  style={{ maxWidth: 80, textAlign: "right", fontFeatureSettings: "'tnum'" }}
                  onChange={(e) => set("payment.commission", e.target.value)} />
                <span style={{ fontSize: 13, color: "var(--muted)" }}>%</span>
              </div>
            </Row>
            <Row title="Refund siyasəti" help="Sessiya başlamadan müəyyən saat öncə ləğv edilərsə">
              <select className="select" style={{ maxWidth: 320 }} value={data["payment.refundPolicy"]}
                onChange={(e) => set("payment.refundPolicy", e.target.value)}>
                <option value="24h-full">24 saat öncə — tam refund</option>
                <option value="12h-half">12 saat öncə — 50% refund</option>
                <option value="none">Refund yoxdur</option>
              </select>
            </Row>
          </div>
        </div>
      )}

      {!loading && tab === "ai" && (
        <div className="card">
          <div className="card-head">
            <div>
              <h3 className="card-title">AI yönləndirmə</h3>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>Yeni müraciətləri uyğun psixoloqa avtomatik təyin edir</div>
            </div>
            <span className={`pill ${data["ai.routing.enabled"] === "true" ? "sage" : "muted"}`}>
              <span className="dot" />{data["ai.routing.enabled"] === "true" ? "Aktiv" : "Söndürülmüş"}
            </span>
          </div>
          <div style={{ padding: "0 18px" }}>
            <SwitchRow
              title="AI yönləndirmə aktiv"
              help="Söndürdükdə bütün müraciətlər manual yönləndiriləcək"
              value={data["ai.routing.enabled"] === "true"}
              onChange={() => toggle("ai.routing.enabled")}
            />
            <Row title="İşləmə rejimi" help="Yönləndirməni necə tətbiq edək?">
              <select className="select" style={{ maxWidth: 340 }} value={data["ai.routing.mode"]}
                onChange={(e) => set("ai.routing.mode", e.target.value)}>
                <option value="recommend">Tövsiyə (admin təsdiqləyir)</option>
                <option value="auto">Tam avtomatik (yüksək etibarda)</option>
                <option value="off">Söndürülmüş</option>
              </select>
            </Row>
            <Row title="Etibar həddi" help="Bu səviyyədən aşağı tövsiyələr admin baxışına göndərilir">
              <div className="row" style={{ gap: 12 }}>
                <input type="range" min={50} max={95} value={data["ai.routing.confidence"]}
                  onChange={(e) => set("ai.routing.confidence", e.target.value)}
                  style={{ flex: 1, maxWidth: 240, accentColor: "var(--ox-800)" }} />
                <span className="strong" style={{ fontSize: 13, fontFeatureSettings: "'tnum'" }}>
                  {data["ai.routing.confidence"]}%
                </span>
              </div>
            </Row>
            <Row title="Nəzərə alınan amillər" help="Yönləndirmə alqoritmi bu siqnalları çəkir">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <span className="pill ox">İxtisas uyğunluğu · 35%</span>
                <span className="pill ox">Mövcudluq · 25%</span>
                <span className="pill ox">Reytinq · 15%</span>
                <span className="pill ox">Dil · 10%</span>
                <span className="pill ox">İş yükü · 10%</span>
                <span className="pill ox">Coğrafiya · 5%</span>
              </div>
            </Row>
          </div>
        </div>
      )}

      {!loading && tab === "integrations" && (
        <div className="card card-pad">
          <h3 className="card-title" style={{ marginBottom: 8 }}>İnteqrasiyalar</h3>
          <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>Əlavə inteqrasiyalar tezliklə əlavə olunacaq.</p>
          <IntegrationCard name="SendPulse" status="bağlı" desc="Email göndərmə üçün əsas provayder" />
          <IntegrationCard name="Gmail SMTP" status="bağlı" desc="Fallback email kanalı" />
          <IntegrationCard name="WhatsApp Business API" status="bağlı deyil" desc="Müştəri əlaqəsi üçün" />
          <IntegrationCard name="Google Analytics" status="bağlı deyil" desc="Trafik analitika" />
        </div>
      )}

      {!loading && tab === "team" && (
        <div className="card card-pad" style={{ textAlign: "center", color: "var(--muted)", padding: 60 }}>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Komanda & rollar</div>
          <div style={{ fontSize: 12 }}>Operator hesablarını idarə etmək üçün admin API endpoint-i mövcuddur.</div>
        </div>
      )}

      {!loading && tab === "branding" && (
        <div className="card">
          <div className="card-head"><h3 className="card-title">Brendinq</h3></div>
          <div style={{ padding: "0 18px" }}>
            <Row title="Sayt başlığı" help="Tab-da və axtarış nəticələrində görünür">
              <input className="input" value={data["brand.siteTitle"]}
                onChange={(e) => set("brand.siteTitle", e.target.value)} style={{ maxWidth: 320 }} />
            </Row>
            <Row title="Tagline" help="Ana səhifə başlıq altında görünür">
              <input className="input" value={data["brand.tagline"]}
                onChange={(e) => set("brand.tagline", e.target.value)} style={{ maxWidth: 480 }} />
            </Row>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ title, help, children }: { title: string; help: string; children: React.ReactNode }) {
  return (
    <div className="form-row">
      <div>
        <div className="form-label">{title}</div>
        <div className="form-help">{help}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function SwitchRow({ title, help, value, onChange }: { title: string; help: string; value: boolean; onChange: () => void }) {
  return (
    <div className="form-row">
      <div>
        <div className="form-label">{title}</div>
        <div className="form-help">{help}</div>
      </div>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{value ? "Aktiv" : "Söndürülmüş"}</span>
        <button className={`switch${value ? " on" : ""}`} onClick={onChange} />
      </div>
    </div>
  );
}

function IntegrationCard({ name, status, desc }: { name: string; status: string; desc: string }) {
  const connected = status === "bağlı";
  return (
    <div className="row" style={{ padding: "12px 0", borderBottom: "1px solid var(--line)", justifyContent: "space-between" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{name}</div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>{desc}</div>
      </div>
      <div className="row">
        <span className={`pill ${connected ? "sage" : "muted"}`}><span className="dot" />{status}</span>
        <button className="btn sm">{connected ? "Tənzimlə" : "Bağla"}</button>
      </div>
    </div>
  );
}
