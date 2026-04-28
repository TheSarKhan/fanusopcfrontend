# Fanus – Multi-Role Platform Expansion Plan

## Context

**Where we are:** Fanus hazırda bir Next.js landing + Spring Boot backend + admin CMS panelidir. Pasiyent anonim formada randevu göndərir, psixoloqlar isə statik kontent kimi mövcuddur (User-ə bağlı deyil). Tək `ADMIN` rolu var.

**Where we're going:** Real biznes platforması — pasiyent qeydiyyat olur, psixoloq müraciət edib təsdiq alır, real time-slot əsasında randevu sistemi, psixoloqun öz paneli, məqalə müəllifliyi və email/in-app bildirişlər.

**Why phased:** Tam scope (ads + premium + AI inteqrasiyası daxil) çox böyükdür — fazalı təhvil ilə hər mərhələdə işləyən, sınanmış, biznesə dəyər verən modul çatdırırıq. MVP 4-6 həftədə ortaya çıxır; sonra premium/ads V2-də əlavə olunur.

**Decisions captured (user input):**
- **Phasing:** MVP + V2. Ads/premium V2-yə salınır, indi DB səviyyəsində hazırlanır
- **Time-slot model:** Həftəlik təkrarlanan saatlar (Bazar ertəsi 10:00-13:00 kimi şablonlar)
- **Email provider:** SendPulse (primary) + Gmail SMTP (fallback). `EmailService` abstraksiyası ilə hər ikisini dəstəkləmə
- **Monetization:** V2 (Phase 7+); MVP-də psychologist hesabı `plan=FREE` kimi başlayır
- **Roles:** 4 rol — PATIENT, PSYCHOLOGIST, **OPERATOR** (yeni: pasiyent müraciətlərini psixoloqlara yönləndirir), ADMIN
- **Subdomain ayrılığı:** Hər panelin öz subdomain-i var (`patient.fanus.com`, `psychologist.fanus.com`, `operator.fanus.com`, `admin.fanus.com`); public sayt `fanus.com`-da qalır

---

## Goals (success = bunlar olur)

1. **Pasiyent uçdan-uca:** qeydiyyat → email təsdiqi → psixoloq seçimi → time-slot ilə randevu → email bildirişi alır
2. **Psixoloq uçdan-uca:** müraciət → admin təsdiq → giriş məlumatları alır → öz panelində randevuları görür → məqalə yazıb dərc edir
3. **Operator (triage):** gələn pasiyent müraciətlərini görür, problemi/profili psixoloq ixtisası ilə uyğunlaşdırıb assign edir, status izləyir
4. **Admin (sistem sahibi):** psixoloq müraciətlərini təsdiqləyir, kontent CMS-i idarə edir, operator hesabları yaradır, statistikaya baxır

---

## Non-Goals (bu planda yoxdur)

- AI tövsiyə motoru (V3+)
- Real-time chat (V3+)
- Mobil tətbiq (yalnız responsive web)
- Video seans inteqrasiyası (kənar həllər tövsiyə olunur, məs. Jitsi/Zoom link əl ilə)
- Çoxdilli sayt (yalnız azərbaycan dili)

---

## Architecture Decisions

| Sahə | Qərar | Səbəb |
|---|---|---|
| Stack | Mövcud Spring Boot + Next.js saxlanılır | İşləyir, yeni texnologiya gətirmirik |
| Auth | JWT genişləndirilir: claim-ə `userId` + `role` (PATIENT/PSYCHOLOGIST/OPERATOR/ADMIN) əlavə | Mövcud altyapı uyğundur |
| Token storage | localStorage → **HTTP-only cookie** (`Domain=.fanus.com`) | Subdomain-lər arası SSO; XSS qoruması yaxşıdır |
| Roles | Spring `@PreAuthorize("hasRole('PSYCHOLOGIST')")` per endpoint | Sadə, tanış |
| Subdomain | **Single Next.js app + middleware rewrite** (host header → URL prefix) | Bir codebase, bir build; kod paylaşımı, ayrıca deployment yox |
| Email | `EmailService` interfeysi → `SendPulseEmailProvider` + `GmailEmailProvider` | Provider switch konfiqurasiya ilə |
| Time-slot | Recurring (day_of_week + start_time + end_time) + per-booking lock | Sadə model, race condition `@Transactional` ilə həll |
| File storage | Hələlik local filesystem (`uploads/`) | S3/MinIO V2-də |
| Notifications | DB-də `notifications` cədvəli + email queue (background `@Scheduled` job) | Redis-i mövcud kullandığımız üçün queue Redis-ə qoymuruq, sadə DB polling kifayət edir |
| Frontend | Server components data-fetch üçün, client components form/state üçün (mövcud pattern) | Konsistent qalır |

---

## Role Responsibilities (4 rol)

| Rol | İcazələr | Panel |
|---|---|---|
| **PATIENT** | Profil idarəetmə, psychologist axtarışı, randevu booking (öz adından), favorites, randevu history | `patient.fanus.com` |
| **PSYCHOLOGIST** | Öz randevuları (assign edilmiş), öz time-slot-ları, öz məqalələri (CRUD), öz profili | `psychologist.fanus.com` |
| **OPERATOR** | Bütün müraciətlərə baxış, müraciəti psixoloqa **assign etmə** (triage), status update, qeyd əlavə, pasiyentə zəng/WhatsApp linki, **kontent yaratmır** | `operator.fanus.com` |
| **ADMIN** | Hər şey: psychologist application approve/reject, operator hesablarını yaratmaq, kontent CMS (psychologists, blog, FAQ, testimonial, stats), site config, statistika, override hər hansı operator/psychologist əməliyyatı | `admin.fanus.com` |

**Vacib məntiq ayrılığı:**
- **OPERATOR ≠ ADMIN.** Operator yalnız **müraciət triage**-i ilə məşğuldur, sistem konfiqurasiyasına və ya kontentə toxuna bilməz
- **Psychologist application approval** ADMIN-dədir (operator yox) — keyfiyyət/etibar üçün vacibdir
- Admin operator-a aid bütün əməliyyatları edə bilər (admin = superuser); operator admin əməliyyatlarına edə bilməz

---

## Subdomain Architecture

**Routing strategy:** Single Next.js app, `middleware.ts` host header oxuyur və yol prefiksini rewrite edir.

```
fanus.com / www.fanus.com  →  / (public marketing + blog + booking)
patient.fanus.com          →  rewrite to /patient/* (PATIENT roluna məhdud)
psychologist.fanus.com     →  rewrite to /panel/*   (PSYCHOLOGIST roluna məhdud)
operator.fanus.com         →  rewrite to /operator/* (OPERATOR roluna məhdud)
admin.fanus.com            →  rewrite to /admin/*    (ADMIN roluna məhdud)
```

**İstifadəçi `psychologist.fanus.com`-a daxil olur:**
- Login olmayıbsa → `psychologist.fanus.com/login` (eyni subdomain-də)
- Login olubsa amma rolu PSYCHOLOGIST deyilsə → `403 Forbidden` səhifəsi
- Login olub və rolu PSYCHOLOGIST-dirsə → `psychologist.fanus.com/dashboard` (`/panel/dashboard`-a rewrite)

**DNS & SSL tələbləri:**
- Wildcard A/CNAME: `*.fanus.com → server IP`
- Wildcard SSL: `*.fanus.com` (Cloudflare avtomatik verir, yoxsa Let's Encrypt DNS-01 challenge ilə)

**Auth cross-subdomain:**
- JWT access + refresh tokens **HTTP-only cookie** olur, `Domain=.fanus.com`
- Bütün subdomain-lər eyni cookie oxuyur — bir dəfə login etdin, hamısı işləyir
- CSRF qoruması: SameSite=Lax + Origin/Referer check

**Backend CORS yenilənir:**
- `app.cors.allowed-origins` → `https://fanus.com,https://www.fanus.com,https://patient.fanus.com,https://psychologist.fanus.com,https://operator.fanus.com,https://admin.fanus.com`
- Və ya Spring `addAllowedOriginPattern("https://*.fanus.com")`
- API yeri: `api.fanus.com` (subdomain) — bütün frontends bura çağırır

**Local dev:**
- `lvh.me` (always resolves to 127.0.0.1) ilə işləyir: `psychologist.lvh.me:3000`
- Və ya `/etc/hosts`-a manual əlavə

---

## Roadmap

### Phase 1 — Foundation: Multi-Role Auth + Subdomain Routing (~2 həftə)

**Goal:** 4 rol (PATIENT, PSYCHOLOGIST, OPERATOR, ADMIN) əlavə olunur, pasiyent qeydiyyatı işləyir, subdomain routing qurulur, cookie-based cross-subdomain auth.

**Backend:**
- `V4__add_user_roles.sql`: `users` cədvəlinə `first_name`, `last_name`, `phone`, `email_verified`, `email_verification_token`, `verification_expires_at`, `last_login`, `updated_at` əlavə; `role` constraint genişləndirilir (`PATIENT | PSYCHOLOGIST | OPERATOR | ADMIN`)
- `V5__create_patients.sql`: `patients` cədvəli (id, user_id FK, date_of_birth, created_at)
- `User.java` entity yenilənir: `role` enum (`UserRole.ADMIN | PATIENT | PSYCHOLOGIST | OPERATOR`)
- `Patient.java` entity yaradılır
- `PatientRepository`, `PatientService` (register, findByUserId, updateProfile)
- `JwtTokenProvider` claim-ə `userId` əlavə edir
- `AuthController` yenilənir:
  - `POST /api/auth/register/patient` (email, password, firstName, lastName, phone) → email təsdiqi göndərilir
  - `GET /api/auth/verify?token=...` → email təsdiqlənir
  - `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
  - `POST /api/auth/logout` → cookie clear + Redis-də refresh token revoke
- **Login response cookie qaytarır** (HTTP-only, Secure, Domain=.fanus.com, SameSite=Lax) — `accessToken` + `refreshToken`
- `JwtAuthFilter` cookie-dən token oxumağı dəstəkləyir (Authorization header də saxlanılır API client-lər üçün)
- `EmailService` interfeysi + `SendPulseEmailProvider` + `GmailEmailProvider` + Spring config switch (`app.email.provider=sendpulse|gmail`)
- Email template-lər: `patient-verification.html`, `patient-welcome.html`, `password-reset.html` (`resources/templates/email/`)
- **Admin endpoint:** `POST /api/admin/operators` (admin operator hesabı yaradır — ADMIN əl ilə yaradır, qeydiyyat formu yox)
- CORS config wildcard subdomain dəstəyi (`https://*.fanus.com`)
- V2.5__create_admin_user.sql migration-a OPERATOR seed (1 ədəd test operator: `operator@fanus.az`)

**Frontend:**
- **`middleware.ts` tam yenilənir** — host header oxuyur, subdomain → path prefix rewrite + role-based access:
  ```
  patient.* → /patient/*       (require PATIENT)
  psychologist.* → /panel/*    (require PSYCHOLOGIST)
  operator.* → /operator/*     (require OPERATOR)
  admin.* → /admin/*           (require ADMIN)
  fanus.com → /                (public, no auth required)
  ```
- Hər subdomain üçün öz login səhifəsi (eyni `/login` route, sadəcə kontekst fərqlidir)
- `app/(auth)/login/page.tsx` — login formu (cookie-based, redirect öz subdomain-in dashboard-una)
- `app/(public)/register/page.tsx` — pasiyent qeydiyyat (yalnız `fanus.com`-da)
- `app/(public)/verify/page.tsx`, `app/(public)/forgot-password/page.tsx`
- `app/patient/profile/page.tsx` — pasiyent profil
- `app/patient/layout.tsx` — pasiyent panel layout (sidebar)
- `lib/api.ts` — fetch credentials: 'include' (cookie göndərmək üçün); `registerPatient`, `verifyEmail`, `requestPasswordReset`
- `Navbar` (public) → "Daxil ol / Qeydiyyat" linki, role-based → öz panelinə redirect

**Verify (Phase 1 smoke test):**
1. Wildcard DNS qurulur (`lvh.me` ilə local test)
2. `psychologist.lvh.me:3000` açılır → login formu çıxır
3. `fanus.com/register` → email + parol → SendPulse log-da email görünür → verify link-ə klik
4. `patient.lvh.me:3000/login` → eyni cookie ilə avtomatik daxil olur (cross-subdomain SSO)
5. `psychologist.lvh.me:3000` (yox PSYCHOLOGIST-dur) → 403 səhifəsi
6. Admin manual `POST /api/admin/operators` ilə operator hesabı yaradır → operator email-də şifrə alır

---

### Phase 2 — Real Appointment System + Operator Panel (~2 həftə)

**Goal:** Anonim randevu modeli FK-ya əsaslanan sistemə çevrilir. Operator paneli qurulur — operator gələn müraciətləri psixoloqlara assign edir.

**Backend:**
- `V6__refactor_appointments.sql`:
  - `appointments` cədvəlinə əlavə: `patient_id BIGINT FK NULL`, `psychologist_id BIGINT FK NULL`, `time_slot_id BIGINT FK NULL`, `assigned_by_operator_id BIGINT FK NULL`, `assigned_at TIMESTAMP NULL`, `session_type VARCHAR(20)`, `operator_notes TEXT`, `private_notes TEXT` (psixoloq və pasiyent görür), `completed_at`, `cancelled_at`, `cancellation_reason TEXT`, `updated_at`
  - Köhnə `patient_name`, `phone`, `psychologist_name` saxlanılır (anonim booking üçün)
- `V7__create_time_slots.sql`: `psychologist_time_slots` (id, psychologist_id, day_of_week, start_time, end_time, is_active)
- `Appointment` entity yenilənir
- `TimeSlot` entity + repo + service
- `AppointmentService.bookForLoggedInPatient(patientId, psychologistId?, timeSlotId?, note)` — `@Transactional`, slot occupancy check
- **Status enum (yenilənmiş, operator vurğulu):**
  ```
  NEW (anonim/login pasiyent göndərib)
    → IN_REVIEW (operator baxır)
    → ASSIGNED (operator psixoloqa təyin edib)
    → CONFIRMED (psixoloq təsdiqlədi və ya pasiyent slot ilə razılaşdı)
    → COMPLETED | CANCELLED | NO_SHOW
  ```
- `POST /api/appointments` (public + auth) → status=NEW
- **Patient endpoints:**
  - `GET /api/patient/appointments` (öz randevuları)
  - `PUT /api/patient/appointments/{id}/cancel`
- **Operator endpoints (yeni):**
  - `GET /api/operator/appointments?status=NEW` — gələn yeni müraciətlər queue
  - `GET /api/operator/appointments/{id}` — detal (pasiyent qeyd, telefon, problem təsviri)
  - `PUT /api/operator/appointments/{id}/assign` (body: psychologistId, note) — operator psixoloqa təyin edir, status `ASSIGNED`
  - `PUT /api/operator/appointments/{id}/note` — operator qeyd əlavə edir
  - `PUT /api/operator/appointments/{id}/cancel` — operator imtina (səbəb ilə)
  - `GET /api/operator/psychologists` — bütün təsdiqlənmiş psixoloqlar (assignment üçün dropdown)
  - `GET /api/operator/dashboard` — bu gün NEW count, IN_REVIEW count, son 7 gün assign count
- **Psychologist endpoints (assign edilən randevular üçün):**
  - `GET /api/psychologist/appointments?status=ASSIGNED|CONFIRMED` — operator-dan gələnlər
  - `PUT /api/psychologist/appointments/{id}/confirm` — psixoloq təsdiqləyir
  - `PUT /api/psychologist/appointments/{id}/reject` — psixoloq imtina edir (səbəb ilə) → operator-a geri qayıdır

**Frontend:**
- `BookingModal` (public) — pasiyent psixoloq seçə bilər və ya seçməyə bilər (operator təyin edəcək)
- Slot picker: psychologist seçilibsə öz time-slot-ları, yoxsa pasiyent yalnız "təxmini tarix/vaxt" göstərir
- `app/patient/appointments/page.tsx` — pasiyent randevu history, status badge-ləri
- **Operator paneli (yeni):**
  - `app/operator/layout.tsx` — operator sidebar (Dashboard, Yeni Müraciətlər, Təyin Edilmişlər, Bütün Randevular)
  - `app/operator/page.tsx` — dashboard (queue counters, son 10 müraciət)
  - `app/operator/inbox/page.tsx` — yeni müraciət siyahısı (tab: NEW / IN_REVIEW)
  - `app/operator/inbox/[id]/page.tsx` — müraciət detallı görünüş + "Psixoloqa təyin et" modalı (psixoloq dropdown + operator note + təyin et button)
  - `app/operator/all/page.tsx` — bütün randevular filterli table
  - WhatsApp/zəng quick action: pasiyentin telefon nömrəsinə klik → `tel:` / `wa.me/`
- **Psychologist panel (genişləndirilmiş):**
  - `app/panel/appointments/page.tsx` — operator tərəfindən təyin edilmiş randevular, "Təsdiqlə / İmtina et" düymələri

**Verify:**
1. Anonim istifadəçi `BookingModal`-dan müraciət göndərir (psychologist seçmədən)
2. `operator.fanus.com/inbox` — operator onu görür, status NEW
3. Operator detail-ə girir, "Dr. Aysu Əliyeva"-ya təyin edir, qeyd yazır → status ASSIGNED
4. Psixoloq `psychologist.fanus.com/appointments` → öz panelində görür → "Təsdiqlə" → status CONFIRMED
5. Pasiyent `patient.fanus.com/appointments` → tarixçəsində görür

---

### Phase 3 — Psychologist Application + Admin Panel + Psychologist Panel (~2 həftə)

**Goal:** Psixoloq müraciət edir, **admin** (operator yox) təsdiq edir, sonra psixoloq öz panelində işləyir. Admin panel kontent CMS + sistem konfiqurasiyası ilə qalır.

**Backend:**
- `V8__psychologist_user_link.sql`:
  - `psychologists` cədvəlinə əlavə: `user_id BIGINT FK NULL UNIQUE`, `application_status VARCHAR(20) DEFAULT 'PENDING'`, `bio TEXT`, `education TEXT`, `languages TEXT[]`, `session_format VARCHAR(20)` (online/offline/both), `credentials_doc_urls TEXT[]`, `approved_at TIMESTAMP NULL`, `approval_notes TEXT`, `plan VARCHAR(20) DEFAULT 'FREE'` (V2 üçün hazır)
  - Köhnə seed psixoloqlar üçün `application_status='APPROVED'`, `user_id=NULL` qalır (legacy)
- `Psychologist.applicationStatus` enum: `PENDING | APPROVED | REJECTED | SUSPENDED`
- `POST /api/psychologists/apply` (anonim) — bütün məlumatlar + sertifikat upload
- `GET /api/admin/psychologist-applications?status=PENDING`
- `POST /api/admin/psychologist-applications/{id}/approve` — User yaradılır (rolu PSYCHOLOGIST), avtomatik şifrə generasiya, `approval-email.html` göndərilir
- `POST /api/admin/psychologist-applications/{id}/reject` — rejection email
- `GET /api/psychologist/dashboard` — gözləyən randevu sayı, bu ay seans sayı, son müraciətlər
- `GET /api/psychologist/appointments` — öz randevuları
- `PUT /api/psychologist/appointments/{id}` — status dəyişdir, private_notes əlavə
- `GET/PUT /api/psychologist/profile` — bio, time-slots, photo
- `GET/POST/PUT/DELETE /api/psychologist/articles/**`
- `GET/POST/PUT/DELETE /api/psychologist/time-slots/**`

**Frontend:**
- `app/psychologists/apply/page.tsx` (multi-step müraciət formu: şəxsi → təhsil → ixtisas → sənədlər upload)
- `app/admin/applications/page.tsx` (admin müraciət inbox-u, approve/reject button)
- `app/panel/layout.tsx` (psychologist sidebar — Dashboard, Randevular, Məqalələr, Cədvəl, Profil)
- `app/panel/page.tsx` (dashboard kartları)
- `app/panel/appointments/page.tsx` (table + status update modal + private notes)
- `app/panel/articles/page.tsx` + `app/panel/articles/[id]/edit/page.tsx`
- `app/panel/schedule/page.tsx` (həftəlik time-slot grid editor)
- `app/panel/profile/page.tsx` (bio, photo, ixtisas)
- `middleware.ts` genişləndirilir: `/panel/**` PSYCHOLOGIST roluna məhdudlaşır

**Verify:** Pulsuz mail ilə psixoloq müraciət göndərir → admin panelde görünür → "Approve" basır → psixoloqa email gəlir (giriş + təsdiq linki ilə) → psixoloq daxil olur → öz randevularını görür.

---

### Phase 4 — Article System v2 + Categories (~1 həftə)

**Goal:** Məqalələrin mülkiyyəti psixoloqa keçir, draft/publish, kateqoriya filteri, axtarış.

**Backend:**
- `V9__articles_v2.sql`:
  - `blog_posts` cədvəlinə əlavə: `psychologist_id BIGINT FK NULL`, `status VARCHAR(20) DEFAULT 'PUBLISHED'`, `view_count INT DEFAULT 0`, `content TEXT`, `cover_image_url TEXT`, `tags TEXT[]`, `updated_at TIMESTAMP`
  - `category` üçün enum constraint: `STRESS | ANXIETY | DEPRESSION | RELATIONSHIPS | SELF_GROWTH | FAMILY | OTHER`
- `BlogPostService.incrementViewCount(slug)` — `@Async` (race-safe `UPDATE ... SET view_count = view_count + 1`)
- `GET /api/blog-posts?category=...&search=...&author=...&sort=popular|recent` (public)
- `GET /api/blog-posts/{slug}` artıq tam content qaytarır + view increment
- `GET /api/psychologist/articles` (öz məqalələri, draft daxil)
- `POST /api/psychologist/articles` (status=DRAFT və ya PUBLISHED)
- `PUT /api/psychologist/articles/{id}` — yalnız öz məqaləsini redaktə (ownership check)

**Frontend:**
- `app/blog/page.tsx` filter genişləndirilir: kateqoriya + axtarış input + sort
- `app/blog/[slug]/page.tsx` (məqalə detail səhifəsi — content render, müəllif kart, "Bu psixoloqa randevu al" CTA, "Oxşar məqalələr" 3 ədəd)
- `app/panel/articles/page.tsx` (psychologist öz məqalələri table, status toggle)
- `app/panel/articles/new/page.tsx` (rich text editor — TipTap və ya Lexical, sadə Markdown da olar)
- `BlogPreview` komponenti view_count göstərir

**Verify:** Psixoloq panelinə daxil olur, "Yeni məqalə" yazır, draft saxlayır, sonra publish edir → ana səhifədə bloq preview-də görünür → klik → tam məqalə açılır → view counter artır.

---

### Phase 5 — Notifications + Email (~1 həftə)

**Goal:** Pasiyent və psixoloq event-lər üçün email + in-app bildiriş alır.

**Backend:**
- `V10__notifications.sql`: `notifications` (id, user_id FK, type VARCHAR(50), title, message, related_entity_type, related_entity_id, is_read BOOLEAN, email_sent BOOLEAN, created_at)
- `NotificationType` enum: `APPOINTMENT_NEW (operator-a), APPOINTMENT_ASSIGNED (psychologist-ə + patient-ə), APPOINTMENT_CONFIRMED, APPOINTMENT_REJECTED_BY_PSYCHOLOGIST (operator-a geri), APPOINTMENT_CANCELLED, APPOINTMENT_REMINDER_24H, ARTICLE_PUBLISHED, APPLICATION_APPROVED, APPLICATION_REJECTED, OPERATOR_ACCOUNT_CREATED`
- `NotificationService.create(userId, type, payload)` — DB-yə yazır + `EmailService.send` çağırır
- Event hooks (Spring `@EventListener` və ya birbaşa service çağırışı):
  - Appointment status change → patient + psychologist bildiriş
  - Application approved → psychologist bildiriş
  - Article published → (hələlik yox, V2-də followers olarsa)
- `@Scheduled(cron="0 0 * * * *")` job: 24 saat sonrasındakı təsdiqlənmiş randevular üçün xatırlatma göndər
- `GET /api/notifications` (current user-in son 50 bildirişi)
- `PUT /api/notifications/{id}/read`
- `PUT /api/notifications/read-all`

**Frontend:**
- Navbar-da bell icon + badge (oxunmamış sayı) + dropdown
- `app/notifications/page.tsx` (tam siyahı, filter: oxunmamış)
- Real-time yox, sadə polling (30 saniyə) və ya səhifə açıldıqda fetch
- Email template-ləri: `appointment-confirmed.html`, `appointment-reminder.html`, `appointment-cancelled.html`

**Verify:** Pasiyent randevu göndərir → həm pasiyent həm psixoloq bell-də 1 bildiriş görür + email logu var. Admin status `CONFIRMED`-ə dəyişir → hər iki tərəf yenidən bildiriş alır.

---

### Phase 6 — Patient Engagement (~1 həftə)

**Goal:** Pasiyentin platforma "evi" tam olur — favorites, contact form, WhatsApp redirect.

**Backend:**
- `V11__favorites_contacts.sql`:
  - `patient_favorites` (patient_id, psychologist_id, created_at, UNIQUE)
  - `contact_messages` (id, name, email, phone, subject, message, status, created_at) — anonim əlaqə formundan
- `POST/DELETE /api/patient/favorites/{psychologistId}`, `GET /api/patient/favorites`
- `POST /api/contact` (public, validation + rate-limit)
- `GET /api/admin/contact-messages`, `PUT /api/admin/contact-messages/{id}/status`

**Frontend:**
- Psixoloq kartında ürək ikonu (favorite toggle)
- `app/profile/favorites/page.tsx`
- `app/contact/page.tsx` (form + xəritə embed + iş saatları + WhatsApp link)
- `BookingModal` ilkin ekranda artıq mövcud "WhatsApp ilə müraciət" işlək — `wa.me/{phone}?text=...` linki
- Admin: `app/admin/messages/page.tsx`

**Verify:** Pasiyent "ürək" basır → seçilmişlərinə əlavə olunur. Anonim istifadəçi əlaqə formu doldurur → admin panelde görür.

---

### V2 — Monetization & Growth (sonra ayrıca planlaşdırılacaq)

**Bu plana DAXİL DEYİL, amma DB səviyyəsində hazırlanır:**
- `psychologists.plan` field (FREE/PREMIUM/VERIFIED) — Phase 3-də artıq əlavə olunub
- Featured/boost mexanizması (psychologist `featured_until TIMESTAMP`)
- Reklam sistemi: yeni `ad_banners` cədvəli, ana səhifə + bloq sidebar slot-ları
- Ödəniş integrasiyası: Stripe (beynəlxalq) və ya Azərbaycan bank API (Kapital, ABB)
- Subscription billing webhook + grace period
- Article boosting (psixoloqun pul ödəyib məqaləsini "Trend" bölməsinə qoyması)

V2 planlaması Phase 6 bitdikdən sonra ayrı sənədlə başlayır.

---

## Database Migration Map

| Migration | Phase | Məzmun |
|---|---|---|
| V4 | 1 | users genişləndirmə + role enum (PATIENT/PSYCHOLOGIST/OPERATOR/ADMIN) |
| V5 | 1 | patients yaradılması + 1 seed operator |
| V6 | 2 | appointments refactor (patient_id, psychologist_id, **assigned_by_operator_id**, operator_notes FK-ları) |
| V7 | 2 | psychologist_time_slots |
| V8 | 3 | psychologists user_id + application_status + plan |
| V9 | 4 | blog_posts → articles refactor |
| V10 | 5 | notifications (operator hadisələri daxil) |
| V11 | 6 | favorites + contact_messages |

Hər migration **backward compatible**: legacy seed psychologists `user_id=NULL`, anonim appointments `patient_id=NULL` qalır.

---

## Critical Files Reference

**Mövcud fayllar (genişləndiriləcək):**
- [User.java](backend/src/main/java/com/fanus/entity/User.java) — role enum-a, yeni field-lər
- [JwtTokenProvider.java](backend/src/main/java/com/fanus/security/JwtTokenProvider.java) — userId claim
- [SecurityConfig.java](backend/src/main/java/com/fanus/config/SecurityConfig.java) — yeni yol matchers
- [AuthController.java](backend/src/main/java/com/fanus/controller/AuthController.java) — register endpoints
- [Appointment.java](backend/src/main/java/com/fanus/entity/Appointment.java) — FK-lar
- [Psychologist.java](backend/src/main/java/com/fanus/entity/Psychologist.java) — user_id, application_status
- [BlogPost.java](backend/src/main/java/com/fanus/entity/BlogPost.java) — psychologist_id, status, view_count
- [lib/api.ts](frontend/lib/api.ts) — yeni client funksiyalar
- [middleware.ts](frontend/middleware.ts) — `/profile`, `/panel` route protection
- [BookingModal.tsx](frontend/components/BookingModal.tsx) — slot picker step
- [Navbar.tsx](frontend/components/Navbar.tsx) — auth state, bell icon

**Yeni fayllar (Phase 1 — auth + subdomain):**
- `backend/src/main/java/com/fanus/entity/Patient.java`
- `backend/src/main/java/com/fanus/service/PatientService.java`, `EmailService.java`, `SendPulseEmailProvider.java`, `GmailEmailProvider.java`
- `backend/src/main/resources/templates/email/*.html`
- `frontend/middleware.ts` (host header → subdomain rewrite + role check)
- `frontend/lib/auth.ts` (cookie-based token helpers)
- `frontend/app/(public)/register/page.tsx`, `verify/page.tsx`, `forgot-password/page.tsx`
- `frontend/app/(auth)/login/page.tsx` (universal login, redirects by role)
- `frontend/app/patient/layout.tsx`, `frontend/app/patient/profile/page.tsx`

**Yeni fayllar (Phase 2 — operator panel + appointments):**
- `backend/src/main/java/com/fanus/controller/OperatorController.java`
- `backend/src/main/java/com/fanus/controller/PatientController.java`, `PsychologistController.java`
- `backend/src/main/java/com/fanus/entity/TimeSlot.java`
- `backend/src/main/java/com/fanus/service/AppointmentAssignmentService.java`
- `frontend/app/operator/layout.tsx`, `page.tsx`, `inbox/page.tsx`, `inbox/[id]/page.tsx`, `all/page.tsx`

(Sonrakı fazaların yeni faylları phase açılışında detallı yazılır.)

---

## Reusable Patterns to Continue

- **Server component + Client component split:** Page.tsx server-side data fetch edir, ClientPage.tsx interactivity üçün — mövcud [app/psychologists/page.tsx](frontend/app/psychologists/page.tsx) və [PsychologistsPage.tsx](frontend/app/psychologists/PsychologistsPage.tsx) pattern-i
- **JWT + Redis refresh:** [RefreshTokenService.java](backend/src/main/java/com/fanus/security/RefreshTokenService.java) işləyir, sadəcə yeni rolları dəstəkləyir
- **Admin CRUD pattern:** mövcud `AdminController` + `xxxService` strukturu psychologist panel üçün də klonlanır (`PsychologistController` + ownership check)
- **Migration baseline:** Flyway baseline-on-migrate `true`, V4+ avtomatik tətbiq olur
- **Booking context:** [BookingContext.tsx](frontend/context/BookingContext.tsx) genişləndirilir (slot picking üçün state əlavə)

---

## Verification Strategy

Hər faza sonunda **smoke test** ssenarisi:

1. **Phase 1:** `lvh.me` ilə subdomain test (`patient.lvh.me:3000`) → qeydiyyat → verify → cookie set → `psychologist.lvh.me:3000` → 403 (rol uyğun deyil); cross-subdomain SSO işləyir; admin operator hesabı yaradır → operator email-də şifrə alır
2. **Phase 2:** Anonim pasiyent müraciət göndərir → `operator.fanus.com/inbox`-da görünür → operator psixoloqa təyin edir (qeyd ilə) → status ASSIGNED → psixoloq `psychologist.fanus.com/appointments`-də görür → "Təsdiqlə" basır → status CONFIRMED → pasiyent `patient.fanus.com/appointments`-də görür
3. **Phase 3:** Anonim psixoloq `fanus.com/psychologists/apply` formasını doldurur → `admin.fanus.com/applications`-da görünür → admin "Approve" basır → psixoloqa email gəlir (giriş + təsdiq linki) → psixoloq `psychologist.fanus.com`-a daxil olur
4. **Phase 4:** Psixoloq draft məqalə → publish → ana səhifə blog preview-də görünür → klik → view_count 1-ə yüksəlir
5. **Phase 5:** Randevu status dəyişir → həm patient həm psychologist bell-də 1 yeni bildiriş + email logu yaranır
6. **Phase 6:** "Ürək" basıq psychologist `/profile/favorites`-də görünür; əlaqə formu admin paneldə görünür

E2E avtomatik test (Playwright) hər faza sonunda 1 happy-path test əlavə edilir (`frontend/e2e/`).

---

## Risk Register

| Risk | Mitigation |
|---|---|
| Time-slot race condition (eyni slot 2 nəfərə) | `@Transactional` + `SELECT FOR UPDATE` slot row-da, və ya unique index `(psychologist_id, slot_date, time_slot_id)` |
| Email deliverability (SendPulse rate limit) | EmailService queue ilə işləyir, exponential backoff retry |
| Schema migration legacy data | Hər V4+ migration-da legacy rows üçün NULL/default qoyub backward compat saxlanır |
| Frontend bundle size (4 panel + auth) | Per-route code splitting Next.js automatically; hər panel öz layout-u ilə (`app/admin/`, `app/panel/`, `app/operator/`, `app/patient/`) |
| Auth complexity (4 rol + middleware + subdomain) | Vahid `frontend/lib/auth.ts` + `middleware.ts`-də cəmlənmiş routing: host → subdomain → role check, hər addım test ilə örtülür |
| Wildcard SSL local dev | `lvh.me` (auto resolves to 127.0.0.1) və ya `dnsmasq` ilə `*.fanus.test` |
| Cookie cross-subdomain CSRF | SameSite=Lax + Origin/Referer check; sensitive POST üçün CSRF token əlavə düşünülür |
| Operator yanlış psixoloqa təyin edir | Hər təyinatda operator notes məcburidir; psychologist "İmtina et + səbəb" funksiyası ilə geri qaytara bilir; admin override edə bilir |
| Time/scope blow-up | Hər faza max 2 həftə; bitirməsə next phase başlamır; user-ə demo göstər |

---

## Estimated Timeline

| Faza | Müddət | Kümulativ |
|---|---|---|
| Phase 1 (auth + subdomain) | 2 həftə | 2 |
| Phase 2 (appointments + operator panel) | 2 həftə | 4 |
| Phase 3 (psychologist app + admin + panel) | 2 həftə | 6 |
| Phase 4 (articles) | 1 həftə | 7 |
| Phase 5 (notifications) | 1 həftə | 8 |
| Phase 6 (engagement) | 1 həftə | 9 |
| **MVP TOTAL** | **~9 həftə** | |
| V2 (premium/ads) | 3-4 həftə | 12-13 |

İlk **6 həftə bitəndə** (Phase 1+2+3 tamam): real biznes platforması **launch-able** vəziyyətdədir:
- Pasiyent qeydiyyatdan keçir (`patient.fanus.com`), randevu göndərir
- Operator triage edir (`operator.fanus.com`), psixoloqa təyin edir
- Psixoloq müraciət edib admin təsdiqindən keçib (`admin.fanus.com`), öz panelinə girir (`psychologist.fanus.com`), randevuları idarə edir
