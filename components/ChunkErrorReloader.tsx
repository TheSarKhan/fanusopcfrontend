"use client";

import { useEffect } from "react";

/**
 * Deploy-dan sonra köhnə tab-ların "ChunkLoadError" verib ağ ekran qalmasının qarşısını alır.
 *
 * Sayt yenidən build olunanda chunk fayllarının hash-ları dəyişir; artıq açıq olan səhifə
 * köhnə (artıq mövcud olmayan) chunk-a istinad edir və naviqasiya/lazy-import zamanı
 * ChunkLoadError (404) baş verir. Bu handler həmin xətanı tutub səhifəni BİR DƏFƏ yeniləyir
 * — beləliklə brauzer təzə HTML + təzə chunk-ları çəkir. Loop-a düşməmək üçün son yeniləmədən
 * 15 saniyə keçməyibsə təkrar yeniləmir (deploy tam bitməyibsə sonsuz reload olmasın).
 */
export default function ChunkErrorReloader() {
  useEffect(() => {
    const KEY = "chunkReloadAt";

    const isChunkError = (val: unknown): boolean => {
      if (!val) return false;
      const err = val as { name?: string; message?: string };
      if (err.name === "ChunkLoadError") return true;
      const msg = typeof val === "string" ? val : err.message || "";
      return /ChunkLoadError/i.test(msg)
        || /Loading chunk [\w-]+ failed/i.test(msg)
        || /Loading CSS chunk/i.test(msg)
        || /Importing a module script failed/i.test(msg)
        || /error loading dynamically imported module/i.test(msg);
    };

    const reloadOnce = () => {
      try {
        const last = Number(sessionStorage.getItem(KEY) || 0);
        if (Date.now() - last < 15000) return; // artıq yeni-yenidən cəhd edilib — loop-dan qaç
        sessionStorage.setItem(KEY, String(Date.now()));
      } catch { /* sessionStorage əlçatmazdırsa yenə də yeniləyirik */ }
      window.location.reload();
    };

    const onError = (e: ErrorEvent) => {
      if (isChunkError(e.error) || isChunkError(e.message)) reloadOnce();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isChunkError(e.reason)) reloadOnce();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
