"use client";

import Navbar from "./Navbar";
import Footer from "./Footer";
import BookingModal from "./BookingModal";
import MoodGate from "./MoodGate";

interface Props {
  isPanel: boolean;
  children: React.ReactNode;
}

export default function PublicLayout({ isPanel, children }: Props) {
  if (isPanel) {
    // Panel subdomains: public Navbar/Footer/MoodGate göstərmə
    return <>{children}</>;
  }

  return (
    <>
      <MoodGate />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <BookingModal />
    </>
  );
}
