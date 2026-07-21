"use client";

/**
 * FANUS PANEL UI KIT — canlı istinad səhifəsi
 *
 * Bu səhifə dizayn sisteminin yeganə canlı sənədidir. Yeni komponent
 * əlavə edəndə buraya da nümunə yazın. Panel yazarkən buradakı
 * komponentlərdən kənara çıxmayın.
 */

import { useState } from "react";
import {
  Avatar,
  Banner,
  Button,
  Card,
  CardBody,
  CardHead,
  Checkbox,
  DataTable,
  type Column,
  Drawer,
  DrawerSection,
  EmptyBlock,
  Field,
  FieldRow,
  Input,
  Menu,
  MenuDivider,
  MenuItem,
  Modal,
  PageHead,
  PaymentStatus,
  Progress,
  Radio,
  Row,
  SearchInput,
  SectionTitle,
  Segmented,
  Select,
  Stat,
  Stats,
  Status,
  Stepper,
  Switch,
  TableSkeleton,
  Tabs,
  TextButton,
  Textarea,
  ToggleChip,
  Trend,
} from "@/components/ui";

/* ---------- İkonlar (inline SVG — emoji QADAĞANDIR) ---------- */
const ico = {
  stroke: "currentColor" as const,
  fill: "none" as const,
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  className: "fx-icon",
  "aria-hidden": true,
};
const IconPlus = () => (
  <svg {...ico}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IconDownload = () => (
  <svg {...ico}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 10 5 5 5-5M12 15V3" />
  </svg>
);
const IconTrash = () => (
  <svg {...ico}>
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
);
const IconEdit = () => (
  <svg {...ico}>
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const IconAlert = () => (
  <svg {...ico} className="fx-icon fx-icon--lg">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16.5v.01" />
  </svg>
);

/* ---------- Səhifə bölməsi sarğısı ---------- */
function Spec({
  name,
  rule,
  children,
}: {
  name: string;
  /** Bu komponentin pozulmaz qaydası. */
  rule?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 40 }}>
      <SectionTitle>{name}</SectionTitle>
      {rule ? (
        <p className="fx-help" style={{ margin: "-6px 0 12px", maxWidth: "68ch" }}>
          {rule}
        </p>
      ) : null}
      <Card>
        <CardBody style={{ paddingTop: 18 }}>{children}</CardBody>
      </Card>
    </section>
  );
}

const TAB_ITEMS = [
  { key: "pending", label: "Gözləyir", count: 7 },
  { key: "paid", label: "Ödənilmiş", count: 64 },
  { key: "refunded", label: "Geri qaytarılmış", count: 3 },
  { key: "cancelled", label: "Ləğv edilmiş", count: 10 },
] as const;

const RANGE_ITEMS = [
  { key: "day", label: "Gün" },
  { key: "week", label: "Həftə" },
  { key: "month", label: "Ay" },
] as const;

type Payment = {
  name: string;
  meta: string;
  status: string;
  amount: string;
  amountValue: number;
  psych: string;
  date: string;
  commission: string;
  net: string;
};

const PAYMENTS: Payment[] = [
  {
    name: "Leyla Nəbiyeva",
    meta: "Kart ilə ödənilib, 18.07.2026 — Dr. Rəşad Əliyev",
    status: "PAID",
    amount: "120 AZN", amountValue: 120,
    psych: "Dr. Rəşad Əliyev", date: "18.07.2026",
    commission: "24 AZN", net: "96 AZN",
  },
  {
    name: "Orxan Məmmədov",
    meta: "Köçürmə gözləyir, 17.07.2026 — 4 seanslıq paket",
    status: "PENDING",
    amount: "440 AZN", amountValue: 440,
    psych: "Dr. Aygün Quliyeva", date: "17.07.2026",
    commission: "88 AZN", net: "352 AZN",
  },
  {
    name: "Günel Həsənova",
    meta: "Nağd ödənilib, 17.07.2026 — Dr. Aygün Quliyeva",
    status: "PAID",
    amount: "100 AZN", amountValue: 100,
    psych: "Dr. Aygün Quliyeva", date: "17.07.2026",
    commission: "20 AZN", net: "80 AZN",
  },
  {
    name: "Kamran Səfərov",
    meta: "Seans ləğv edildiyi üçün geri qaytarılıb, 15.07.2026",
    status: "REFUNDED",
    amount: "90 AZN", amountValue: 90,
    psych: "Dr. Rəşad Əliyev", date: "15.07.2026",
    commission: "0 AZN", net: "0 AZN",
  },
];

/**
 * Sütun təsviri — səhifənin cədvəl üçün yazdığı YEGANƏ şeydir.
 * `cell` istənilən komponenti qaytara bilər: avatar, <Status>, link, düymə.
 */
const PAYMENT_COLUMNS: Column<Payment>[] = [
  {
    key: "name",
    header: "Pasiyent",
    sortable: true,
    sortValue: (p) => p.name,
    cell: (p) => (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name={p.name} size="sm" />
        <span style={{ fontWeight: 600 }}>{p.name}</span>
      </div>
    ),
  },
  { key: "psych", header: "Psixoloq", cell: (p) => p.psych, hideOnMobile: true },
  { key: "date", header: "Tarix", sortable: true, sortValue: (p) => p.date, cell: (p) => p.date },
  { key: "status", header: "Vəziyyət", cell: (p) => <PaymentStatus value={p.status} /> },
  {
    key: "amount",
    header: "Məbləğ",
    numeric: true,
    sortable: true,
    sortValue: (p) => p.amountValue,
    cell: (p) => p.amount,
  },
];

export default function PanelUIKitPage() {
  const [tab, setTab] = useState<(typeof TAB_ITEMS)[number]["key"]>("pending");
  const [range, setRange] = useState<(typeof RANGE_ITEMS)[number]["key"]>("week");
  const [mine, setMine] = useState(true);
  const [page, setPage] = useState(2);
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="fx-body">
      <div className="fx-page" style={{ maxWidth: 1080, margin: "0 auto" }}>
        <PageHead
          title="Panel UI Kit"
          sub="Bütün panellərin istifadə etdiyi vahid komponent dəsti. Yeni ekran yazarkən yalnız buradakı komponentlərdən istifadə edin."
          actions={
            <>
              <Button variant="ghost" icon={<IconDownload />}>
                Export
              </Button>
              <Button variant="primary" icon={<IconPlus />}>
                Yeni ödəniş
              </Button>
            </>
          }
        />

        <Banner tone="info" title="Bu səhifə sənəddir">
          Komponentin görünüşünü dəyişmək lazımdırsa CSS-i səhifədə deyil,
          fanus-ui-kit/components.css faylında dəyişin — dəyişiklik bütün panellərə keçir.
        </Banner>

        <div style={{ height: 32 }} />

        {/* ---------------- Statistika ---------------- */}
        <Spec
          name="Statistika"
          rule="Rəqəm rozet içinə salınmır. Dəyər + etiket + bir cümləlik kontekst. Trend oxu yalnız real müqayisə olanda."
        >
          <Stats style={{ marginBottom: 0 }}>
            <Stat
              value="350"
              unit="AZN"
              label="Bu gün yığılan"
              meta={
                <>
                  <Trend direction="up">12%</Trend> dünənlə müqayisədə
                </>
              }
            />
            <Stat value="1 240" unit="AZN" label="Gözləyən" meta="7 ödəniş, 2-si 48 saatdan çox gözləyir" />
            <Stat value="418" unit="AZN" label="Platforma payı" meta="20% komissiya dərəcəsi ilə" />
          </Stats>
        </Spec>

        {/* ---------------- Düymələr ---------------- */}
        <Spec name="Düymələr" rule="Bir səhifədə yalnız bir primary düymə. Sətir içində sm ölçü. Destruktiv əməliyyat rose.">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            <Button variant="primary" icon={<IconPlus />}>
              Yeni ödəniş
            </Button>
            <Button variant="ghost">Export</Button>
            <Button variant="quiet">Ləğv et</Button>
            <Button variant="warnGhost">WhatsApp ilə xatırlat</Button>
            <Button variant="dangerGhost" icon={<IconTrash />}>
              İadə et
            </Button>
            <Button variant="danger">Geri qaytar</Button>
            <Button variant="ghost" disabled>
              Deaktiv
            </Button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <Button variant="ghost" size="sm">
              Zəng
            </Button>
            <Button variant="ghost" size="sm" icon={<IconEdit />}>
              Düzəliş
            </Button>
            <TextButton>Hamısına bax</TextButton>
          </div>
        </Spec>

        {/* ---------------- Status ---------------- */}
        <Spec
          name="Status"
          rule="Rəngli rozet (badge/pill) və rəngli nöqtə QADAĞANDIR. Status sadə mətndir; rəng yalnız diqqət və risk hallarında."
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
            <Status>Ödənilib</Status>
            <Status tone="wait">Gözləyir</Status>
            <Status tone="risk">Geri qaytarılıb</Status>
            <Status tone="muted">Ləğv edilib</Status>
            <Status tone="positive">Balans müsbətdir</Status>
          </div>
          <p className="fx-help" style={{ marginTop: 12 }}>
            Psixoloji test nəticələrini heç vaxt "yaxşı / pis" kimi rəngləməyin — nəticə neytral göstərilir.
          </p>
        </Spec>

        {/* ---------------- Tablar ---------------- */}
        <Spec name="Tablar və filtrlər">
          <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} />
          <div className="fx-toolbar" style={{ marginTop: 16, marginBottom: 0 }}>
            <SearchInput placeholder="Ad və ya telefon üzrə axtar" style={{ minWidth: 220, flex: 1 }} />
            <Segmented items={RANGE_ITEMS} value={range} onChange={setRange} />
            <ToggleChip active={mine} onClick={() => setMine((v) => !v)}>
              Yalnız mənim
            </ToggleChip>
          </div>
        </Spec>

        {/* ---------------- Siyahı sətri ---------------- */}
        <Spec
          name="Siyahı sətri"
          rule="Meta sətri tam cümlədir. `·` ayırıcısı işlədilmir — ya tam cümlə, ya ayrı sətirlər."
        >
          {PAYMENTS.map((p) => (
            <Row
              key={p.name}
              lead={<Avatar name={p.name} />}
              title={p.name}
              meta={p.meta}
              status={<PaymentStatus value={p.status} />}
              amount={p.amount}
              onClick={() => setDrawer(true)}
            />
          ))}
        </Spec>

        {/* ---------------- DataTable ---------------- */}
        <Spec
          name="Cədvəl — DataTable"
          rule="Platformadakı BÜTÜN cədvəllər budur. Səhifədə əl ilə <table> yazmaq qadağandır. Sıralama, səhifələmə, skeleton, boş və xəta vəziyyəti komponentin içindədir; səhifə yalnız sütunları təsvir edir."
        >
          <DataTable
            rows={PAYMENTS}
            columns={PAYMENT_COLUMNS}
            rowKey={(p) => p.name}
            onRowClick={() => setDrawer(true)}
            defaultSort={{ key: "name", dir: "asc" }}
            actions={(p) => (
              <>
                <Button variant="ghost" size="sm" onClick={() => setDrawer(true)}>Bax</Button>
                <Button variant="dangerGhost" size="sm" onClick={() => setModal(true)} disabled={p.status !== "PAID"}>
                  İadə
                </Button>
              </>
            )}
            renderExpanded={(p) => (
              <div className="fx-subtitle">
                Komissiya bölgüsü: platforma payı {p.commission}, psixoloqun xalis payı {p.net}.
              </div>
            )}
            pagination={{ page, pageCount: 9, onChange: setPage }}
            totalLabel={`${PAYMENTS.length} əməliyyat göstərilir`}
          />
          <p className="fx-help" style={{ marginTop: 14 }}>
            Başlığa klikləyin — sıralama işləyir. Soldakı oxla sətir açılır. Əməliyyat düymələri sətir klikini tetikləmir.
          </p>
        </Spec>

        {/* ---------------- DataTable vəziyyətləri ---------------- */}
        <Spec name="Cədvəlin vəziyyətləri" rule="Üçü də komponentin içindədir — səhifədə ayrıca yazılmır.">
          <div className="fx-stack">
            <div>
              <p className="fx-label" style={{ marginBottom: 8 }}>Yüklənir</p>
              <DataTable rows={[]} columns={PAYMENT_COLUMNS} rowKey={(p) => p.name} loading skeletonRows={3} />
            </div>
            <div>
              <p className="fx-label" style={{ marginBottom: 8 }}>Boş</p>
              <DataTable
                rows={[]}
                columns={PAYMENT_COLUMNS}
                rowKey={(p) => p.name}
                empty={{
                  title: "Bu filtrdə ödəniş yoxdur",
                  body: "Seçilmiş tarix aralığında gözləyən ödəniş qeydə alınmayıb. Tarix aralığını genişləndirin.",
                  actions: <Button variant="ghost" size="sm">Filtri sıfırla</Button>,
                }}
              />
            </div>
            <div>
              <p className="fx-label" style={{ marginBottom: 8 }}>Xəta</p>
              <DataTable
                rows={[]}
                columns={PAYMENT_COLUMNS}
                rowKey={(p) => p.name}
                error="Bank cavab vermədi."
                onRetry={() => undefined}
              />
            </div>
          </div>
        </Spec>

        {/* ---------------- Dar ekran ---------------- */}
        <Spec
          name="Cədvəl dar ekranda"
          rule='Standart davranış üfüqi sürüşdürməkdir. mobile="cards" verildikdə 860px-dən dar ekranda sətirlər karta çevrilir və sütun başlığı etiketə keçir.'
        >
          <DataTable
            rows={PAYMENTS.slice(0, 2)}
            columns={PAYMENT_COLUMNS}
            rowKey={(p) => p.name}
            mobile="cards"
            actions={() => <Button variant="ghost" size="sm">Bax</Button>}
          />
          <p className="fx-help" style={{ marginTop: 12 }}>
            Pəncərəni daraldın — bu cədvəl kartlara çevrilir, yuxarıdakı isə sürüşür.
          </p>
        </Spec>

        {/* ---------------- Formalar ---------------- */}
        <Spec name="Formalar" rule="Etiket cümlə formasında. Xəta mətni sahənin altında; ümumi əməliyyat xətası isə toast-a gedir.">
          <FieldRow>
            <Field label="Ad və soyad" required htmlFor="uk-name">
              <Input id="uk-name" defaultValue="Leyla Nəbiyeva" />
            </Field>
            <Field label="Telefon" htmlFor="uk-phone" help="Nömrəni +994 ilə yazın.">
              <Input id="uk-phone" placeholder="+994 50 123 45 67" />
            </Field>
          </FieldRow>
          <div style={{ height: 14 }} />
          <FieldRow>
            <Field label="Ödəniş üsulu" htmlFor="uk-method">
              <Select id="uk-method" defaultValue="card">
                <option value="card">Kart</option>
                <option value="transfer">Bank köçürməsi</option>
                <option value="cash">Nağd</option>
              </Select>
            </Field>
            <Field label="Məbləğ" htmlFor="uk-amount" error="Məbləğ 0-dan böyük olmalıdır.">
              <Input id="uk-amount" invalid defaultValue="0" />
            </Field>
          </FieldRow>
          <div style={{ height: 14 }} />
          <Field label="Qeyd" htmlFor="uk-note" help="Bu qeyd audit izinə yazılır.">
            <Textarea id="uk-note" placeholder="Əməliyyatın səbəbini yazın" />
          </Field>
          <div style={{ height: 16 }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
            <Checkbox label="Pasiyentə bildiriş göndər" defaultChecked />
            <Radio name="uk-r" label="Tək seans" defaultChecked />
            <Radio name="uk-r" label="Paket" />
            <Switch label="Avtomatik xatırlatma" defaultChecked />
          </div>
        </Spec>

        {/* ---------------- Vəziyyət blokları ---------------- */}
        <Spec name="Bildiriş və boş vəziyyət" rule="Banner davamlı vəziyyət üçündür. Əməliyyat/API xətaları qlobal toast-a gedir.">
          <div className="fx-stack">
            <Banner tone="warn" title="Ödəniş 48 saatdır gözləyir">
              Pasiyentə xatırlatma göndərin və ya ödənişi ləğv edin.
            </Banner>
            <Banner tone="success">Ödəniş qeydə alındı və psixoloqun balansına yazıldı.</Banner>
            <Banner tone="error" title="Əməliyyat tamamlanmadı">
              Bank cavab vermədi. Bir neçə dəqiqədən sonra yenidən yoxlayın.
            </Banner>
            <EmptyBlock
              boxed
              title="Bu filtrdə ödəniş yoxdur"
              body="Seçilmiş tarix aralığında gözləyən ödəniş qeydə alınmayıb. Tarix aralığını genişləndirin və ya başqa vəziyyət seçin."
              actions={<Button variant="ghost" size="sm">Filtri sıfırla</Button>}
            />
          </div>
        </Spec>

        {/* ---------------- Proses ---------------- */}
        <Spec name="Proses göstəriciləri">
          <Stepper steps={["Pasiyent", "Psixoloq", "Vaxt", "Təsdiq"]} current={2} />
          <div style={{ height: 22 }} />
          <Progress value={3} max={4} label="Paket balansı: 4 seansdan 3-ü istifadə olunub" />
          <div style={{ height: 16 }} />
          <div style={{ maxWidth: 420 }}>
            <div className="fx-skeleton" style={{ height: 13, width: "70%", marginBottom: 8 }} />
            <div className="fx-skeleton" style={{ height: 13, width: "45%" }} />
          </div>
          <p className="fx-help" style={{ marginTop: 8 }}>
            Yüklənmə həmişə skeleton ilə göstərilir — "Yüklənir…" mətni yazılmır.
          </p>
        </Spec>

        {/* ---------------- Cədvəl skeleti ---------------- */}
        <Spec name="Cədvəl yüklənməsi">
          <TableSkeleton rows={3} cols={5} />
        </Spec>

        {/* ---------------- Üzən səthlər ---------------- */}
        <Spec name="Modal, drawer və menyu" rule="Kölgə yalnız burada işlədilir. Destruktiv əməliyyat mütləq təsdiq modalından keçir.">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
            <Button variant="ghost" onClick={() => setModal(true)}>
              Təsdiq modalını aç
            </Button>
            <Button variant="ghost" onClick={() => setDrawer(true)}>
              Detal panelini aç
            </Button>
          </div>
          <div style={{ maxWidth: 210 }}>
            <Menu>
              <MenuItem icon={<IconEdit />}>Düzəliş et</MenuItem>
              <MenuItem icon={<IconDownload />}>Qəbz yüklə</MenuItem>
              <MenuDivider />
              <MenuItem icon={<IconTrash />} danger>
                İadə et
              </MenuItem>
            </Menu>
          </div>
        </Spec>

        {/* ---------------- Kart növləri ---------------- */}
        <Spec name="Kartlar" rule="Kartda dekorativ kölgə yoxdur — yalnız 1px hairline sərhəd.">
          <div className="fx-2col--even fx-2col" style={{ gap: 12 }}>
            <Card>
              <CardHead title="Standart kart" action={<TextButton>Hamısına bax</TextButton>} />
              <CardBody>
                <p className="fx-subtitle" style={{ margin: 0 }}>
                  Panellərdə istifadə olunan əsas səth.
                </p>
              </CardBody>
            </Card>
            <Card tone="attention">
              <CardHead title="Diqqət kartı" />
              <CardBody>
                <p className="fx-subtitle" style={{ margin: 0 }}>
                  Operatordan hərəkət gözlənilən hallar üçün.
                </p>
              </CardBody>
            </Card>
          </div>
        </Spec>

        {/* ---------------- Avatar ---------------- */}
        <Spec name="Avatar" rule="Tək brend tonu — id-yə görə təsadüfi rəngləmə ləğv edilib.">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar name="Leyla Nəbiyeva" size="sm" />
            <Avatar name="Orxan Məmmədov" />
            <Avatar name="Günel Həsənova" size="lg" />
            <Avatar name="Rəşad Əliyev" size="xl" />
          </div>
        </Spec>

        <Modal
          open={modal}
          onClose={() => setModal(false)}
          title="Ödənişi geri qaytarmaq"
          text="120 AZN pasiyentin kartına qaytarılacaq. Bu əməliyyat geri alınmır və audit izinə yazılır."
          icon={<IconAlert />}
          iconTone="rose"
          actions={
            <>
              <Button variant="ghost" onClick={() => setModal(false)}>
                İmtina
              </Button>
              <Button variant="danger" onClick={() => setModal(false)}>
                Geri qaytar
              </Button>
            </>
          }
        >
          <Field label="Səbəb" required htmlFor="uk-reason">
            <Textarea id="uk-reason" placeholder="Səbəbi yazın" />
          </Field>
        </Modal>

        <Drawer open={drawer} onClose={() => setDrawer(false)} title="Ödəniş detalı">
          <DrawerSection>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name="Leyla Nəbiyeva" size="lg" />
              <div>
                <div className="fx-row__title">Leyla Nəbiyeva</div>
                <div className="fx-row__meta">Kart ilə ödənilib, 18.07.2026</div>
              </div>
            </div>
          </DrawerSection>
          <DrawerSection>
            <Stats style={{ marginBottom: 0 }}>
              <Stat value="120" unit="AZN" label="Ümumi məbləğ" size="sm" />
              <Stat value="24" unit="AZN" label="Platforma payı" size="sm" meta="20% komissiya" />
            </Stats>
          </DrawerSection>
          <DrawerSection>
            <div className="fx-timeline">
              {[
                ["Ödəniş qeydə alındı", "18.07.2026, 14:32 — operator Nigar"],
                ["Seans təsdiqləndi", "17.07.2026, 09:10 — sistem"],
                ["Müraciət yaradıldı", "16.07.2026, 18:45 — pasiyent"],
              ].map(([title, meta], i, arr) => (
                <div className="fx-tl-item" key={title}>
                  <div className="fx-tl-rail">
                    <span className={`fx-tl-dot${i === 0 ? " fx-tl-dot--now" : ""}`} />
                    {i < arr.length - 1 ? <span className="fx-tl-line" /> : null}
                  </div>
                  <div className="fx-tl-body">
                    <span className="fx-tl-title">{title}</span>
                    <span className="fx-tl-meta">{meta}</span>
                  </div>
                </div>
              ))}
            </div>
          </DrawerSection>
        </Drawer>
      </div>
    </div>
  );
}
