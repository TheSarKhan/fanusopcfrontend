"use client";

// Admin · Operatorlar modulu — Fanus UI Kit.
//  • Operator = OPERATOR rollu User. Cədvəl: server pagination + filtr (status/axtarış) + sort.
//  • KPI: ümumi/aktiv/deaktiv + aqreqat aktivlik (təyin, müştəri, paket, konvert, cavab, SLA).
//  • «Yeni operator» → email/ad/telefon (giriş məlumatları operatora email ilə gedir).
//  • Sətir → ətraflı Drawer: statistika + əməliyyatlar (aktiv/deaktiv, şifrə reset,
//    doğrulama emaili, email dəyiş, sessiyaları bağla, sil).

import { useCallback, useEffect, useState } from "react";
import {
  adminApi,
  type OperatorOverview,
  type PagedOperators,
} from "@/lib/api";
import { toast } from "@/components/Toast";
import { azFormatDate, azFormatDateTime } from "@/lib/datetime";
import PanelIcon from "@/components/PanelIcon";
import {
  PageHead,
  SectionTitle,
  Stats,
  Stat,
  Card,
  CardPad,
  DataTable,
  Status,
  Avatar,
  Switch,
  Button,
  IconButton,
  Drawer,
  DrawerSection,
  Modal,
  Field,
  FieldRow,
  Input,
  SearchInput,
  Segmented,
  type Column,
} from "@/components/ui";

type StatusFilter = "all" | "active" | "inactive";
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Hamısı" },
  { key: "active", label: "Aktiv" },
  { key: "inactive", label: "Deaktiv" },
];
const PAGE_SIZE_OPTIONS = [10, 20, 50];

function fmtDate(s?: string | null) { return s ? azFormatDate(s) : "—"; }
function fmtDateTime(s?: string | null) { return s ? azFormatDateTime(s) : "—"; }
function fmtMinutes(m: number | null) { return m == null ? "—" : `${m} dəq`; }

function useDebounce<T>(value: T, delay: number): T {
  const [v, setV] = useState<T>(value);
  useEffect(() => { const id = setTimeout(() => setV(value), delay); return () => clearTimeout(id); }, [value, delay]);
  return v;
}

export default function OperatorsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [data, setData] = useState<PagedOperators | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const dq = useDebounce(search, 300);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [sort, setSort] = useState("name");
  const [dir, setDir] = useState<"asc" | "desc">("asc");

  const [sel, setSel] = useState<OperatorOverview | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    adminApi.getOperatorsPaged({
      q: dq || undefined, status: status === "all" ? undefined : status,
      page, size, sort, dir,
    }).then((res) => { setData(res); if (res.totalPages > 0 && page >= res.totalPages) setPage(0); })
      .catch((e) => setError((e as Error).message || "Operatorlar yüklənmədi"))
      .finally(() => setLoading(false));
  }, [dq, status, page, size, sort, dir]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [dq, status]);

  const toggleActive = async (o: OperatorOverview) => {
    try {
      const updated = await adminApi.toggleUserActive(o.userId);
      setData((prev) => prev ? { ...prev, content: prev.content.map((x) => x.userId === o.userId ? { ...x, active: updated.active } : x) } : prev);
      setSel((prev) => (prev && prev.userId === o.userId ? { ...prev, active: updated.active } : prev));
      toast(updated.active ? "Operator aktivləşdirildi" : "Operator deaktiv edildi", "success");
    } catch (e) { toast((e as Error).message, "error"); }
  };

  const columns: Column<OperatorOverview>[] = [
    {
      key: "name", header: "Operator", sortable: true,
      cell: (o) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Avatar name={o.name} size="sm" />
          <div style={{ minWidth: 0 }}>
            <div className="fx-row__title">{o.name}</div>
            <div className="fx-subtitle">{o.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "active", header: "Status",
      cell: (o) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }} onClick={(e) => e.stopPropagation()}>
          <Switch checked={o.active} onChange={() => toggleActive(o)} aria-label={o.active ? "Deaktiv et" : "Aktivləşdir"} />
          <Status tone={o.active ? "positive" : "muted"}>{o.active ? "Aktiv" : "Deaktiv"}</Status>
        </span>
      ),
    },
    { key: "assigned30", header: "Təyin (30g)", sortable: true, numeric: true, hideOnMobile: true, cell: (o) => o.assigned30 },
    { key: "customersCreated", header: "Müştəri", sortable: true, numeric: true, hideOnMobile: true, cell: (o) => o.customersCreated },
    { key: "packagesSold", header: "Paket", sortable: true, numeric: true, hideOnMobile: true, cell: (o) => o.packagesSold },
    { key: "sessionRequestsConverted", header: "Konvert", sortable: true, numeric: true, hideOnMobile: true, cell: (o) => o.sessionRequestsConverted },
    { key: "avgResponseMinutes", header: "Orta cavab", sortable: true, hideOnMobile: true, cell: (o) => fmtMinutes(o.avgResponseMinutes) },
    { key: "slaViolations30", header: "SLA", sortable: true, numeric: true, hideOnMobile: true, cell: (o) => o.slaViolations30 > 0 ? <Status tone="risk">{o.slaViolations30}</Status> : o.slaViolations30 },
    { key: "lastLogin", header: "Son giriş", sortable: true, hideOnMobile: true, cell: (o) => fmtDate(o.lastLogin) },
  ];

  if (!mounted) return null;
  const kpi = data?.kpi;

  return (
    <div className="page" suppressHydrationWarning>
      <PageHead
        title="Operatorlar"
        sub="Operator hesablarının idarəsi, fəaliyyəti və statistikası."
        actions={
          <Button variant="primary" onClick={() => setNewOpen(true)} icon={<PanelIcon name="plus" size={16} />}>Yeni operator</Button>
        }
      />

      <Stats style={{ marginBottom: 16 }}>
        <Stat value={kpi?.total ?? "—"} label="Ümumi operator" />
        <Stat value={kpi?.active ?? "—"} label="Aktiv" />
        <Stat value={kpi?.inactive ?? "—"} label="Deaktiv" />
        <Stat value={kpi?.assigned30 ?? "—"} label="Təyin (30 gün)" />
        <Stat value={kpi?.customersCreated ?? "—"} label="Yaradılan müştəri" />
        <Stat value={kpi?.packagesSold ?? "—"} label="Satılan paket" />
        <Stat value={kpi?.sessionRequestsConverted ?? "—"} label="Konvert müraciət" />
        <Stat value={kpi ? fmtMinutes(kpi.avgResponseMinutes) : "—"} label="Orta cavab" />
        <Stat value={kpi?.slaViolations30 ?? "—"} label="SLA pozuntusu" />
      </Stats>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", flexWrap: "wrap", borderBottom: "1px solid var(--hairline)" }}>
          <div style={{ flex: 1, minWidth: 220, maxWidth: 340 }}>
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ad və ya email üzrə axtar" aria-label="Axtar" autoComplete="off" />
          </div>
          <Segmented items={STATUS_FILTERS} value={status} onChange={setStatus} />
        </div>
        <CardPad>
          <DataTable
            rows={data?.content ?? []}
            columns={columns}
            rowKey={(o) => o.userId}
            loading={loading}
            error={error}
            onRetry={load}
            onRowClick={(o) => setSel(o)}
            empty={{ title: "Operator tapılmadı", body: "Seçilmiş filtrlərə uyğun operator yoxdur.", actions: <Button variant="primary" size="sm" onClick={() => setNewOpen(true)}>Yeni operator</Button> }}
            sort={{ key: sort, dir }}
            onSortChange={(s) => { setSort(s.key); setDir(s.dir); setPage(0); }}
            actions={(o) => <IconButton aria-label="Kartı aç" onClick={() => setSel(o)}><PanelIcon name="chevron" size={16} /></IconButton>}
            pagination={{
              page: page + 1, pageCount: Math.max(1, data?.totalPages ?? 1),
              onChange: (p) => setPage(p - 1), pageSize: size,
              onPageSizeChange: (s) => { setSize(s); setPage(0); }, pageSizeOptions: PAGE_SIZE_OPTIONS,
            }}
            totalLabel={data && data.totalElements > 0
              ? `Göstərilir: ${data.page * data.size + 1}–${Math.min((data.page + 1) * data.size, data.totalElements)} / ${data.totalElements}`
              : undefined}
          />
        </CardPad>
      </Card>

      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.name ?? ""}>
        {sel && <OperatorDrawer key={sel.userId} op={sel} onToggleActive={toggleActive} onChanged={load} onDeleted={() => { setSel(null); load(); }} />}
      </Drawer>

      {newOpen && <NewOperatorModal onClose={() => setNewOpen(false)} onCreated={() => { setNewOpen(false); load(); }} />}
    </div>
  );
}

// ── Ətraflı Drawer: statistika + əməliyyatlar ────────────────────
function OperatorDrawer({ op, onToggleActive, onChanged, onDeleted }: {
  op: OperatorOverview;
  onToggleActive: (o: OperatorOverview) => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "reset" | "verify" | "terminate" | "delete">(null);
  const [emailModal, setEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  const run = async (kind: string, fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(kind);
    try { await fn(); toast(okMsg, "success"); return true; }
    catch (e) { toast((e as Error).message, "error"); return false; }
    finally { setBusy(null); }
  };
  const emailOk = /\S+@\S+\.\S+/.test(newEmail.trim());

  return (
    <>
      <DrawerSection>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={op.name} size="lg" />
          <div style={{ minWidth: 0 }}>
            <Status tone={op.active ? "positive" : "muted"}>{op.active ? "Aktiv" : "Deaktiv"}</Status>
            <div className="fx-subtitle" style={{ marginTop: 4 }}>{op.email}</div>
            {op.phone && <div className="fx-subtitle">{op.phone}</div>}
          </div>
        </div>
      </DrawerSection>

      {/* Statistika */}
      <DrawerSection>
        <SectionTitle>Statistika</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <InfoRow label="Təyin edilən (bu gün)" value={op.assignedToday} />
          <InfoRow label="Təyin edilən (7 gün)" value={op.assignedWeek} />
          <InfoRow label="Təyin edilən (30 gün)" value={op.assigned30} />
          <InfoRow label="Orta cavab vaxtı" value={fmtMinutes(op.avgResponseMinutes)} />
          <InfoRow label="SLA pozuntusu (30 gün)" value={op.slaViolations30} />
          <InfoRow label="Yaradılan müştəri" value={op.customersCreated} />
          <InfoRow label="Satılan paket" value={op.packagesSold} />
          <InfoRow label="Konvert müraciət" value={op.sessionRequestsConverted} />
          <InfoRow label="Son giriş" value={fmtDateTime(op.lastLogin)} />
          <InfoRow label="Qeydiyyat" value={fmtDateTime(op.createdAt)} />
        </div>
      </DrawerSection>

      {/* Əməliyyatlar */}
      <DrawerSection>
        <SectionTitle>Əməliyyatlar</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <ActionRow
            title={op.active ? "Hesabı deaktiv et" : "Hesabı aktivləşdir"}
            desc={op.active ? "Operator sistemə girə bilməyəcək." : "Operatorun girişi bərpa olunur."}
            button={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Status tone={op.active ? "positive" : "muted"}>{op.active ? "Aktiv" : "Deaktiv"}</Status>
                <Switch checked={op.active} onChange={() => onToggleActive(op)} aria-label="Hesab statusu" />
              </span>
            }
          />
          <ActionRow title="Şifrə sıfırlama linki göndər" desc="Operatorun emailinə reset linki gedir." button={<Button variant="ghost" size="sm" disabled={busy === "reset"} onClick={() => setConfirm("reset")}>Göndər</Button>} />
          <ActionRow title="Doğrulama emailini göndər" desc="Təsdiq linkini yenidən göndərir." button={<Button variant="ghost" size="sm" disabled={busy === "verify"} onClick={() => setConfirm("verify")}>Göndər</Button>} />
          <ActionRow title="Email ünvanını dəyiş" desc="Yeni email təyin edir." button={<Button variant="ghost" size="sm" onClick={() => { setNewEmail(""); setEmailModal(true); }}>Dəyiş</Button>} />
          <ActionRow title="Aktiv sessiyaları bağla" desc="Bütün cihazlarda çıxış edilir." button={<Button variant="ghost" size="sm" disabled={busy === "terminate"} onClick={() => setConfirm("terminate")}>Bağla</Button>} />
          <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 12, marginTop: 4 }}>
            <ActionRow title="Operatoru sil" desc="Bu əməliyyat geri qaytarıla bilməz." button={<Button variant="dangerGhost" size="sm" disabled={busy === "delete"} onClick={() => setConfirm("delete")}>Sil</Button>} />
          </div>
        </div>
      </DrawerSection>

      <Modal open={confirm === "reset"} onClose={() => setConfirm(null)} title="Şifrə sıfırlama linki" text={`${op.email} ünvanına reset linki göndəriləcək.`} icon={<PanelIcon name="lock" size={20} />}
        actions={<><Button variant="ghost" onClick={() => setConfirm(null)}>Ləğv et</Button><Button variant="primary" disabled={busy === "reset"} onClick={async () => { if (await run("reset", () => adminApi.sendPasswordReset(op.userId), "Reset linki göndərildi")) setConfirm(null); }}>{busy === "reset" ? "Göndərilir…" : "Göndər"}</Button></>} />
      <Modal open={confirm === "verify"} onClose={() => setConfirm(null)} title="Doğrulama emaili" text={`${op.email} ünvanına təsdiq linki göndəriləcək.`} icon={<PanelIcon name="message" size={20} />}
        actions={<><Button variant="ghost" onClick={() => setConfirm(null)}>Ləğv et</Button><Button variant="primary" disabled={busy === "verify"} onClick={async () => { if (await run("verify", () => adminApi.resendVerification(op.userId), "Doğrulama emaili göndərildi")) setConfirm(null); }}>{busy === "verify" ? "Göndərilir…" : "Göndər"}</Button></>} />
      <Modal open={confirm === "terminate"} onClose={() => setConfirm(null)} title="Sessiyaları bağla" text="Operator bütün cihazlarda sistemdən çıxarılacaq." icon={<PanelIcon name="logout" size={20} />}
        actions={<><Button variant="ghost" onClick={() => setConfirm(null)}>Ləğv et</Button><Button variant="primary" disabled={busy === "terminate"} onClick={async () => { if (await run("terminate", () => adminApi.terminateUserSessions(op.userId), "Sessiyalar bağlandı")) setConfirm(null); }}>{busy === "terminate" ? "Bağlanır…" : "Bağla"}</Button></>} />
      <Modal open={confirm === "delete"} onClose={() => setConfirm(null)} title="Operatoru sil" text={`«${op.email}» hesabı birdəfəlik silinəcək. Geri qaytarıla bilməz.`} icon={<PanelIcon name="x" size={20} />} iconTone="rose"
        actions={<><Button variant="ghost" onClick={() => setConfirm(null)}>Ləğv et</Button><Button variant="danger" disabled={busy === "delete"} onClick={async () => { if (await run("delete", () => adminApi.deleteUser(op.userId), "Operator silindi")) { setConfirm(null); onDeleted(); } }}>{busy === "delete" ? "Silinir…" : "Birdəfəlik sil"}</Button></>} />

      <Modal open={emailModal} onClose={() => setEmailModal(false)} title="Email ünvanını dəyiş" text={`Cari: ${op.email}`} icon={<PanelIcon name="message" size={20} />}
        actions={<><Button variant="ghost" onClick={() => setEmailModal(false)}>Ləğv et</Button><Button variant="primary" disabled={!emailOk || busy === "email"} onClick={async () => { if (await run("email", () => adminApi.changeUserEmail(op.userId, newEmail.trim()), "Email dəyişdirildi")) { setEmailModal(false); onChanged(); } }}>{busy === "email" ? "Saxlanır…" : "Dəyiş"}</Button></>}>
        <Field label="Yeni email"><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="ad.soyad@mail.az" autoComplete="off" autoFocus /></Field>
      </Modal>
    </>
  );
}

function NewOperatorModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const emailOk = /\S+@\S+\.\S+/.test(email.trim());

  const submit = async () => {
    if (!emailOk || !firstName.trim() || !lastName.trim()) { toast("Email, ad və soyad məcburidir", "error"); return; }
    setBusy(true);
    try {
      await adminApi.createOperator({ email: email.trim(), firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() || undefined });
      toast("Operator yaradıldı — giriş məlumatları email ilə göndərildi", "success");
      onCreated();
    } catch (e) { toast((e as Error).message, "error"); setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title="Yeni operator" text="Giriş məlumatları (müvəqqəti şifrə) operatorun emailinə göndərilir." icon={<PanelIcon name="headset" size={20} />}
      actions={<><Button variant="ghost" onClick={onClose}>Ləğv</Button><Button variant="primary" disabled={!emailOk || busy} onClick={submit}>{busy ? "Yaradılır…" : "Yarat və dəvət göndər"}</Button></>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Email" required><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ad.soyad@mail.az" autoComplete="off" autoFocus /></Field>
        <FieldRow>
          <Field label="Ad" required><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></Field>
          <Field label="Soyad" required><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></Field>
        </FieldRow>
        <Field label="Telefon"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+994 __ ___ __ __" /></Field>
      </div>
    </Modal>
  );
}

function ActionRow({ title, desc, button }: { title: string; desc: string; button: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <div className="fx-subtitle">{desc}</div>
      </div>
      <div style={{ flexShrink: 0 }}>{button}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="fx-label">{label}</div>
      <div style={{ overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}
