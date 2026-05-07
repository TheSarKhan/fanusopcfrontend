"use client";

import { useEffect, useState } from "react";
import { patientApi } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";

let cachedIds: Set<number> | null = null;
let cachePromise: Promise<Set<number>> | null = null;

async function getFavoriteIds(): Promise<Set<number>> {
  if (cachedIds) return cachedIds;
  if (cachePromise) return cachePromise;
  cachePromise = patientApi.favoriteIds()
    .then(ids => { cachedIds = new Set(ids); return cachedIds; })
    .catch(() => { cachedIds = new Set(); return cachedIds; })
    .finally(() => { cachePromise = null; });
  return cachePromise;
}

export function invalidateFavoritesCache() {
  cachedIds = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("fanus:session-cleared", () => { cachedIds = null; });
}

export default function FavoriteButton({
  psychologistId,
  size = 18,
  style,
}: {
  psychologistId: number;
  size?: number;
  style?: React.CSSProperties;
}) {
  const [isPatient, setIsPatient] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const u = getStoredUser();
    const patient = !!u && u.role === "PATIENT";
    setIsPatient(patient);
    if (patient) {
      getFavoriteIds().then(ids => setFavorited(ids.has(psychologistId)));
    }
  }, [psychologistId]);

  if (!isPatient) return null;

  const onToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const { favorite } = await patientApi.toggleFavorite(psychologistId);
      setFavorited(favorite);
      if (cachedIds) {
        if (favorite) cachedIds.add(psychologistId);
        else cachedIds.delete(psychologistId);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={favorited ? "Favoritdən sil" : "Favoritə əlavə et"}
      title={favorited ? "Favoritdən sil" : "Favoritə əlavə et"}
      style={{
        width: size + 16, height: size + 16, borderRadius: "50%",
        background: "rgba(255,255,255,0.95)", border: "1px solid #E5E7EB",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: loading ? "wait" : "pointer", padding: 0,
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        ...style,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24"
        fill={favorited ? "#DC2626" : "none"}
        stroke={favorited ? "#DC2626" : "#52718F"}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
