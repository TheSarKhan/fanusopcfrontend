# Fanus UI Kit — Platforma Dizayn Sistemi

**fanusopc.com** (Azərbaycan dilində psixoloji dəstək platforması) üçün vahid, platforma-geneli UI kit. "Ödənişlər" və "Müştəri 360" modullarından çıxarılıb, amma **bütün platformaya** (operator paneli, admin, hesabatlar, istənilən yeni modul) tətbiq üçün nəzərdə tutulub: naviqasiya, cədvəllər, formalar, menyular, wizard-lar daxil.

## Bu paket haqqında (Claude Code üçün)

Bu paketdəki `.dc.html` faylları **HTML-də hazırlanmış dizayn istinadlarıdır** — istehsal kodu deyil. Vəzifə: bu dizaynları hədəf kod bazasının mövcud mühitində (React, Vue, Blade və s.) onun öz pattern-ləri ilə **yenidən qurmaqdır**. `tokens.css` və `components.css` isə birbaşa istifadə oluna bilər və ya CSS-in-JS / Tailwind konfiqurasiyasına çevrilə bilər — **tokenlər yeganə mənbədir (source of truth)**.

**Fidelity: hi-fi.** Rənglər, tipoqrafiya, boşluqlar və ölçülər son dəyərlərdir — piksel-dəqiq köçürün.

## Fayllar

| Fayl | Təyinat |
|---|---|
| `tokens.css` | Bütün dizayn tokenləri (`--*` CSS dəyişənləri): rənglər, kölgələr, radius, tipoqrafiya, boşluq şkalası |
| `components.css` | Komponent sinifləri (`.fx-*` prefiksi) |
| `icons.svg` | SVG ikon sprite (feather üslubu). `<use href="icons.svg#i-search">` ilə |
| `UI Kit.dc.html` | Bütün komponentlərin vizual istinad səhifəsi (canlı nümunə) |
| `references/Ödənişlər.dc.html` | Tam modul nümunəsi: maliyyə-əməliyyat ekranı |
| `references/Müştəri 360.dc.html` | Tam modul nümunəsi: CRM müştəri profili |

## MÜTLƏQ QAYDALAR

1. **HEÇ BİR EMOJİ** — heç yerdə. Bütün ikonlar inline SVG: `fill:none`, `stroke:currentColor`, `stroke-width:1.6–2`, round cap/join.
2. **Tək açıq (light) tema** — dark rejim yoxdur.
3. Bütün UI mətni **Azərbaycan dilində**.
4. Bütün rəqəmlərdə `font-variant-numeric: tabular-nums` (`.fx-num`).
5. **Rəng yalnız məna daşıyanda**: sage = müsbət/gəlir, amber = xəbərdarlıq/gecikmə, rose = risk/iadə, lilac = paket. Qalan hər şey oxford (ink) və brend mavisi.
6. Mental-health konteksti: test nəticələrini "yaxşı/pis" kimi rəngləməyin; nişanlar sakit, hökmsüz.
7. Kölgə minimal (`--shadow-sm` default), hairline bölücülər (`--hairline`), çox ağ boşluq.
8. Lorem ipsum yox — realistik Azərbaycan datası.

## Tipoqrafiya

- **Başlıqlar**: serif — *Playfair Display* 500, `letter-spacing:-.01em` (fallback: Georgia). Siniflər: `.fx-h1` (30px), `.fx-h2` (26px), `.fx-h3` (19px — modal/drawer).
- **Mətn**: sans — *Poppins* 400/600/700 (fallback: system-ui).
- **KPI rəqəmləri**: sans 800, `tabular-nums` (serif DEYİL).
- Minimum mətn ölçüsü: 11px (yalnız uppercase etiketlər üçün).

İstehsalda şriftləri yükləyin:
```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500&family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
```

## Layout qaydaları

- Sol sidebar: `--sidebar-w: 260px` (sabit). Məzmun sahəsi: `.fx-page` → padding `32px 40px 64px`.
- Səhifə fonu `--bg: #F7F9FC`, kartlar `#FFFFFF`.
- İki sütunlu gövdə: `grid-template-columns: 1.6fr 1fr` (əsas + yan panel).
- KPI sırası: bir kartda `repeat(4, 1fr)`, aralarında hairline (`.fx-kpi + .fx-kpi`).
- Masaüstü-öncəlikli, amma sıxılan (flex-wrap, minmax).

## Komponent kataloqu

### Düymələr (`.fx-btn`)
```html
<button class="fx-btn fx-btn--primary">Yeni ödəniş</button>
<button class="fx-btn fx-btn--ghost">Export</button>
<button class="fx-btn fx-btn--danger-ghost">İadə</button>      <!-- rose ghost -->
<button class="fx-btn fx-btn--danger">Geri qaytar</button>     <!-- destruktiv təsdiq -->
<button class="fx-btn fx-btn--warn-ghost">WhatsApp ilə xatırlat</button>
<button class="fx-btn fx-btn--ghost fx-btn--sm">Zəng</button>  <!-- sətir içi -->
```
Qayda: səhifədə 1 primary düymə; sətir içində `--sm`; destruktiv əməliyyatlar rose.

### Status rozetləri (`.fx-pill`)
| Status | Sinif | Etiket |
|---|---|---|
| PENDING | `fx-pill--pending` | Gözləyir |
| PAID | `fx-pill--paid` | Ödənilib |
| PARTIALLY_REFUNDED | `fx-pill--partial` | Qismi qaytarılıb |
| REFUNDED | `fx-pill--refunded` | Geri qaytarılıb |
| CANCELLED | `fx-pill--cancelled` | Ləğv edilib |

Əlavə: `--info` (mavi, məlumat nişanı), `--neutral`, `--count` / `--count-active` (tab sayğacı).

### Kartlar (`.fx-card`)
- `.fx-card` — standart (radius 16, shadow-sm, hairline border)
- `.fx-card--lg` — hero/KPI paneli (radius 20)
- `.fx-card--attention` — amber üst zolaqlı diqqət bloku (::before ilə 3px zolaq)
- `.fx-card--error` — rose hairline xəta kartı
- `.fx-card--empty` — dashed brand-200 sərhədli boş vəziyyət
- `.fx-card__head` — başlıq sırası (alt hairline ilə)

### KPI (`.fx-kpi`)
```html
<div class="fx-card fx-card--lg fx-kpi-row" style="grid-template-columns:repeat(4,1fr)">
  <div class="fx-kpi">
    <span class="fx-label">Bu gün yığılan</span>
    <span class="fx-kpi__value">350 <span class="fx-kpi__unit">AZN</span></span>
    <span class="fx-kpi__meta"><span class="fx-trend fx-trend--up">▲svg 12%</span> dünənlə müqayisədə</span>
  </div>
  ...
</div>
```
Trend oxları SVG (`#i-trend-up` / `#i-trend-down`) — mətn işarəsi yox.

### Avatar (`.fx-avatar`)
Baş hərflər + 4 rəng variantı (`--1..--4`, `id % 4` ilə seçilir). Ölçülər: `--sm` 30px, default 38px, `--md` 44px, `--lg` 72px (hero).

### Formlar
`.fx-input`, `.fx-select`, `.fx-textarea`, `.fx-search` (ikonlu axtarış), `.fx-checkbox` (accent-color brend), `.fx-field` (label+input sütunu), `.fx-select--inline` (filtr zolağı üçün).

### Tablar (`.fx-tabs` / `.fx-tab`)
Aktiv tab: `fx-tab--active` (brand-50 fon + 2px brend alt xətt) + `fx-pill--count-active` sayğac.

### Çiplər
- `.fx-chip` — əlaqə çipi (telefon/email, hero-da)
- `.fx-toggle-chip` / `--active` — "Mənim" tipli filtr keçidi (nöqtə indikatorlu)

### Siyahı sətri (`.fx-row`)
Struktur: checkbox → avatar → ad + meta (üsul ikonu · tarix · bağlantı) → status pill → spacer → məbləğ (sağda, `.fx-row__amount`) → əməliyyat düymələri → chevron. Hover: `--surface-muted` fon. Bölücü: yalnız üst hairline.

### Timeline (`.fx-timeline`) — audit izi / müştəri jurnalı
Nöqtə rəngləri hadisə növünə görə: `--brand` seans, `--sage` ödəniş, `--lilac` paket, `--amber` test/gecikmə, `--rose` risk/iadə, `--muted` sistem. Səbəb qeydi: `.fx-tl-note` (dırnaqda).

### Progress (`.fx-progress`)
Paket balansı, yığım dərəcəsi. Track: brand-100; fill: brend (aktiv), brand-200 (bitmiş), sage (gəlir qrafiki).

### Modal / Drawer / Toast / Bulkbar
- Modal: `.fx-overlay fx-overlay--center` + `.fx-modal` (400px, serif başlıq, `__icon--brand/--rose`, sağda düymələr)
- Drawer: `.fx-overlay` + `.fx-drawer` (460px, sağdan, `__section`-larla)
- Toast: `.fx-toast fx-toast--success/--error`, sağ-alt, 2.6s sonra itir
- Toplu seçim: `.fx-bulkbar` (oxford fon, mərkəz-alt, "N seçildi → Toplu ödənildi · Export")

### Xəbərdarlıq / Məlumat
- `.fx-alert` — amber qayğı bloku (autoFlag izahı)
- `.fx-info` — brand-50 məlumat zolağı

### Skeleton (`.fx-skeleton`)
Shimmer animasiyalı yüklənmə. "Yüklənir…" mətni YOX — həmişə skeleton.

### Naviqasiya (platforma çərçivəsi)
- `.fx-sidebar` (260px) + `.fx-sidebar__brand` (serif loqotip) + `.fx-nav-item` / `--active` (brand-50 fon) + `.fx-nav-section` (bölmə etiketi)
- `.fx-topbar` (64px) — axtarış + `.fx-iconbtn` (bell, `.fx-badge-dot` bildiriş nöqtəsi ilə) + operator avatarı
- `.fx-breadcrumb` — səhifə yolu

### Cədvəl (`.fx-table`)
Klassik `<table>`: uppercase th, hairline sətir bölücüləri, hover fonu, `.fx-td-num` (sağa yaslanmış tabular rəqəm). Altında `.fx-pagination` (`.fx-page-btn` / `--active`).

### Menyu (`.fx-menu`)
Dropdown panel: `.fx-menu-item` (+ `--danger` rose), `.fx-menu-divider`. Shadow-lg, radius 12.

### Form dəsti (tam)
- `.fx-switch` (toggle), `.fx-radio` + `.fx-choice`, `.fx-checkbox`
- Validasiya: `.fx-input--error` + `.fx-error-text` (alert ikonlu), `.fx-help` (köməkçi mətn)
- `.fx-dropzone` — fayl yükləmə (dashed brand-200)

### Digər platforma komponentləri
- `.fx-banner` — səhifə bildirişi: `--info / --warn / --error / --success`
- `.fx-stepper` — wizard addımları: `.fx-step` / `--done` / `--active` + `.fx-step-line`
- `.fx-segmented` — Gün/Həftə/Ay tipli keçid (`.fx-seg--active`)
- `.fx-tag` — silinə bilən etiket çipi
- `.fx-tooltip` — oxford fonlu izah bulud-u

## İkonlar

`icons.svg` sprite: search, card, cash, transfer, phone, message, mail, eye, check, x, download, plus, calendar, calendar-plus, sliders, alert, refresh, refund, chevron-right, chevron-left, chevron-down, trend-up, trend-down, clock, edit, info, block, inbox, package, map-pin, star, check-square, external, user, users, bell, home, settings, logout, more-h, trash, upload, lock, file-text, bar-chart, arrow-right, heart.

React-da inline komponentə çevirin və ya sprite kimi saxlayın. Yeni ikon lazım olsa: feather üslubu, 24×24 viewBox, stroke 1.6–2.

## Qarşılıqlı əlaqə pattern-ləri

- **Sətrə klik** → sağdan detal drawer (audit izi + komissiya bölgüsü)
- **Destruktiv/maliyyə əməliyyatı** → təsdiq modalı (səbəb input-u audit izinə yazılır) → toast
- **Toplu seçim** → checkbox-lar → üzən bulkbar
- **Hover**: sətirlərdə `--surface-muted` fon; düymələrdə bir ton tünd
- **Animasiyalar**: modal/toast `fx-pop` (.2–.25s), drawer `fx-slide` (.25s) — hamısı qısa və sakit
- **Toast**: uğur `--success #059669`, xəta `--error #DC2626`; 2.6s auto-dismiss

## Data modeli xatırlatmaları

Status qrupları (tab-lar): Gözləyir `[PENDING]` · Ödənilmiş `[PAID, PARTIALLY_REFUNDED]` · Geri qaytarılmış `[REFUNDED]` · Ləğv edilmiş `[CANCELLED]`.
Komissiya: platforma payı default 20% (`amount * rate` → platforma; qalan psixoloqun xalis payı).
Gecikmə hədləri: gözləyən ödəniş >24 saat = amber nişan, >48 saat = rose nişan.

## Anti-pattern-lər (ETMƏYİN)

- Emoji, dark tema, bənövşəyi qradientlər, "kölgə tufanı", kart-üstə-kart
- Rounded sol-border aksent kartları, şablon SaaS klişeləri
- Test nəticələrinə yaşıl/qırmızı "qiymət" vermək
- Tokenlərdən kənar rəng/radius/kölgə uydurmaq
