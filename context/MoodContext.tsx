"use client";

import { createContext, useContext, useState } from "react";

export type MoodId = "sad" | "anxious" | "neutral" | "tired" | "good";

interface MoodContextType {
  mood: MoodId | null;
  setMood: (mood: MoodId) => void;
}

const MoodContext = createContext<MoodContextType>({ mood: null, setMood: () => {} });

export const useMood = () => useContext(MoodContext);

export function MoodProvider({ children }: { children: React.ReactNode }) {
  const [mood, setMood] = useState<MoodId | null>(null);
  return <MoodContext.Provider value={{ mood, setMood }}>{children}</MoodContext.Provider>;
}
