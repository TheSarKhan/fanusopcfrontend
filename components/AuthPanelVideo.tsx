"use client";

import { useEffect, useRef } from "react";

/**
 * Login/Register səhifələrindəki sağ panelin arxa fonu — statik şəkil əvəzinə video.
 *
 * Video 800×1000-dir — panelin nisbəti (0.80) ilə eyni. Bu vacibdir: əvvəlki
 * versiyalarda mənbə 9:16 idi, `cover` hündürlüyün böyük hissəsini kəsir və
 * insanın başı kadrdan çıxırdı. Eyni nisbətdə kəsim minimuma enir.
 *
 * Fayl «ping-pong» (irəli + geri) montaj olunub, ona görə loop nöqtəsində
 * sıçrayış görünmür.
 *
 * Üstündəki `scrim` mətnin oxunması üçündür: video açıq tonludur, ağ başlıq və
 * kartlar onun üzərində birbaşa oxunmazdı. Örtük qəsdən yüngüldür — noutbuk
 * seçilməli idi.
 *
 * Mənbə: Pexels #9198476 — noutbukda onlayn seans, qara saçlı qız, kərpic divar.
 * Pexels lisenziyası kommersiya istifadəsinə açıqdır, atribut tələb etmir.
 * FullHD-dən 0.80 nisbətində kəsilib: 17 MB → 947 KB.
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
