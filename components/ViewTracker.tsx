"use client";

import { useEffect } from "react";
import { recordContentView } from "@/lib/api";

/**
 * Kontent baxışını qeyd edir (V125). Server komponenti POST edə bilmədiyi üçün
 * bu kiçik klient komponenti səhifəyə əlavə olunur — heç nə render etmir.
 *
 * Qəsdən sadə saxlanılıb: şəxsi məlumat göndərilmir, cavab gözlənilmir, xəta
 * udulur. Sayğac ikinci dərəcəli məlumatdır — ziyarətçinin səhifəsini heç bir
 * halda pozmamalıdır.
 *
 * Eyni səhifəyə təkrar girişdə (React strict mode / naviqasiya) ikiqat
 * yazılmasın deyə sessiya boyu bir dəfə göndərilir.
 */
export default function ViewTracker({ type, id }: {
  type: "BLOG_POST" | "PSYCHOLOGIST";
  id: number;
}) {
  useEffect(() => {
    if (!id) return;
    const key = `fanus.viewed.${type}.${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage bağlıdırsa (private rejim) sadəcə hər dəfə göndəririk
    }
    recordContentView(type, id);
  }, [type, id]);

  return null;
}
