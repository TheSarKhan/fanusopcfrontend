"use client";

import { createContext, useContext, useState, useEffect } from "react";

export type MoodId = "sad" | "anxious" | "neutral" | "tired" | "good";

interface MoodContextType {
  mood: MoodId | null;
  setMood: (mood: MoodId) => void;
  isLoaded: boolean;
}

const MoodContext = createContext<MoodContextType>({ mood: null, setMood: () => {}, isLoaded: false });

export const useMood = () => useContext(MoodContext);

export function MoodProvider({ children }: { children: React.ReactNode }) {
  const [mood, setMoodState] = useState<MoodId | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedMoodData = localStorage.getItem("fanus_user_mood");
    if (savedMoodData) {
      try {
        const { mood: savedMood, timestamp } = JSON.parse(savedMoodData);
        const oneDay = 24 * 60 * 60 * 1000;
        if (Date.now() - timestamp < oneDay) {
          setMoodState(savedMood);
        } else {
          localStorage.removeItem("fanus_user_mood");
        }
      } catch (e) {
        // Ignore error
      }
    }
    setIsLoaded(true);
  }, []);

  const setMood = (newMood: MoodId) => {
    setMoodState(newMood);
    localStorage.setItem("fanus_user_mood", JSON.stringify({
      mood: newMood,
      timestamp: Date.now()
    }));
  };

  return (
    <MoodContext.Provider value={{ mood, setMood, isLoaded }}>
      {children}
    </MoodContext.Provider>
  );
}
