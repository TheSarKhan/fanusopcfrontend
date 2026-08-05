"use client";

import { useEffect, useRef } from "react";

/**
 * Login/Register səhifələrindəki sağ panelin arxa fonu — statik şəkil əvəzinə video.
 *
 * Video portret kadrdır (810×1080) və panel dar-uzun olduğuna görə `object-fit: cover`
 * ilə oturur. Fayl «ping-pong» (irəli + geri) kimi montaj olunub, ona görə loop
 * nöqtəsində sıçrayış görünmür.
 *
 * Üstündəki `scrim` mətnin oxunması üçündür: video açıq tonludur, ağ başlıq və
 * kartlar onun üzərində birbaşa oxunmazdı.
 *
 * Mənbə: Pexels #7199178 (Pexels lisenziyası — kommersiya istifadəsi sərbəst,
 * atribut tələb olunmur). 4K portretdən kəsilib 810×1080-ə sıxılıb: 33 MB → 782 KB.
 */
export default function AuthPanelVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  // Bəzi brauzerlər `autoplay` atributunu nəzərə almır; muted + play() nüsxəsi
  // Hero-dakı ilə eyni yanaşmadır.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    const p = v.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }, []);

  return (
    <>
      <video
        ref={ref}
        className="auth-panel__video"
        src="/videos/auth-session.mp4"
        poster="/videos/auth-session-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden
      />
      <div className="auth-panel__scrim" aria-hidden />
    </>
  );
}
