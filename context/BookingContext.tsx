"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface BookingContextValue {
  isOpen: boolean;
  psychologistName?: string;
  open: (psychologistName?: string) => void;
  close: () => void;
}

const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [psychologistName, setPsychologistName] = useState<string | undefined>();

  const open = (name?: string) => {
    setPsychologistName(name);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setPsychologistName(undefined);
  };

  return (
    <BookingContext.Provider value={{ isOpen, psychologistName, open, close }}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used inside BookingProvider");
  return ctx;
}
