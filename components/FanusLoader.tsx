/**
 * FanusLoader — Fanus loqosu (fanar) formasında yüklənmə animasiyası.
 * Loqo silueti CSS `mask` kimi işlədilir; brend rəngli "dolma" `clip-path` ilə
 * aşağıdan yuxarı qalxıb-enir (dolub-boşalma effekti — fanarın işıqla dolması).
 *
 * İstifadə:
 *   <FanusLoader />                       // inline, 64px
 *   <FanusLoader size={40} />             // daha kiçik
 *   <FanusLoader fullscreen label="…" />  // tam ekran mərkəzləşmiş (modul keçidi)
 */
export default function FanusLoader({
  size = 64,
  label,
  fullscreen = false,
}: {
  size?: number;
  label?: string;
  fullscreen?: boolean;
}) {
  const loader = (
    <span
      className="fanus-loader"
      role="status"
      aria-label={label ?? "Yüklənir"}
      style={{ width: size }}
    >
      <span className="fanus-loader__layer fanus-loader__base" aria-hidden />
      <span className="fanus-loader__layer fanus-loader__fill" aria-hidden />
    </span>
  );

  if (!fullscreen) return loader;

  return (
    <div className="fanus-loader-screen" suppressHydrationWarning>
      {loader}
      {label && <span className="fanus-loader-screen__label">{label}</span>}
    </div>
  );
}
