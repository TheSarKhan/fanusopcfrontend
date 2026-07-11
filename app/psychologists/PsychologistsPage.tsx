"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Deco from "@/components/Deco";
import Breadcrumb from "@/components/Breadcrumb";
import SessionRequestModal from "@/components/SessionRequestModal";
import type { Psychologist } from "@/lib/api";
import { withSlugs } from "@/lib/slug";
import { useT } from "@/lib/i18n/LocaleProvider";

interface Item {
  id: number;
  slug: string;
  name: string;
  title: string;
  bio?: string;
  photoUrl?: string;
}

const FALLBACK_BASE: Omit<Item, "slug">[] = [
  { id: 1, name: "Aysel Məmmədova", title: "Klinik psixoloq",      bio: "Narahatlıq, panik atak və OKD sahəsində 8 illik təcrübə. Koqnitiv-davranış terapiyası üzərində ixtisaslaşıb." },
  { id: 2, name: "Rəşad Quliyev",   title: "Travma terapevti",     bio: "Travma və TSSP mövzusunda 11 il təcrübə. EMDR metodundan istifadə edərək təhlükəsiz, addım-addım proses təklif edir." },
  { id: 3, name: "Lalə Hüseynova",  title: "Ailə terapevti",       bio: "Cütlük və ailə münasibətləri üzrə 6 illik təcrübə. Ünsiyyət və etibarın bərpası mövzusunda dəstək verir." },
  { id: 4, name: "Elnur Səfərov",   title: "Klinik psixoloq",      bio: "Depressiya və tükənmişlik (burnout) sahəsində 9 il təcrübə. Real həyat vərdişlərinə əsaslanan yanaşma tətbiq edir." },
  { id: 5, name: "Nigar Kazımova",  title: "Uşaq psixoloqu",       bio: "Yeniyetmələr və valideyn-övlad münasibətləri üzrə 7 illik təcrübə. Ailələrlə yaxın əməkdaşlıqda çalışır." },
  { id: 6, name: "Tural Babayev",   title: "Asılılıq mütəxəssisi", bio: "Asılılıq və impuls-nəzarəti sahəsində 10 il təcrübə. Davamlı bərpa planı və dəstək sistemi qurur." },
  { id: 7, name: "Səbinə Əliyeva",  title: "Klinik psixoloq",      bio: "Narahatlıq və stress idarəetməsi üzrə 5 illik təcrübə. Praktik, addım-addım metodlarla işləyir." },
  { id: 8, name: "Cavid Rəhimli",   title: "Travma terapevti",     bio: "Travma, yas və EMDR üzrə 12 illik təcrübə. Ağır həyat hadisələrindən sonra bərpa prosesinə dəstək olur." },
  { id: 9, name: "Günel Həsənli",   title: "Cütlük terapevti",     bio: "Cütlük terapiyası və boşanma prosesi üzrə 8 illik təcrübə. Hər iki tərəfin eşidildiyi mühit yaradır." },
];
const FALLBACK: Item[] = withSlugs(FALLBACK_BASE);

function getInitials(name: string) {
  return name.split(" ").filter(w => w.length > 1).map(w => w[0]).slice(0, 2).join("");
}

export default function PsychologistsPage({ psychologists }: { psychologists?: Psychologist[] }) {
  const [modalOpen, setModalOpen] = useState(false);

  const items: Item[] = useMemo(() => {
    if (!psychologists || psychologists.length === 0) return FALLBACK;
    const mapped = psychologists.map((p) => ({
      id: p.id,
      name: p.name,
      title: p.title,
      bio: p.bio,
      photoUrl: p.photoUrl?.trim() || undefined,
    }));
    return withSlugs(mapped);
  }, [psychologists]);

  return (
    <div className="fanus-root">
      <Breadcrumb items={[{ label: "Psixoloqlar" }]} />
      <PsycHero onApply={() => setModalOpen(true)} />
      <PsycList items={items} />
      <SessionRequestModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

function PsycHero({ onApply }: { onApply: () => void }) {
  const { t } = useT();
  return (
    <section className="pp-hero">
      <div className="fanus-container pp-hero__inner">
        <h1>{t("psyList.title")}</h1>
        <p className="pp-hero__lead">{t("psyList.lead")}</p>
        <div className="pp-hero__cta">
          <button type="button" className="fanus-btn fanus-btn-primary fanus-btn-lg" onClick={onApply}>
            Bizə müraciət et
          </button>
          <a href="#list" className="fanus-btn fanus-btn-ghost fanus-btn-lg">
            Psixoloqlarımıza bax
          </a>
        </div>
      </div>

      <style>{`
        .pp-hero { padding: 28px 0; text-align: center; }
        .pp-hero__inner { max-width: 720px; margin: 0 auto; }
        .pp-hero h1 {
          margin: 0 0 16px;
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: clamp(32px, 4.6vw, 54px); font-weight: 800;
          letter-spacing: -0.03em; line-height: 1.1; color: var(--fanus-ink);
        }
        .pp-hero__lead {
          font-size: 17px; color: var(--fanus-ink-3); line-height: 1.6;
          max-width: 600px; margin: 0 auto;
        }
        .pp-hero__cta {
          display: flex; justify-content: center; gap: 12px;
          margin-top: 28px; flex-wrap: wrap;
        }
        @media (max-width: 640px) { .pp-hero { padding: 20px 0; } }
      `}</style>
    </section>
  );
}

function PsycList({ items }: { items: Item[] }) {
  return (
    <section className="pp-list" id="list">
      <Deco type="mesh-blob" style={{ top: 60, right: "-5%", width: 400, opacity: .35 }} anim="drift" />
      <Deco type="blob-1" style={{ bottom: 80, left: "-4%", width: 280, opacity: .4 }} anim="drift" />

      <div className="fanus-container">
        <div className="pp-list__head">
          <span className="pp-list__count"><strong>{items.length}</strong> mütəxəssis</span>
        </div>

        <div className="pp-grid">
          {items.map((p) => <PsyCard key={p.id} p={p} />)}
        </div>
      </div>

      <style>{`
        .pp-list { padding: 56px 0 110px; position: relative; overflow: hidden; scroll-margin-top: 104px; }
        .pp-list > .fanus-container { position: relative; z-index: 1; }
        .pp-list__head { margin-bottom: 28px; }
        .pp-list__count { font-size: 14px; color: var(--fanus-ink-3); }
        .pp-list__count strong { color: var(--fanus-ink); font-weight: 700; }

        .pp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }

        @media (max-width: 980px) { .pp-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px) { .pp-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}

function PsyCard({ p }: { p: Item }) {
  const { t } = useT();
  const initials = getInitials(p.name);

  return (
    <article className="pp-card">
      <div className="pp-card__head">
        <Link href={`/psychologists/${p.slug ?? p.id}`} className="pp-card__photo" aria-label={`${p.name} profili`}>
          {p.photoUrl ? (
            <img src={p.photoUrl} alt={p.name} />
          ) : (
            <span className="pp-card__initials">{initials}</span>
          )}
        </Link>
        <div className="pp-card__head-body">
          <Link href={`/psychologists/${p.slug ?? p.id}`}>
            <h3 className="pp-card__name">{p.name}</h3>
          </Link>
          <p className="pp-card__title">{p.title}</p>
        </div>
      </div>

      {p.bio && <p className="pp-card__bio">{p.bio}</p>}

      <Link href={`/psychologists/${p.slug ?? p.id}`} className="pp-btn pp-btn--ghost">
        {t("psyList.profile")}
      </Link>

      <style>{`
        .pp-card {
          background: white;
          border: 1px solid var(--fanus-line);
          border-radius: 20px;
          padding: 24px;
          display: flex; flex-direction: column; gap: 16px;
          transition: border-color .2s ease, box-shadow .2s ease;
        }
        .pp-card:hover {
          border-color: var(--fanus-primary-200);
          box-shadow: 0 12px 30px rgba(16,81,183,.08);
        }

        .pp-card__head { display: flex; gap: 14px; align-items: center; }

        .pp-card__photo {
          flex-shrink: 0;
          width: 68px; height: 68px; border-radius: 50%;
          overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          background: var(--fanus-primary-50);
          box-shadow: 0 0 0 4px var(--fanus-primary-50);
        }
        .pp-card__photo img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
        .pp-card__initials {
          font-family: var(--font-poppins), sans-serif;
          font-size: 22px; font-weight: 600; color: var(--fanus-primary);
        }

        .pp-card__head-body { min-width: 0; }
        .pp-card__name {
          font-size: 17px; line-height: 1.25; margin: 0; font-weight: 700;
          color: var(--fanus-ink); transition: color .2s ease;
        }
        .pp-card__head-body a:hover .pp-card__name { color: var(--fanus-primary); }
        .pp-card__title { font-size: 13.5px; font-weight: 600; color: var(--fanus-primary); margin: 3px 0 0; }

        .pp-card__bio {
          font-size: 14px; line-height: 1.6; color: var(--fanus-ink-2);
          margin: 0;
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .pp-btn {
          align-self: flex-start; margin-top: auto;
          display: inline-flex; align-items: center; justify-content: center;
          height: 38px; padding: 0 18px; border-radius: 999px;
          font-size: 13.5px; font-weight: 600;
          font-family: inherit; cursor: pointer;
          text-decoration: none; border: 1px solid var(--fanus-line);
          background: var(--fanus-bg); color: var(--fanus-ink);
          transition: border-color .2s, color .2s, background .2s;
        }
        .pp-btn:hover { background: white; border-color: var(--fanus-primary-300); color: var(--fanus-primary); }
      `}</style>
    </article>
  );
}

