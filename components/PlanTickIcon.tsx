/**
 * Plan nişanı — 14 uclu möhür, içində Fanus fənəri və təsdiq işarəsi.
 *
 * SVG-dir, PNG deyil: nişanın rəngi plandan (`tikColor`) gəlir və admin rəngi
 * dəyişdikdə ikon da dərhal həmin rəngdə çəkilməlidir. Rastr şəkildə bu mümkün
 * olmazdı — hər rəng üçün ayrıca fayl saxlamaq lazım gələrdi.
 *
 * Fon yoxdur: yalnız formanın özü çəkilir, ona görə istənilən səthin üzərində
 * (ağ kart, açıq-mavi zolaq) təmiz oturur.
 *
 * Daxili fənər və quyruq AĞ çəkilir — mənbə nişanda olduğu kimi. Şəffaf kəsik
 * əvəzinə ağ seçilib: nişan həmişə açıq fonda göstərilir, kəsik isə tünd səthdə
 * formanı oxunmaz edərdi.
 *
 * Möhürün ucları riyazi hesablanıb (14 uc, xarici r=47, daxili r=38.5), ona görə
 * tam simmetrikdir; yumşaq uclar üçün eyni rənglə nazik ştrix verilib.
 */

const SEAL_PATH =
  "M50.00 3.00 L58.57 12.47 L70.39 7.65 L74.00 19.90 L86.75 20.70 L84.69 33.30 " +
  "L95.82 39.54 L88.50 50.00 L95.82 60.46 L84.69 66.70 L86.75 79.30 L74.00 80.10 " +
  "L70.39 92.35 L58.57 87.53 L50.00 97.00 L41.43 87.53 L29.61 92.35 L26.00 80.10 " +
  "L13.25 79.30 L15.31 66.70 L4.18 60.46 L11.50 50.00 L4.18 39.54 L15.31 33.30 " +
  "L13.25 20.70 L26.00 19.90 L29.61 7.65 L41.43 12.47 Z";

export default function PlanTickIcon({
  color = "var(--brand)",
  size = 20,
  title,
}: {
  color?: string;
  size?: number;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ display: "block", flexShrink: 0 }}
    >
      <path d={SEAL_PATH} fill={color} stroke={color} strokeWidth={3} strokeLinejoin="round" />

      <g fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
        {/* Asqı halqası və sapı */}
        <circle cx="50" cy="23.5" r="5.2" strokeWidth="2.8" />
        <path d="M50 28.7 L50 32.5" strokeWidth="2.8" />
        {/* Fənərin üst qapağı */}
        <path d="M33.5 38.5 C40 34.5 60 34.5 66.5 38.5" strokeWidth="3" />
        {/* Gövdə: üstü günbəzli, yanları düz */}
        <path d="M36 74 L36 50.5 C36 44 42.3 40 50 40 C57.7 40 64 44 64 50.5 L64 74" strokeWidth="3.2" />
        {/* Alt kənar — mənbədəki kimi azca açıq */}
        <path d="M36 74 C42 71.5 58 71.5 64 74" strokeWidth="3.2" />
        {/* Təsdiq quyruğu */}
        <path d="M42 58 L48.5 66.5 L69 43.5" strokeWidth="6.2" />
      </g>
    </svg>
  );
}
