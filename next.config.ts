import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ATOMİK DEPLOY: build çıxışı ayrı qovluğa yönləndirilə bilsin deyə.
  // Əvvəllər build birbaşa canlı `.next` üzərində gedirdi — build davam edərkən
  // köhnə chunk faylları silinirdi və işləyən `next start` prosesi onları tapmırdı
  // (ChunkLoadError → 500 → 502). İndi deploy `.next-build`-ə yığır, uğurlu
  // bitəndə bir anda `.next` ilə əvəzləyir. Runtime-da dəyişən verilmir → `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: ["localhost", "*.localhost", "fanus.lvh.me", "*.lvh.me"],
  // Dev: compile olunmuş route-ları yaddaşda uzun saxla. Default-da səhifə qısa
  // müddət sonra atılır və modullar arasında gedib-gəldikdə HƏR DƏFƏ yenidən
  // "Compiling…" olur. Bu, yalnız dev serverə təsir edir (build-ə yox).
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000, // 1 saat
    pagesBufferLength: 50,          // eyni anda 50 route yaddaşda qalsın
  },
  images: {
    remotePatterns: [
      // Backend uploads (any host — covers prod + dev + staging)
      { protocol: "http",  hostname: "**" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
