"use client";

import { useEffect } from "react";

export default function LogoutPage() {
  useEffect(() => {
    window.location.replace("/?_logout=1");
  }, []);
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#F0F4FA",
        zIndex: 9999,
      }}
    />
  );
}
