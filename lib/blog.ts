/**
 * Publik kart/nişanda göstəriləcək kateqoriya adı.
 *
 * Boş kateqoriya, həmçinin köhnə "Qaralama" sentinel-i (məqalə kateqoriyasız yadda
 * saxlananda editorun keçmişdə qoyduğu pozuq default) → boş sətir qaytarır. Beləliklə
 * dərc olunmuş məqalələrin üstündə yanlış "QARALAMA" nişanı çıxmır — kateqoriya yalnız
 * həqiqi dəyər olduqda göstərilir.
 */
export function displayCategory(category?: string | null): string {
  const v = (category ?? "").trim();
  return !v || v.toLowerCase() === "qaralama" ? "" : v;
}
