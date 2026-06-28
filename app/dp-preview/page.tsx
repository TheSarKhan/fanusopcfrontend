"use client";

// TEMP preview route for visual QA of the custom DatePicker — delete after.
import { useState } from "react";
import DatePicker from "@/components/DatePicker";

export default function DpPreview() {
  const [a, setA] = useState("2026-06-28T16:43");
  const [b, setB] = useState("2026-06-28");

  return (
    <div style={{ minHeight: "100vh", background: "#F4F7FC", padding: 48 }}>
      <div style={{ maxWidth: 360, marginBottom: 40 }}>
        <div style={{ fontSize: 13, color: "#0A1A33", marginBottom: 8, fontWeight: 600 }}>Light · datetime</div>
        <DatePicker value={a} onChange={setA} withTime theme="light" />
      </div>
      <div style={{ maxWidth: 360 }}>
        <div style={{ fontSize: 13, color: "#0A1A33", marginBottom: 8, fontWeight: 600 }}>Light · date</div>
        <DatePicker value={b} onChange={setB} theme="light" />
      </div>
    </div>
  );
}
