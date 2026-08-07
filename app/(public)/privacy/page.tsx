import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Məxfilik siyasəti – Fanus",
  description:
    "Fanus platformasında fərdi məlumatların toplanması, istifadəsi, qorunması və istifadəçi hüquqları barədə məxfilik siyasəti.",
};

// Hüquqi sənədin kanonik mətni Azərbaycan dilindədir (Versiya 1.0, 4 avqust 2026).
// İstifadə qaydaları (/terms) ilə birlikdə oxunmalıdır.

const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: "Sənədin məqsədi və əhatəsi",
    p: [
      "Bu Məxfilik siyasəti Fanus platformasının (veb-sayt, panel və əlaqəli xidmətlər) müraciətçilərə və mütəxəssislərə aid fərdi məlumatları hansı məqsədlə topladığını, necə istifadə etdiyini, kimlərlə paylaşdığını və necə qoruduğunu müəyyən edir. Platformadan istifadə bu siyasətlə tanışlığı, xüsusi kateqoriyalı məlumatların işlənməsi isə qeydiyyat zamanı verilən açıq razılığı tələb edir. Sənəd Platformadan istifadə qaydaları ilə birlikdə tətbiq olunur.",
    ],
  },
  {
    h: "Topladığımız məlumatlar",
    p: [
      "Hesab məlumatları: ad, soyad, e-poçt, telefon, şifrə (yalnız kriptoqrafik heş şəklində saxlanılır), seçilmiş dil.",
      "Müraciətçi profili: doğum tarixi, istəyə bağlı təcili əlaqə şəxsi və yaşayış ünvanı (şifrələnmiş saxlanılır), qeydiyyat razılıqlarının vaxt möhürləri.",
      "Xidmət məlumatları: seans rezervasiyaları və tarixçəsi, paketlər, ödəniş qeydləri (məbləğ, üsul, status), mütəxəssislə yazışma və müraciət qeydləri, rəylər, psixoloji test cavabları və nəticələri, mütəxəssisin apardığı seans qeydləri.",
      "Sağlamlıqla bağlı xüsusi kateqoriyalı məlumatlar: müraciət səbəbi, seans qeydləri, test nəticələri və mütəxəssisin klinik qeydləri — yalnız xidmətin göstərilməsi məqsədilə və açıq razılıq əsasında işlənilir.",
      "Mütəxəssis məlumatları: şəxsiyyət, təhsil və ixtisas sənədləri, sertifikatlar, iş təcrübəsi, profil məzmunu, hesablaşma üçün zəruri məlumatlar.",
      "Texniki məlumatlar: giriş tarixçəsi, IP ünvanı, cihaz və brauzer məlumatı, təhlükəsizlik jurnalı (audit log).",
    ],
  },
  {
    h: "İstifadə məqsədləri",
    p: [
      "Məlumatlar yalnız bu məqsədlər üçün istifadə olunur: xidmətin göstərilməsi (seansların təşkili, mütəxəssis-müraciətçi uyğunlaşdırması, operator dəstəyi); ödənişlərin qeydiyyatı və hesablaşma; hesabın təhlükəsizliyi və sui-istifadənin qarşısının alınması; hüquqi öhdəliklərin icrası; xidmət keyfiyyətinin təhlili; açıq razılıq verildikdə — yenilik və kampaniya bildirişləri.",
      "Marketinq bildirişləri yalnız qeydiyyatda və ya sonradan verilən ayrıca razılıq əsasında göndərilir və istənilən vaxt imtina etmək mümkündür.",
    ],
  },
  {
    h: "Hüquqi əsas",
    p: [
      "Məlumatların işlənməsi Azərbaycan Respublikasının «Fərdi məlumatlar haqqında» Qanununa və digər tətbiq olunan qanunvericiliyə uyğun aparılır. Əsaslar: istifadəçi ilə bağlanmış müqavilənin (İstifadə qaydalarının) icrası; qanuni öhdəliklər; istifadəçinin açıq razılığı (xüsusi kateqoriyalı sağlamlıq məlumatları və marketinq üçün); platformanın təhlükəsizliyinə dair qanuni maraq.",
    ],
  },
  {
    h: "Sağlamlıq məlumatlarının xüsusi qorunması",
    p: [
      "Seans qeydləri və digər həssas klinik məzmun bazada şifrələnmiş formada saxlanılır. Bu məzmuna standart qaydada yalnız müalicəni aparan mütəxəssis çıxış edir.",
      "Platforma administrasiyasının klinik məzmuna çıxışı yalnız müstəsna hallarda, yazılı əsaslandırma ilə, müddətli (24 saat) və tam audit olunan qaydada mümkündür; belə giriş barədə müraciətçinin mütəxəssisinə bildiriş göndərilir.",
      "Operator komandası yalnız xidmətin təşkili üçün zəruri olan minimum məlumatı görür (əlaqə, rezervasiya, ödəniş statusu); seans məzmununu görmür.",
    ],
  },
  {
    h: "Məlumatların paylaşılması",
    p: [
      "Fanus fərdi məlumatları satmır və üçüncü şəxslərə marketinq məqsədilə ötürmür. Paylaşma yalnız bu hallarla məhduddur: seçilmiş mütəxəssis (xidmətin göstərilməsi üçün zəruri həcmdə); xidmətin işləməsi üçün istifadə olunan texniki təchizatçılar — hostinq, e-poçt çatdırılması və oxşar xidmətlər (yalnız zəruri minimum həcmdə və məxfilik öhdəliyi ilə); qanunun tələb etdiyi hallarda məhkəmə və səlahiyyətli dövlət orqanları; həyat və təhlükəsizlik üçün ciddi risk halları.",
    ],
  },
  {
    h: "Saxlama müddəti",
    p: [
      "Məlumatlar yalnız məqsəd üçün zəruri olan müddətdə saxlanılır: hesab məlumatları — üzvlük dövründə; seans və ödəniş qeydləri — mühasibat və hüquqi tələblərə uyğun müddətdə; təhlükəsizlik jurnalları — məhdud müddətdə. Müddət bitdikdə məlumat silinir və ya geri dönməz şəkildə anonimləşdirilir.",
    ],
  },
  {
    h: "Hesabın silinməsi",
    p: [
      "İstifadəçi hesabının silinməsini şəxsi kabinetdən tələb edə bilər. Silinmə zamanı şəxsi identifikasiya məlumatları anonimləşdirilir; qanunvericiliyin saxlanmasını tələb etdiyi qeydlər (məsələn, ödəniş və mühasibat sənədləri) tələb olunan müddət ərzində saxlanılır. Silinmiş hesabın e-poçtu ilə yenidən qeydiyyat və hesabın bərpası yalnız dəstək xidmətinə müraciətlə mümkündür.",
    ],
  },
  {
    h: "Kuki (cookie) və oxşar texnologiyalar",
    p: [
      "Platforma yalnız işləmə üçün zəruri kukilərdən istifadə edir: sessiya və giriş tokenləri (təhlükəsiz, HttpOnly) və dil seçimi. Üçüncü tərəf reklam və izləmə kukiləri istifadə olunmur.",
    ],
  },
  {
    h: "Təhlükəsizlik tədbirləri",
    p: [
      "Məlumatlar şifrələnmiş kanalla (HTTPS) ötürülür; şifrələr heşlənmiş, həssas klinik məzmun və təcili əlaqə məlumatları şifrələnmiş saxlanılır; çıxış rol əsaslı məhdudlaşdırılır; kritik əməliyyatlar audit jurnalına yazılır. Heç bir sistem mütləq təhlükəsizlik vəd edə bilməz; insident aşkarlandıqda Fanus qanunvericiliyə uyğun tədbir görür və zəruri hallarda istifadəçiləri məlumatlandırır.",
    ],
  },
  {
    h: "İstifadəçi hüquqları",
    p: [
      "İstifadəçi öz fərdi məlumatlarına dair bu hüquqlara malikdir: məlumatları ilə tanış olmaq; yanlış və ya köhnəlmiş məlumatın düzəldilməsini tələb etmək; silinməsini tələb etmək (qanuni saxlama öhdəlikləri istisna olmaqla); verilmiş razılığı istənilən vaxt geri götürmək (geri götürülməyə qədər aparılmış işlənmənin qanuniliyinə təsir etmir); marketinq bildirişlərindən imtina etmək.",
      "Bu hüquqlardan istifadə üçün şəxsi kabinetdəki parametrlərdən və ya rəsmi dəstək kanalından istifadə edilə bilər. Müraciətlər ağlabatan müddətdə cavablandırılır.",
    ],
  },
  {
    h: "Uşaqların məlumatları",
    p: [
      "18 yaşına çatmayan şəxslərin məlumatları yalnız qanuni nümayəndənin etibarlı razılığı əsasında və qüvvədə olan qanunvericiliyin tələblərinə uyğun işlənilir.",
    ],
  },
  {
    h: "Mütəxəssislərin öhdəlikləri",
    p: [
      "Mütəxəssislər müraciətçi məlumatlarını yalnız xidmət üçün zəruri həcmdə işləməyi, platformadan kənarda saxlamamağı və üçüncü şəxslərlə paylaşmamağı öhdələnir. Ətraflı tələblər Platformadan istifadə qaydalarının II bölməsində müəyyən olunub.",
    ],
  },
  {
    h: "Dəyişikliklər",
    p: [
      "Fanus bu siyasəti qanunvericilik və xidmət modelinə uyğun yeniləyə bilər. Əhəmiyyətli dəyişikliklər qüvvəyə minməzdən əvvəl saytda, şəxsi kabinetdə və ya e-poçt vasitəsilə bildirilir. Dəyişiklikdən sonra xidmətdən istifadə yeni redaksiyanın qəbul edilməsi sayılır.",
    ],
  },
  {
    h: "Əlaqə",
    p: [
      "Məxfiliklə bağlı sual və müraciətlər üçün Fanusun rəsmi dəstək kanalından istifadə edin: fanus.opc@gmail.com və ya saytdakı əlaqə forması. Bu siyasətə Azərbaycan Respublikasının qanunvericiliyi tətbiq olunur.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div style={{ background: "#F7FAFD", minHeight: "100vh", padding: "48px 20px 80px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* Başlıq */}
        <header style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{ margin: "0 0 10px", fontSize: 30, fontWeight: 800, letterSpacing: "-.02em", color: "var(--oxford, #082F6D)" }}>
            Məxfilik siyasəti
          </h1>
          <p style={{ margin: "0 0 14px", fontSize: 15, color: "#52718F" }}>
            Fərdi məlumatlarınız necə toplanır, istifadə olunur və qorunur
          </p>
          <span style={{ display: "inline-block", background: "#E8F0FC", color: "#1051B7", fontSize: 12.5, fontWeight: 700, padding: "6px 16px", borderRadius: 999 }}>
            Versiya 1.0 — 4 avqust 2026
          </span>
          <p style={{ margin: "18px auto 0", maxWidth: 620, fontSize: 14, lineHeight: 1.7, color: "#52718F" }}>
            Psixoloji dəstək etibar üzərində qurulur. Bu sənəd Fanusun məlumatlarınıza necə yanaşdığını
            açıq şəkildə izah edir və <Link href="/terms" style={{ color: "#1051B7", fontWeight: 700 }}>Platformadan istifadə qaydaları</Link> ilə
            birlikdə oxunmalıdır.
          </p>
        </header>

        {/* Bölmələr */}
        <article style={{ background: "#fff", border: "1px solid #E3ECF9", borderRadius: 18, padding: "34px 34px 38px", marginBottom: 26 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
            {SECTIONS.map((s, i) => (
              <section key={s.h}>
                <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "var(--oxford, #082F6D)" }}>
                  {i + 1}. {s.h}
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {s.p.map((para, j) => (
                    <p key={j} style={{ margin: 0, fontSize: 14.5, lineHeight: 1.75, color: "#33415C" }}>{para}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>

        <p style={{ textAlign: "center", fontSize: 13, color: "#52718F" }}>
          Sualınız var? <Link href="/contact" style={{ color: "#1051B7", fontWeight: 700 }}>Bizimlə əlaqə saxlayın</Link>
        </p>
      </div>
    </div>
  );
}
