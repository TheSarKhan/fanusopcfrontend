"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type ModalMode = "booking" | "contact";

interface BookingContextValue {
  isOpen: boolean;
  psychologistName?: string;
  mode: ModalMode;
  open: (psychologistName?: string, mode?: ModalMode) => void;
  close: () => void;
}

const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [psychologistName, setPsychologistName] = useState<string | undefined>();
  const [mode, setMode] = useState<ModalMode>("booking");

  const open = (name?: string, m: ModalMode = "booking") => {
    setPsychologistName(name);
    setMode(m);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setPsychologistName(undefined);
  };

  return (
    <BookingContext.Provider value={{ isOpen, psychologistName, mode, open, close }}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used inside BookingProvider");
  return ctx;
}
