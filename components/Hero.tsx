"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useBooking } from "@/context/BookingContext";
import { useMood, MoodId } from "@/context/MoodContext";

type MoodConfig = {
  label: string;
  emoji: string;
  headline: string;
  sub: string;
  accent: string;
  accentSoft: string;
  bg: string;
  breath: string;
  chat: { from: "p" | "t"; text: string }[];
};

const MOODS: Record<MoodId, MoodConfig> = {
  good: {
    label: "Yaxşı",
    emoji: "🌿",
    headline: "Daha yaxşı hiss etməyə bu gün başlayın",
    sub: "Sizə uyğun psixoloqla rahat və təhlükəsiz mühitdə işləyin. Onlayn seans, aydın yol.",
    accent: "var(--sage)",
    accentSoft: "var(--sage-soft)",
    bg: "linear-gradient(180deg, #F4FAF7 0%, #FFFFFF 60%, #FFFFFF 100%)",
    breath: "Dərindən nəfəs alın",
    chat: [
      { from: "p", text: "Bu həftə özümü daha yüngül hiss edirəm." },
      { from: "t", text: "Çox sevindim. Hansı an sizə bunu hiss etdirdi?" },
      { from: "p", text: "Səhər 10 dəqiqəlik nəfəs məşqi etdim." },
    ],
  },
  sad: {
    label: "Kədərli",
    emoji: "🧡",
    headline: "Kədər keçicidir. Tək keçirməyə ehtiyac yoxdur",
    sub: "Sizi dinləyən, mühakimə etməyən, peşəkar bir psixoloqla bu addımı atın.",
    accent: "var(--lilac)",
    accentSoft: "var(--lilac-soft)",
    bg: "linear-gradient(180deg, #F1EEF8 0%, #F7F5FC 50%, #FFFFFF 100%)",
    breath: "Yavaş-yavaş nəfəs",
    chat: [
      { from: "p", text: "Son zamanlar heç nə məni sevindirmir." },
      { from: "t", text: "Bunu paylaşdığınız üçün təşəkkür edirəm. Birlikdə baxaq." },
      { from: "p", text: "Bəzən səbəbsiz ağlayıram." },
    ],
  },
  anxious: {
    label: "Narahat",
    emoji: "💙",
    headline: "Narahatçılığınıza birlikdə yumşaq cavab tapaq",
    sub: "Praktik nəfəs texnikaları, sübutla əsaslanan terapiya və sizin tempinizdə irəliləyiş.",
    accent: "var(--amber)",
    accentSoft: "var(--amber-soft)",
    bg: "linear-gradient(180deg, #FBF4EA 0%, #FDF9F2 50%, #FFFFFF 100%)",
    breath: "İçəri 4… bayıra 6",
    chat: [
      { from: "p", text: "Ürəyim sürətli döyünür, fikirlər dayanmır." },
      { from: "t", text: "Birlikdə bir nəfəs məşqi edək. 4-7-8." },
      { from: "p", text: "Tamam, sınayıram." },
    ],
  },
  tired: {
    label: "Yorğun",
    emoji: "🌸",
    headline: "Yavaşlamağa icazəniz var. Biz buradayıq",
    sub: "Sizə uyğun ritmdə, kiçik addımlarla. Heç bir təzyiq, heç bir tələsmə.",
    accent: "var(--rose)",
    accentSoft: "var(--rose-soft)",
    bg: "linear-gradient(180deg, #F8EFEF 0%, #FBF6F6 50%, #FFFFFF 100%)",
    breath: "Yavaş və dərin",
    chat: [
      { from: "p", text: "Heç bir şey istəmirəm. Sadəcə yorğunam." },
      { from: "t", text: "Anlayıram. Birlikdə, yavaş-yavaş irəliləyək." },
      { from: "p", text: "Bunu eşitmək yaxşı oldu." },
    ],
  },
  neutral: {
    label: "Normal",
    emoji: "✨",
    headline: "Daha yaxşı hiss etməyə bu gün başlayın",
    sub: "Sertifikatlı psixoloqlarla güvənli, məxfi və rahat mühitdə psixoloji dəstək alın.",
    accent: "var(--sage)",
    accentSoft: "var(--sage-soft)",
    bg: "linear-gradient(180deg, #EEF4FF 0%, #F7F9FC 60%, #FFFFFF 100%)",
    breath: "Dərindən nəfəs alın",
    chat: [
      { from: "p", text: "Özümü daha yaxşı hiss etmək istəyirəm." },
      { from: "t", text: "Əla! Sizi dinləyən biri hazırdır — bu gün birlikdə başlayaq 💙" },
      { from: "p", text: "Haradan başlamaq lazımdır?" },
    ],
  },
};

const MOOD_ORDER: MoodId[] = ["good", "sad", "anxious", "tired"];

function ChatCard({ moodKey }: { moodKey: MoodId }) {
  const m = MOODS[moodKey];
  const [visible, setVisible] = useState(1);
  const [typing, setTyping] = useState(false);
  const prevMood = useRef(moodKey);

  useEffect(() => {
    if (prevMood.current !== moodKey) {
      setVisible(1);
      setTyping(false);
      prevMood.current = moodKey;
    }
  }, [moodKey]);

  useEffect(() => {
    if (visible >= m.chat.length) {
      const t = setTimeout(() => setVisible(1), 4500);
      return () => clearTimeout(t);
    }
    const t1 = setTimeout(() => setTyping(true), 1400);
    const t2 = setTimeout(() => {
      setTyping(false);
      setVisible(v => v + 1);
    }, 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [visible, moodKey, m.chat.length]);

  return (
    <div
      className="chat-card"
      style={{ "--mood-accent": m.accent, "--mood-soft": m.accentSoft } as React.CSSProperties}
    >
      {/* Breathing orb */}
      <div className="breath-floater">
        <div className="breath-ring" />
        <div className="breath-ring breath-ring-2" />
        <div className="breath-core" style={{ background: m.accent }}>
          <span>{m.breath}</span>
        </div>
      </div>

      {/* Header */}
      <div className="chat-header">
        <div className="chat-avatar">
          <div className="chat-avatar-img">
            <img src="/images/logos/logo-blue.png" alt="Fanus" style={{ width: "70%", height: "70%", objectFit: "contain" }} />
          </div>
          <span className="chat-status-dot" />
        </div>
        <div className="chat-header-text">
          <div className="chat-name">Fanus</div>
          <div className="chat-role">Onlayn psixologiya platforması</div>
        </div>
        <div className="chat-secure">
          <svg width="14" height="14" fill="none" stroke="var(--oxford-60)" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
      </div>

      {/* Body */}
      <div className="chat-body">
        <div className="chat-session-meta">
          <span className="session-pill">
            <span className="rec-dot" />
            Canlı seans
          </span>
        </div>

        {m.chat.slice(0, visible).map((msg, i) => (
          <div
            key={`${moodKey}-${i}`}
            className={`chat-bubble chat-bubble-${msg.from}`}
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            {msg.from === "t" && <div className="bubble-meta">Fanus</div>}
            <div>{msg.text}</div>
          </div>
        ))}

        {typing && visible < m.chat.length && (
          <div className={`chat-bubble chat-bubble-${m.chat[visible].from} typing`}>
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="chat-input">
        <input type="text" placeholder="Mesaj yazın…" disabled />
        <button className="chat-send" style={{ background: m.accent }}>
          <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.2" viewBox="0 0 24 24">
            <path d="M22 2L11 13" strokeLinecap="round" />
            <path d="M22 2L15 22l-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function Hero() {
  const { open } = useBooking();
  const { mood, setMood } = useMood();

  const activeMood: MoodId = mood ?? "neutral";
  const m = MOODS[activeMood];

  return (
    <section className="hero" style={{ background: m.bg }}>
      {/* Decorative blobs */}
      <div className="hero-blob hero-blob-1" style={{ background: m.accentSoft }} />
      <div className="hero-blob hero-blob-2" style={{ background: "var(--bg-blue)" }} />

      {/* Wave at bottom */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, pointerEvents: "none", lineHeight: 0 }}>
        <svg viewBox="0 0 1440 60" fill="none" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 60 }}>
          <path d="M0 30 Q360 60 720 30 Q1080 0 1440 30 L1440 60 L0 60 Z" fill="#ffffff" />
        </svg>
      </div>

      <div className="container hero-grid">
        {/* Left */}
        <div>
          <h1 className="hero-headline" key={activeMood}>
            {m.headline}
          </h1>

          <p className="hero-sub">{m.sub}</p>

          {/* Inline Mood Picker */}
          <div className="mood-picker">
            <span className="mood-picker-label">Bu gün necə hiss edirsiniz?</span>
            <div className="mood-options">
              {MOOD_ORDER.map((k) => {
                const cfg = MOODS[k];
                const isActive = activeMood === k;
                return (
                  <button
                    key={k}
                    className={`mood-chip${isActive ? " active" : ""}`}
                    onClick={() => setMood(k)}
                    style={isActive ? {
                      background: cfg.accentSoft,
                      borderColor: cfg.accent,
                      color: cfg.accent,
                    } : {}}
                  >
                    <span className="mood-emoji">{cfg.emoji}</span>
                    <span>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CTAs */}
          <div className="hero-ctas">
            <Link href="/register" className="btn btn-primary">
              Pulsuz başla
              <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link href="/psychologists" className="btn btn-ghost">
              Psixoloqlara bax
            </Link>
          </div>

          {/* Trust row */}
          <div className="hero-trust">
            <div className="trust-avatars">
              {(["#C97D2E", "#4A9B7F", "#8C7DC9", "#C97D7D"] as string[]).map((c, i) => (
                <div key={i} className="trust-avatar" style={{ background: c }}>
                  {["A", "L", "N", "R"][i]}
                </div>
              ))}
            </div>
            <div>
              <div className="trust-stars">
                {[0,1,2,3,4].map(i => (
                  <svg key={i} width="13" height="13" fill="var(--amber)" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
                <strong style={{ marginLeft: 6 }}>4.9</strong>
              </div>
              <div className="trust-text" style={{ marginTop: 2 }}>2,000+ məmnun istifadəçi</div>
            </div>
          </div>
        </div>

        {/* Right — Chat Card */}
        <div className="hero-right">
          <ChatCard moodKey={activeMood} />
        </div>
      </div>
    </section>
  );
}
