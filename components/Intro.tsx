"use client";

import { useState, useEffect } from "react";
import { useMood } from "@/context/MoodContext";

export default function Intro() {
  const { isLoaded } = useMood();
  const [logoIn,   setLogoIn]   = useState(false);
  const [tagIn,    setTagIn]    = useState(false);
  const [animDone, setAnimDone] = useState(false);
  const [hiding,   setHiding]   = useState(false);
  const [gone,     setGone]     = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLogoIn(true),   120);
    const t2 = setTimeout(() => setTagIn(true),    500);
    const t3 = setTimeout(() => setAnimDone(true), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    if (!animDone || !isLoaded) return;
    setHiding(true);
    const t = setTimeout(() => setGone(true), 550);
    return () => clearTimeout(t);
  }, [animDone, isLoaded]);

  if (gone) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      background: "linear-gradient(160deg, #EEF4FF 0%, #F2EEFF 50%, #EEF8F5 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      opacity: hiding ? 0 : 1,
      transition: hiding ? "opacity 0.55s ease" : "none",
      pointerEvents: hiding ? "none" : "auto",
    }}>

      {/* Decorative blobs */}
      <div style={{ position: "fixed", top: -80,  left: -80,  width: 300, height: 300, borderRadius: "50%", background: "rgba(59,111,165,0.07)",  pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -60, right: -60, width: 250, height: 250, borderRadius: "50%", background: "rgba(123,133,200,0.07)", pointerEvents: "none" }} />

      {/* Logo */}
      <div style={{
        opacity:   logoIn ? 1 : 0,
        transform: logoIn ? "scale(1) translateY(0)" : "scale(0.82) translateY(16px)",
        transition: "opacity 0.65s ease, transform 0.65s cubic-bezier(0.34,1.4,0.64,1)",
        marginBottom: 20,
      }}>
        <img
          src="/images/hero-main.png"
          alt="Fanus"
          style={{ height: 52, objectFit: "contain" }}
        />
      </div>

      {/* Tagline */}
      <p style={{
        opacity:   tagIn ? 1 : 0,
        transform: tagIn ? "translateY(0)" : "translateY(10px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
        color: "#6B85A0", fontSize: "0.88rem", letterSpacing: "0.02em",
        marginBottom: 40,
      }}>
        Emosional sağlamlığınız üçün
      </p>

      {/* Loading dots */}
      <div style={{
        display: "flex", gap: 7,
        opacity: tagIn ? 1 : 0,
        transition: "opacity 0.4s ease 0.1s",
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#3B6FA5",
            animation: `typingDot 1.2s ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}
