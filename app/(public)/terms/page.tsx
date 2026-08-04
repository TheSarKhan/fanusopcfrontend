import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Platformadan istifadə qaydaları – Fanus",
  description:
    "Fanus platformasında qeydiyyatdan və xidmətdən istifadə etməzdən əvvəl qəbul edilən qaydalar — müraciətçilər və mütəxəssislər üçün.",
};

// Hüquqi sənədin kanonik mətni Azərbaycan dilindədir (Versiya 1.0, 4 avqust 2026).
// Mənbə: "Fanus_Istifade_Qaydalari.pdf" — mətn olduğu kimi köçürülüb.

const PATIENT_RULES: { h: string; p: string }[] = [
  { h: "Qaydaların predmeti və qəbulu", p: "Bu qaydalar Fanus veb-saytı, tətbiqi, operator xidməti, onlayn seanslar, paketlər, psixoloji testlər, məqalələr və digər funksiyalardan istifadəni tənzimləyir. Qeydiyyat zamanı təsdiq xanasının işarələnməsi elektron razılıq hesab olunur." },
  { h: "Fanusun rolu", p: "Fanus müraciətçi ilə müstəqil fəaliyyət göstərən mütəxəssisi bir araya gətirən elektron vasitəçi platformadır. Psixoloji xidmət mütəxəssis tərəfindən öz adından və peşə məsuliyyəti ilə göstərilir. Fanus müalicə müəssisəsi, təcili yardım xidməti və ya mütəxəssisin işəgötürəni deyil." },
  { h: "Təsdiqlənmiş mütəxəssislər", p: "Təsdiq nişanı olan mütəxəssislərin şəxsiyyət, ali təhsil və təqdim etdikləri peşə sənədləri Fanusun yoxlama prosedurundan keçib. Təcrübə və fəaliyyət istiqamətləri profildə ayrıca göstərilir. Fanus yalnız təsdiq nişanının verilməsi üçün nəzərdə tutulan sənəd yoxlamasının aparıldığına görə məsuliyyət daşıyır; nişan mütəxəssisin gələcək davranışına, seçdiyi metoda və ya xidmətin nəticəsinə zəmanət deyil. Təsdiq nişanı olmayan profil Fanus tərəfindən təsdiqlənmiş mütəxəssis hesab edilmir." },
  { h: "Mütəxəssis seçimi və nəticə zəmanəti", p: "Müraciətçi mütəxəssisi profil məlumatları, ixtisaslaşma, dil, təcrübə, qiymət və uyğun vaxt əsasında özü seçir və ya platformanın texniki uyğunlaşdırma imkanından yararlanır. Fanus konkret diaqnoz, müalicə, nəticə, uyğunluq və ya sağalma zəmanəti vermir. Peşəkar qiymətləndirmə, metod, tövsiyə və xidmətin nəticələri üzrə məsuliyyət mütəxəssisə aiddir." },
  { h: "Məlumat xarakterli məzmun", p: "Saytdakı məqalələr, testlər, videolar, sual-cavablar və digər materiallar ümumi məlumat məqsədi daşıyır; diaqnoz, fərdi müalicə planı, tibbi rəy və ya təcili yardım əvəzi deyil. Psixoloq dərman təyin etmir; dərmanla bağlı qərarlar müvafiq səlahiyyətli həkim tərəfindən verilməlidir." },
  { h: "Yaş həddi və məlumatların düzgünlüyü", p: "18 yaşına çatmayan şəxslər yalnız qanuni nümayəndənin etibarlı razılığı və qüvvədə olan qanunvericiliyin tələbləri ilə xidmətdən istifadə edə bilər. Müraciətçi qeydiyyat və xidmət zamanı doğru, aktual və tam məlumat verməlidir. Yanlış məlumat nəticəsində yaranan risk və zərərə görə məsuliyyət həmin məlumatı təqdim edən şəxsə aiddir." },
  { h: "Hesabın təhlükəsizliyi", p: "Hesab fərdidir və başqa şəxsə verilə bilməz. Şifrə, giriş kodu və cihaz təhlükəsizliyinin qorunması müraciətçinin məsuliyyətidir. İcazəsiz giriş şübhəsi yarandıqda Fanusa dərhal məlumat verilməlidir." },
  { h: "Tanışlıq görüşü", p: "Ödənişsiz və ya qısa tanışlıq görüşü yalnız tərəflərin tanış olması və əməkdaşlıq uyğunluğunun ilkin qiymətləndirilməsi üçündür; terapiya, diaqnostika və ya fərdi peşə məsləhəti hesab edilmir." },
  { h: "Rezervasiya və ödəniş", p: "Seans yalnız sistemdə təsdiqləndikdən və tələb olunan ödəniş tamamlandıqdan sonra rezerv edilmiş sayılır. Qiymət, müddət, paket şərtləri və mümkün platforma haqqı ödənişdən əvvəl göstərilir. Ödənişlər yalnız Fanusun göstərdiyi rəsmi kanallar vasitəsilə aparılmalıdır." },
  { h: "Seansın dəyişdirilməsi və ləğvi", p: "Müraciətçi seansın başlanmasına ən azı 24 saat qalmış şəxsi kabinetdən və ya Fanus operatorunun köməyi ilə vaxtı dəyişə və ya seansı ləğv edə bilər. Başlanmasına 24 saatdan az qalan seans ləğv edildikdə, dəyişdirildikdə və ya müraciətçi qoşulmadıqda seans keçirilmiş hesab olunur və ödəniş/paket hüququ geri qaytarılmır. Başlanmasına 24 saatdan az qalmış alınan seanslar rezervasiya anından etibarən ləğv edilə bilməz. Sistem sui-istifadənin qarşısını almaq üçün dəyişiklik sayına ağlabatan məhdudiyyət tətbiq edə bilər; hazırkı limit bir seans üzrə ən çox üç dəyişiklikdir." },
  { h: "Gecikmə və qoşulmama", p: "Müraciətçinin gecikməsi seansın bitmə vaxtını uzatmır. Mütəxəssis əvvəlcədən fərqli qayda bildirməyibsə, müraciətçi seansın başlanmasından 15 dəqiqə ərzində qoşulmadıqda seans istifadə edilmiş sayılır." },
  { h: "Mütəxəssisin seansa qatılmaması", p: "Mütəxəssis ən azı 24 saat əvvəl razılaşdırmadan seansı ləğv edər və ya seansa qatılmazsa, müraciətçinin seçiminə əsasən onun üçün münasib vaxtda ödənişsiz əvəz seansı təşkil edilir, başqa mütəxəssis təklif olunur və ya həmin seans üzrə ödənilmiş məbləğ/istifadə hüququ bərpa edilir. Təkrarlanan pozuntu mütəxəssisin platformadakı fəaliyyətinin dayandırılmasına səbəb ola bilər." },
  { h: "Paketlər", p: "Paketlər yalnız onları alan müraciətçi üçün nəzərdə tutulur, başqa şəxsə verilə və nağd pula dəyişdirilə bilməz. Başqa müddət açıq göstərilməyibsə, paket satınalma tarixindən bir il qüvvədədir. Müddət bitdikdən sonra istifadə edilməmiş seanslar qüvvədən düşür." },
  { h: "Geri ödəniş", p: "Müraciətçi paketdən heç bir seans istifadə etməyibsə, satınalmadan sonra 14 gün ərzində geri ödəniş tələb edə bilər. Paketdən istifadə başlanıbsa və satınalmadan üç ay keçməyibsə, istifadə olunmuş seanslar həmin tarixdə qüvvədə olan fərdi seans qiyməti ilə hesablanır, qalan məbləğ geri qaytarılır. Üç aydan sonra paket üzrə geri ödəniş verilmir; qanunvericilikdən irəli gələn məcburi hallar istisnadır. Geri ödəniş mümkün olduqda ilkin ödəniş vasitəsinə göndərilir və bankın emal müddəti tətbiq oluna bilər." },
  { h: "Mütəxəssisin dəyişdirilməsi", p: "Müraciətçi əməkdaşlığın uyğun olmadığını düşündükdə başqa mütəxəssis seçə bilər. Mütəxəssis platformadan ayrıldıqda, uzun müddət əlçatan olmadıqda və ya müraciətə 24 saat ərzində cavab vermədikdə Fanus alternativ mütəxəssis seçimini asanlaşdıra bilər." },
  { h: "Texniki şərtlər", p: "İnternet bağlantısı, kamera, mikrofon, cihaz və seans üçün sakit, məxfi mühitin təmin edilməsi müraciətçinin məsuliyyətidir. Fanus texniki xidmət və təhlükəsizlik məqsədilə platformanı müvəqqəti dayandıra bilər. Fanusun sistemindən qaynaqlanan və seansın keçirilməsinə mane olan təsdiqlənmiş nasazlıq olduqda seans yenidən planlaşdırılır və ya istifadə hüququ bərpa edilir." },
  { h: "Məxfilik və məlumatların qorunması", p: "Müraciətçinin şəxsiyyəti, əlaqə məlumatları, seans və sağlamlıqla bağlı məlumatları məxfi saxlanılır və Məxfilik siyasətinə uyğun işlənilir. Məlumatlar yalnız xidmətin göstərilməsi, ödəniş, təhlükəsizlik, hüquqi öhdəlik və açıq razılıqla göstərilən məqsədlər üçün istifadə olunur. Qanunun tələb etdiyi hallar, məhkəmə və səlahiyyətli dövlət orqanlarının qanuni tələbləri, həmçinin həyat və təhlükəsizlik üçün ciddi risk halları məxfiliyin qanuni istisnalarıdır." },
  { h: "Platformadan kənar əlaqə və ödəniş qadağası", p: "Müraciətçi və mütəxəssis telefon nömrəsi, şəxsi e-poçt, sosial şəbəkə hesabı, ünvan və digər birbaşa əlaqə məlumatlarını mübadilə etməməli, Fanus vasitəsilə yaranmış peşə münasibətini platformadan kənara daşımamalı və kənar ödəniş razılaşması etməməlidir. Texniki zərurət olduqda əlaqə yalnız Fanusun təsdiqlədiyi kanal və həcmdə qurula bilər." },
  { h: "Səs və görüntü qeydi", p: "Digər tərəfin ayrıca və əvvəlcədən yazılı razılığı olmadan seansın səs, video, ekran görüntüsü və ya mətn qeydi aparıla, saxlanıla, yayıla və üçüncü şəxslə paylaşıla bilməz." },
  { h: "Davranış qaydaları", p: "Təhqir, təhdid, təqib, ayrı-seçkilik, seksual məzmun, saxta məlumat, platformanın təhlükəsizliyinə müdaxilə, başqa şəxsin hesabından istifadə və qanunsuz fəaliyyət qadağandır. Pozuntu halında məzmun silinə, hesab məhdudlaşdırıla və ya üzvlüyə dərhal xitam verilə bilər." },
  { h: "Böhran və yüksək risk halları", p: "Fanus böhran müdaxiləsi, təcili tibbi yardım, hüquq-mühafizə xidməti və ya təhlükəsizliyə fasiləsiz nəzarət xidməti göstərmir. Mütəxəssis özünə və ya başqasına zərər, intihar, zorakılıq, ağır psixi pozuntu, istismar və ya digər ciddi təhlükə əlaməti müəyyən etdikdə onlayn xidmət dərhal dayandırılır; müraciətçi təcili tibbi yardım, fiziki tibb müəssisəsi, hüquq-mühafizə orqanı və ya digər aidiyyəti rəsmi quruma yönləndirilir və Fanusa yazılı məlumat verilir. Belə halda Fanus hesabı dərhal məhdudlaşdıra və ya üzvlüyə xitam verə bilər. Riskin peşəkar qiymətləndirilməsi, müraciətçinin məlumatlandırılması və yönləndirilməsi mütəxəssisin öhdəliyidir; qanunvericiliyin birbaşa Fanusun üzərinə qoyduğu məcburi öhdəliklər istisnadır." },
  { h: "Şikayət, rəy və moderasiya", p: "Müraciətçi xidmətlə bağlı şikayət və sübutları Fanusun rəsmi dəstək kanalına təqdim edə bilər. Rəylər təhqir, şəxsi məlumat, böhtan, reklam və qanunsuz məzmun baxımından moderasiya edilə bilər. Fanus şikayəti araşdırmaq üçün tərəflərdən məlumat tələb edə, müvəqqəti məhdudiyyət qoya və qayda pozuntusu təsdiqləndikdə tədbir görə bilər." },
  { h: "Hesabın dayandırılması və xitam", p: "Qaydaların pozulması, saxta sənəd və ya məlumat, təhlükəsizlik riski, ödəniş saxtakarlığı, platformadan kənar xidmət, təkrar şikayətlər və ya qanunsuz davranış halında Fanus xəbərdarlıq etmədən hesabı müvəqqəti dayandıra, məzmunu silə və ya üzvlüyə dərhal xitam verə bilər. Qüvvədə olan qanunvericiliklə qorunan geri ödəniş hüquqları saxlanılır." },
  { h: "Fors-major", p: "Elektrik və rabitə kəsintisi, genişmiqyaslı internet nasazlığı, təbii fəlakət, epidemiya, müharibə, dövlət qərarı və tərəflərin nəzarətindən kənar digər hallarda öhdəliklərin gecikməsinə görə tərəf məsuliyyət daşımır. Mümkün olduqda seans yenidən planlaşdırılır." },
  { h: "Qaydaların dəyişdirilməsi və bildiriş", p: "Fanus qanunvericilik, xidmət modeli və təhlükəsizlik tələblərinə uyğun olaraq qaydaları yeniləyə bilər. Əhəmiyyətli dəyişikliklər qüvvəyə minməzdən əvvəl saytda, şəxsi kabinetdə və ya qeydiyyat e-poçtu vasitəsilə bildirilir. Dəyişiklikdən sonra xidmətdən istifadə yeni redaksiyanın qəbul edilməsi sayılır." },
  { h: "Tətbiq olunan hüquq və mübahisələr", p: "Bu qaydalara Azərbaycan Respublikasının qanunvericiliyi tətbiq olunur. Mübahisə əvvəlcə Fanusun rəsmi dəstək kanalı ilə danışıqlar yolu ilə həll edilməyə çalışılır; razılıq əldə edilmədikdə məsələ aidiyyəti üzrə Azərbaycan Respublikasının səlahiyyətli məhkəməsində həll olunur. Fanus mütəxəssislə müraciətçi arasında peşəkar qərar, metod, davranış və xidmət nəticəsi ilə bağlı mübahisənin tərəfi deyil; bu sahələr üzrə məsuliyyət mütəxəssisə aiddir, qanunvericiliyin Fanus üçün müəyyən etdiyi məcburi məsuliyyət istisna olmaqla." },
];

const SPECIALIST_RULES: { h: string; p: string }[] = [
  { h: "Qaydaların qəbulu", p: "Mütəxəssis qeydiyyat və fəaliyyət zamanı bu qaydaları, Fanusun Etika kodeksini, Məxfilik siyasətini, ödəniş və platforma şərtlərini qəbul edir. Elektron təsdiq yazılı razılıqla eyni qüvvəyə malikdir." },
  { h: "Müstəqil peşəkar status", p: "Mütəxəssis xidmətini öz adından, müstəqil və öz peşə məsuliyyəti ilə göstərir. Bu münasibət əmək müqaviləsi, nümayəndəlik, ortaqlıq və ya Fanus adından tibbi/psixoloji xidmət göstərmək səlahiyyəti yaratmır." },
  { h: "Sənədlər və təsdiq nişanı", p: "Mütəxəssis şəxsiyyət, ali təhsil, ixtisas, sertifikat, iş təcrübəsi və fəaliyyət icazələri barədə doğru, aktual və yoxlanıla bilən sənədlər təqdim etməlidir. Təsdiq nişanı sənəd yoxlamasının tamamlandığını göstərir; sənədin müddəti bitdikdə, status dəyişdikdə və ya məlumat yeniləndikdə mütəxəssis Fanusa dərhal məlumat verməlidir. Saxta və ya yanıltıcı məlumat profilin dərhal silinməsi və üzvlüyə xitam üçün əsasdır." },
  { h: "Peşə səriştəsi", p: "Mütəxəssis yalnız təhsili, təcrübəsi və qanuni səlahiyyəti daxilində xidmət göstərməli, elmi əsaslı yanaşmalardan istifadə etməli və peşə sərhədlərini qorumalıdır. Öz səriştəsini aşan hallarda xidməti davam etdirməməli və müraciətçini uyğun səlahiyyətli mütəxəssisə və ya quruma yönləndirməlidir. Psixoloq dərman təyin edə bilməz." },
  { h: "Peşə və hüquqi məsuliyyət", p: "Diaqnostik qiymətləndirmə, metod seçimi, müdaxilə, tövsiyə, qeydlər, məxfilik qərarları, yönləndirmə, müraciətçi ilə davranış və xidmət nəticələri üzrə tam peşə və hüquqi məsuliyyət mütəxəssisə aiddir. Fanus bu qərarlara müdaxilə etmir və mütəxəssislə müraciətçi arasındakı peşəkar və hüquqi mübahisənin tərəfi deyil; qanunvericiliyin birbaşa Fanusun üzərinə qoyduğu məcburi öhdəliklər istisnadır." },
  { h: "Məlumatlandırılmış razılıq", p: "Mütəxəssis xidmət başlamazdan əvvəl müraciətçiyə xidmətin mahiyyəti, mümkün sərhədləri, müddəti, ödənişi, məxfilik və onun istisnaları, onlayn xidmətin texniki riskləri və zəruri yönləndirmə halları barədə aydın məlumat verməlidir." },
  { h: "Məxfilik və məlumat təhlükəsizliyi", p: "Mütəxəssis müraciətçinin şəxsiyyəti, əlaqə, seans, sağlamlıq və digər fərdi məlumatlarını məxfi saxlamalı, yalnız xidmət üçün zəruri həcmdə işləməli və təhlükəsiz mühitdə qorumalıdır. Məlumatlar şəxsi cihazda, buludda və ya kağızda qanunsuz saxlanıla, üçüncü şəxslə paylaşıla və başqa məqsədlə istifadə edilə bilməz. Qanuni istisna yarandıqda açıqlama yalnız zəruri minimum həcmdə edilməlidir." },
  { h: "Əlaqə məlumatlarının mübadiləsi və platformadan kənar xidmət", p: "Mütəxəssis müraciətçidən və ya müraciətçiyə telefon nömrəsi, şəxsi e-poçt, sosial şəbəkə hesabı, ünvan və digər birbaşa əlaqə məlumatı istəyə və verə bilməz; Fanus vasitəsilə yaranmış münasibəti platformadan kənar seans və ödənişə yönləndirə bilməz. Texniki və ya hüquqi zərurət olduqda əlaqə yalnız Fanusun təsdiqlədiyi kanal və həcmdə qurulur." },
  { h: "Cədvəl və cavablandırma", p: "Mütəxəssis yalnız real əlçatan olduğu vaxtları açmalı, cədvəlini aktual saxlamalı və yeni müraciətə mümkün qədər tez, ən gec 24 saat ərzində cavab verməlidir. Davamlı əlçatmazlıq əvvəlcədən Fanusda qeyd olunmalıdır." },
  { h: "Seansın dəyişdirilməsi və ləğvi", p: "Mütəxəssis seansı dəyişdirmək və ya ləğv etmək istəyirsə, bunu seansın başlanmasına ən azı 24 saat qalmış müraciətçi və Fanus operatoru ilə razılaşdırmalıdır. Dəyişiklik birtərəfli qaydada edilə bilməz." },
  { h: "Mütəxəssisin qatılmaması", p: "Mütəxəssis ən azı 24 saat əvvəl razılaşdırmadan seansa qatılmazsa və ya seansı ləğv edərsə, müraciətçi üçün onun münasib hesab etdiyi vaxtda ödənişsiz əvəz seansı keçirməlidir. Müraciətçi başqa mütəxəssis və ya ödəniş/istifadə hüququnun bərpasını seçərsə, Fanusun qərarına uyğun əməkdaşlıq edilməlidir. Təkrarlanan pozuntu profilin dayandırılması və ya dərhal silinməsi ilə nəticələnə bilər." },
  { h: "Dəqiqlik və texniki şərait", p: "Mütəxəssis seansa vaxtında qoşulmalı, işlək internet, kamera, mikrofon, təhlükəsiz cihaz və kənar şəxslərin eşitmədiyi peşəkar mühit təmin etməlidir. Mütəxəssisin texniki hazırlıqsızlığı səbəbindən seans baş tutmazsa, müraciətçiyə ödənişsiz əvəz seansı təqdim olunur." },
  { h: "Qeyd və yazıların aparılması", p: "Müraciətçinin ayrıca, əvvəlcədən və məlumatlandırılmış yazılı razılığı olmadan seansın səs, video və ekran qeydi aparıla bilməz. Peşə qeydləri yalnız qanuni, zəruri və təhlükəsiz şəkildə saxlanmalı, saxlanma müddəti bitdikdə təhlükəsiz silinməlidir." },
  { h: "Peşə sərhədləri", p: "Mütəxəssis müraciətçi ilə romantik, seksual, istismar xarakterli, maliyyə maraqlı və ya peşə qərarına təsir edən ikili münasibət qura bilməz. Təhqir, təhdid, ayrı-seçkilik, dini-siyasi təzyiq, şəxsi məhsul və xidmət reklamı, borc və hədiyyə tələbi qadağandır." },
  { h: "Testlər və müəllif hüquqları", p: "Mütəxəssis yalnız istifadə hüququna və səriştəsinə malik olduğu test, metod, məqalə, şəkil və digər materiallardan istifadə etməlidir. Test nəticələri diaqnoz kimi təqdim edilməməli, nəticənin sərhədləri müraciətçiyə izah olunmalıdır. Müəllif hüququ pozuntusuna görə məsuliyyət materialı yükləyən mütəxəssisə aiddir." },
  { h: "İctimai məzmun və rəylər", p: "Profil, məqalə, video, şərh və cavablarda sübutsuz sağalma və nəticə vədi, yanlış peşə adı, gizli reklam, qorxuducu dil və müraciətçini müəyyən edən məlumat istifadə edilə bilməz. Mütəxəssis rəyə cavab verərkən şəxsin Fanusdan xidmət aldığını təsdiqləyən və ya seans məzmununu açıqlayan məlumat paylaşmamalıdır." },
  { h: "Yetkinlik yaşına çatmayan şəxslər", p: "18 yaşına çatmayan şəxslərlə xidmət yalnız qanuni nümayəndənin etibarlı razılığı və tətbiq olunan hüquqi-peşə tələbləri əsasında göstərilə bilər. Razılığın mövcudluğunu və xidmətin uyğunluğunu qiymətləndirmək mütəxəssisin məsuliyyətidir." },
  { h: "Böhran və yüksək risk halları", p: "Mütəxəssis özünə və ya başqasına zərər, intihar, zorakılıq, ağır psixi pozuntu, istismar və ya digər ciddi təhlükə əlaməti gördükdə riski peşəkar qaydada qiymətləndirməli, onlayn xidməti dərhal dayandırmalı, müraciətçiyə təcili tibbi yardım, fiziki tibb müəssisəsi, hüquq-mühafizə orqanı və ya digər aidiyyəti rəsmi quruma müraciət etməyi aydın şəkildə bildirməli və hadisə barədə Fanusa dərhal yazılı məlumat verməlidir. Qanunun icazə verdiyi və ya tələb etdiyi halda qanuni nümayəndə və aidiyyəti qurum məlumatlandırılır. Bu addımların vaxtında və düzgün yerinə yetirilməsinə görə məsuliyyət mütəxəssisə aiddir. Belə halda Fanus onlayn xidməti və üzvlüyü dərhal dayandıra bilər." },
  { h: "Şikayət və araşdırma ilə əməkdaşlıq", p: "Mütəxəssis şikayət, təhlükəsizlik hadisəsi, ödəniş mübahisəsi və ya hüquqi sorğu üzrə Fanusun qanuni və əsaslandırılmış araşdırması ilə əməkdaşlıq etməli, tələb edilən məlumatı məxfilik və minimum açıqlama prinsipinə uyğun təqdim etməlidir. Araşdırma müddətində profil müvəqqəti dayandırıla bilər." },
  { h: "Qiymət, ödəniş və platforma haqqı", p: "Mütəxəssis qiymət və paket məlumatlarını doğru göstərməli, Fanusun ödəniş, komissiya, geri qaytarma və hesablaşma qaydalarına əməl etməlidir. Müraciətçidən platformada göstərilməyən əlavə ödəniş tələb edilə bilməz." },
  { h: "Profilin dayandırılması və dərhal silinməsi", p: "Saxta sənəd, səlahiyyətsiz fəaliyyət, məxfilik pozuntusu, platformadan kənar ödəniş və əlaqə, təqib və istismar, təhlükəli peşə fəaliyyəti, böhran qaydasına əməl etməmə, təkrar seans pozuntusu, ciddi şikayət və ya qanunsuz davranış halında Fanus xəbərdarlıq etmədən profili məhdudlaşdıra, dayandıra, dərhal silə və üzvlüyə xitam verə bilər. Bu tədbir mütəxəssisin müraciətçi və dövlət orqanları qarşısındakı məsuliyyətini aradan qaldırmır." },
  { h: "Fors-major", p: "Tərəflərin nəzarətindən kənar hadisə seansın keçirilməsinə mane olduqda mütəxəssis Fanusa və müraciətçiyə mümkün qədər tez məlumat verməli, seansın yenidən planlaşdırılması üçün əməkdaşlıq etməlidir." },
  { h: "Qaydaların yenilənməsi", p: "Fanus qanunvericilik, xidmət və təhlükəsizlik tələblərinə uyğun olaraq qaydaları yeniləyə bilər. Əhəmiyyətli dəyişikliklər mütəxəssisə elektron qaydada bildirilir. Dəyişiklikdən sonra platformada fəaliyyət yeni redaksiyanın qəbul edilməsi sayılır." },
  { h: "Tətbiq olunan hüquq və mübahisələr", p: "Bu qaydalara Azərbaycan Respublikasının qanunvericiliyi tətbiq olunur. Mübahisə əvvəlcə Fanusun rəsmi kanalı ilə danışıqlar yolu ilə həll edilməyə çalışılır; razılıq əldə edilmədikdə məsələ aidiyyəti üzrə Azərbaycan Respublikasının səlahiyyətli məhkəməsində həll olunur." },
];

function RuleList({ rules, sectionNo }: { rules: { h: string; p: string }[]; sectionNo: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {rules.map((r, i) => (
        <section key={r.h}>
          <h3 style={{ margin: "0 0 6px", fontSize: 16.5, fontWeight: 700, color: "var(--oxford, #082F6D)" }}>
            {sectionNo}.{i + 1}. {r.h}
          </h3>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.75, color: "#33415C" }}>{r.p}</p>
        </section>
      ))}
    </div>
  );
}

export default function TermsPage() {
  return (
    <div style={{ background: "#F7FAFD", minHeight: "100vh", padding: "48px 20px 80px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* Başlıq */}
        <header style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{ margin: "0 0 10px", fontSize: 30, fontWeight: 800, letterSpacing: "-.02em", color: "var(--oxford, #082F6D)" }}>
            Fanus platformasından istifadə qaydaları
          </h1>
          <p style={{ margin: "0 0 14px", fontSize: 15, color: "#52718F" }}>
            Müraciətçilər və mütəxəssislər üçün
          </p>
          <span style={{ display: "inline-block", background: "#E8F0FC", color: "#1051B7", fontSize: 12.5, fontWeight: 700, padding: "6px 16px", borderRadius: 999 }}>
            Versiya 1.0 — 4 avqust 2026
          </span>
          <p style={{ margin: "18px auto 0", maxWidth: 620, fontSize: 14, lineHeight: 1.7, color: "#52718F" }}>
            Bu sənəd Fanus platformasında qeydiyyatdan və xidmətdən istifadə etməzdən əvvəl qəbul edilən
            qaydaları müəyyən edir. Qeydiyyat zamanı təsdiq xanasının işarələnməsi elektron razılıq hesab olunur.
          </p>
          {/* Bölmə naviqasiyası */}
          <nav style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
            <a href="#muracietciler" style={{ background: "#fff", border: "1px solid #D6E2F7", borderRadius: 999, padding: "8px 18px", fontSize: 13, fontWeight: 700, color: "#1051B7", textDecoration: "none" }}>
              I. Müraciətçilər üçün
            </a>
            <a href="#mutexessisler" style={{ background: "#fff", border: "1px solid #D6E2F7", borderRadius: 999, padding: "8px 18px", fontSize: 13, fontWeight: 700, color: "#1051B7", textDecoration: "none" }}>
              II. Mütəxəssislər üçün
            </a>
          </nav>
        </header>

        {/* I hissə */}
        <article id="muracietciler" style={{ background: "#fff", border: "1px solid #E3ECF9", borderRadius: 18, padding: "34px 34px 38px", marginBottom: 26, scrollMarginTop: 90 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 21, fontWeight: 800, color: "var(--oxford, #082F6D)" }}>
            I. Müraciətçilər üçün istifadə qaydaları
          </h2>
          <p style={{ margin: "0 0 26px", fontSize: 13.5, color: "#52718F", lineHeight: 1.6 }}>
            Fanusda hesab yaradan, seans sifariş edən və ya platformanın digər imkanlarından istifadə edən
            hər bir şəxs bu qaydaları qəbul etmiş sayılır.
          </p>
          <RuleList rules={PATIENT_RULES} sectionNo="I" />
        </article>

        {/* II hissə */}
        <article id="mutexessisler" style={{ background: "#fff", border: "1px solid #E3ECF9", borderRadius: 18, padding: "34px 34px 38px", marginBottom: 26, scrollMarginTop: 90 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 21, fontWeight: 800, color: "var(--oxford, #082F6D)" }}>
            II. Mütəxəssislər üçün fəaliyyət qaydaları
          </h2>
          <p style={{ margin: "0 0 26px", fontSize: 13.5, color: "#52718F", lineHeight: 1.6 }}>
            Fanusda profil yaradan, təsdiq nişanı alan, müraciətçi qəbul edən və ya peşəkar məzmun paylaşan
            hər bir mütəxəssis bu qaydalara əməl etməlidir.
          </p>
          <RuleList rules={SPECIALIST_RULES} sectionNo="II" />
        </article>

        <p style={{ textAlign: "center", fontSize: 13, color: "#52718F" }}>
          Bax həmçinin: <Link href="/privacy" style={{ color: "#1051B7", fontWeight: 700 }}>Məxfilik siyasəti</Link>
          {" "}· Sualınız var? <Link href="/contact" style={{ color: "#1051B7", fontWeight: 700 }}>Bizimlə əlaqə saxlayın</Link>
        </p>
      </div>
    </div>
  );
}
