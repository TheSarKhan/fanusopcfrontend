/**
 * Əhval seçimlərinin kod siyahısı.
 *
 * Əvvəl bu fayl əhvalı ixtisas kateqoriyasına bağlayan cədvəl (`MOOD_TO_CAT`) və
 * sərbəst mətndən kateqoriya təxmin edən regex (`deriveCategory`) saxlayırdı.
 * Tövsiyə məntiqi V133-də backend-ə köçdü və strukturlu mövzu teqlərinə əsaslanır,
 * ona görə hər ikisi silindi — uyğunluq artıq mətndən təxmin edilmir.
 *
 * Kodlar backend-dəki `Mood` enum-u ilə eyni olmalıdır.
 */

export type MoodId = "happy" | "anxious" | "sad" | "tired" | "angry" | "mixed" | "lonely";
