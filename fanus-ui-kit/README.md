# Fanus Panel UI Kit — Platforma Dizayn Sistemi

**fanusopc.com** panellərinin (admin / operator / psixoloq / pasiyent) **yeganə** dizayn sistemi.
Hər panelin öz CSS prefiksini yazması (`.op-`, `.psy-`, `.pcli-`, `.bk-` …) bu kitin mövcud olma səbəbidir — o dövr bitdi.

## Necə işlədilir

Səhifədə **React komponentləri** yazılır, `.fx-*` sinifləri yox:

```tsx
import { PageHead, Card, CardHead, CardBody, Row, Status, Button } from "@/components/ui";
```

Canlı istinad: **`/ui-kit/panel`** — bütün komponentlərin işlək nümunəsi.
Yeni komponent əlavə edəndə həmin səhifəyə də nümunə yazın.

| Fayl | Təyinat |
|---|---|
| `tokens.css` | Bütün dizayn tokenləri (`--*`): rənglər, radius, tipoqrafiya, boşluq. **Yeganə mənbədir.** |
| `components.css` | Komponent sinifləri (`.fx-*`) — React qatı bunları işlədir |
| `icons.svg` | SVG ikon sprite (feather üslubu) |
| `components/ui/*.tsx` | React komponent qatı — səhifələr **yalnız buradan** import edir |

## MÜTLƏQ QAYDALAR

1. **Səhifədə `.fx-*` sinifi yazmayın.** `components/ui`-dən komponent import edin.
   Komponent çatmırsa — səhifədə CSS yazmaq yox, kitə komponent əlavə etmək lazımdır.
2. **Yeni panel-spesifik CSS prefiksi yaratmaq QADAĞANDIR.**
3. **Status rəngli rozet (badge/pill) və ya rəngli nöqtə ilə göstərilmir** — `<Status>` sadə mətndir.
   Rəng yalnız məna daşıyanda: `wait` diqqət tələb edən, `risk` iadə/ləğv riski. Qalan hallar neytral.
4. **Başlıqlar cümlə formasında.** UPPERCASE "eyebrow" etiket yoxdur.
5. **Kartda dekorativ kölgə yoxdur** — yalnız 1px hairline sərhəd.
   Kölgə yalnız üzən səthlərdə: modal, drawer, menyu, toast.
6. **HEÇ BİR EMOJİ** — bütün ikonlar inline SVG: `fill:none`, `stroke:currentColor`,
   `stroke-width:1.6–2`, round cap/join.
7. **Tək açıq (light) tema.** Dark rejim yoxdur.
8. Bütün UI mətni **Azərbaycan dilində**. Lorem ipsum yox — realistik Azərbaycan datası.
9. Bütün rəqəmlərdə `font-variant-numeric: tabular-nums` (`.fx-num` və ya komponentin özü).
10. **Tarixlər həmişə `gg.aa.iiii`** — `azFormatDate` / `azFormatDateTime` (`@/lib/datetime`).
11. **Mental-health konteksti**: test nəticələrini "yaxşı / pis" kimi rəngləməyin.
12. **Tokenlərdən kənar rəng / radius / kölgə uydurmaq QADAĞANDIR.**

## Yazı qaydaları

- Meta sətri **tam cümlədir**. `·` ayırıcısı işlədilmir.
  - doğru → `Kart ilə ödənilib, 18.07.2026 — Dr. Rəşad Əliyev`
  - səhv → `Kart · 18.07.2026 · Dr. Rəşad Əliyev`
- Boş vəziyyət səbəbi izah edir və növbəti addımı təklif edir — quru "Məlumat yoxdur" yazmayın.
- Yüklənmə həmişə **skeleton** ilə göstərilir — "Yüklənir…" mətni yazılmır.
- Panel əməliyyat / API xətaları **qlobal toast**-a gedir (`toast(mesaj, "error")`), inline banner-ə yox.
  `<Banner>` davamlı vəziyyət üçündür ("Profiliniz təsdiq gözləyir"), əməliyyat nəticəsi üçün yox.

## Tipoqrafiya

Tək font: **Poppins** (fallback: system-ui). Serif başlıq yoxdur.

| Rol | Token | Ölçü / çəki |
|---|---|---|
| Səhifə başlığı | `--text-h1` | 22px / 700 |
| Bölmə başlığı | `--text-h2` | 18px / 700 |
| Modal / drawer başlığı | `--text-h3` | 16px / 700 |
| Kart başlığı | — | 15px / 700 |
| Statistika rəqəmi | `--text-kpi` | 26px / 700, tabular |
| Əsas mətn | `--text-body` | 13.5px |
| Sətir başlığı | `--text-body-lg` | 14px / 600 |
| Meta / kömək | `--text-caption` | 12.5px |
| Sahə etiketi | `--text-label` | 13px / 600 — **uppercase deyil** |

## Layout

- Sol sidebar `--sidebar-w: 260px`. Məzmun sahəsi `.fx-page` → `32px 40px 64px`.
- Səhifə fonu `--bg: #F7F9FC`, kartlar `#FFFFFF`, sərhədlər `--hairline: #E9EEF5`.
- İki sütun: `<div className="fx-2col">` → `2fr 1fr`, 1024px altında tək sütun.
- **Panellər tam eni doldurur** — sağda boş dəhliz qalmır. Sabit `max-width` verməyin;
  `minmax` / `auto-fit` işlədin.
- Boşluq ritmi: **8 / 12 / 16 / 24**. Başqa dəyər işlətməyin.
- Cədvəl dar ekranda `<TableWrap>` içində **özü** sürüşür — səhifə gövdəsi yan sürüşmür.

## Komponent kataloqu (`@/components/ui`)

| Sahə | Komponentlər |
|---|---|
| Səhifə | `PageHead`, `SectionTitle` |
| Səth | `Card`, `CardHead`, `CardBody`, `CardFoot`, `CardPad` |
| Əməliyyat | `Button`, `ButtonLink`, `TextButton`, `IconButton` |
| Data | `Stats`, `Stat`, `Trend`, `Row`, `Avatar` |
| Vəziyyət | `Status`, `PaymentStatus` |
| Cədvəl | `TableWrap`, `Table`, `Th`, `Td`, `Pagination`, `TableSkeleton` |
| Form | `Field`, `FieldRow`, `Input`, `Select`, `Textarea`, `Checkbox`, `Radio`, `Switch`, `SearchInput` |
| Naviqasiya | `Tabs`, `Segmented`, `ToggleChip` |
| Üzən | `Modal`, `Drawer`, `DrawerSection`, `Menu`, `MenuItem`, `MenuDivider` |
| Bildiriş | `Banner`, `EmptyBlock`, `Progress`, `Stepper` |

`Card` tonları: `default` · `attention` (amber) · `error` (rose) · `empty` (dashed).
`Button` variantları: `primary` · `ghost` · `quiet` · `danger` · `dangerGhost` · `warnGhost`.
Səhifədə **bir** primary düymə olur.

## Qarşılıqlı əlaqə pattern-ləri

- **Sətrə klik** → sağdan `<Drawer>` (detal + audit izi)
- **Destruktiv / maliyyə əməliyyatı** → `<Modal>` təsdiqi (səbəb input-u audit izinə yazılır) → toast
- **Toplu seçim** → checkbox-lar → üzən `.fx-bulkbar`
- **Animasiyalar** qısa və sakit: modal/toast `.2–.25s`, drawer `.25s`.
  `prefers-reduced-motion` hörmət olunur.

## Anti-pattern-lər (ETMƏYİN)

- Emoji, dark tema, qradient hero banner, halqa/gauge göstərici, "kölgə tufanı", kart-üstə-kart
- Uppercase eyebrow etiketlər, rəngli status pill-ləri, status nöqtələri
- Rounded sol-border aksent kartları, şablon SaaS klişeləri
- Meta sətrində `·` ayırıcısı və ya rəngli çiplər
- Test nəticələrinə yaşıl/qırmızı "qiymət" vermək
- Səhifə daxilində inline stil ilə yeni görünüş uydurmaq
