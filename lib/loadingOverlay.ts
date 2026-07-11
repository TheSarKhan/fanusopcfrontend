/**
 * Qlobal "yükləmə popupı" store-u — imperativ, komponentdən kənar.
 * Hər dəyişdirici əməliyyat (API mutasiyası) başlayanda `beginTask`, bitəndə
 * `endTask` çağırılır. Sayğac > 0 olduqda popup açılır.
 *
 * İki mühüm nüans:
 *  - SHOW_DELAY: yalnız bir qədər uzun çəkən əməliyyatlarda göstərilir ki,
 *    ani (fast) sorğularda ekran yanıb-sönməsin.
 *  - Sayğac referans-sayı kimidir: paralel əməliyyatlar üst-üstə düşəndə
 *    popup yalnız hamısı bitəndə bağlanır.
 */

type Listener = (active: boolean) => void;

const SHOW_DELAY = 220; // ms — bundan qısa əməliyyatlarda popup ümumiyyətlə açılmır

let count = 0;
let visible = false;
let showTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(visible);
}

function clearTimer() {
  if (showTimer != null) {
    clearTimeout(showTimer);
    showTimer = null;
  }
}

export function subscribeLoading(l: Listener): () => void {
  listeners.add(l);
  l(visible);
  return () => {
    listeners.delete(l);
  };
}

export function beginTask() {
  if (typeof window === "undefined") return; // yalnız brauzerdə — SSR-də state sızmasın
  count++;
  if (count === 1 && !visible && showTimer == null) {
    showTimer = setTimeout(() => {
      showTimer = null;
      if (count > 0) {
        visible = true;
        emit();
      }
    }, SHOW_DELAY);
  }
}

export function endTask() {
  if (typeof window === "undefined") return;
  count = Math.max(0, count - 1);
  if (count === 0) {
    clearTimer();
    if (visible) {
      visible = false;
      emit();
    }
  }
}

/** İstənilən promise-i popup ilə bürüyür (əl ilə çağırışlar üçün). */
export async function withOverlay<T>(p: Promise<T>): Promise<T> {
  beginTask();
  try {
    return await p;
  } finally {
    endTask();
  }
}

/**
 * Popupı əl ilə açıq saxlayır — response bitsə belə bağlanmır.
 * Login kimi hallarda lazımdır: API cavabı tez gəlir, amma subdomainə hard-redirect
 * 2-3 saniyə çəkir; animasiya yönləndirmə tamamlanana qədər görünməlidir.
 * Qaytardığı `release()` çağırılana qədər (məs. xəta olanda) açıq qalır; uğurlu
 * yönləndirmədə isə `release` çağırılmır — brauzer navigasiya edəndə səhifə ilə
 * birlikdə təbii şəkildə itir.
 */
export function holdOverlay(): () => void {
  beginTask();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    endTask();
  };
}
