"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { login } from "@/lib/api";
import { buildPanelUrl } from "@/lib/auth";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function LoginModal({ open, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus email input when modal opens
  useEffect(() => {
    if (open) {
      setError("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await login(email, password);
      // Redirect to the correct subdomain panel
      window.location.href = buildPanelUrl(data.role);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Giriş uğursuz oldu");
      setLoading(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "1.5rem",
          padding: "2.5rem",
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 32px 80px rgba(0,0,0,0.25)",
          position: "relative",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#9CA3AF] hover:text-[#374151] transition-colors"
          style={{ fontSize: 20, lineHeight: 1, padding: "4px 8px" }}
        >
          ✕
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl font-bold mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, #002147, #5A4FC8)" }}
          >
            F
          </div>
          <h2 className="text-xl font-bold text-[#1A2535]">Hesabınıza daxil olun</h2>
          <p className="text-sm text-[#52718F] mt-1">Rola görə panelinizə yönləndiriləcəksiniz</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#1A2535] mb-1.5">Email</label>
            <input
              ref={inputRef}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@nümunə.az"
              required
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#1A2535]">Şifrə</label>
              <Link
                href="/forgot-password"
                className="text-xs text-[#3B6FA5] hover:underline"
                onClick={onClose}
              >
                Şifrəni unutmuşam
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ border: "1.5px solid #C0D2E6", background: "#FAFCFF" }}
            />
          </div>

          {error && (
            <div className="text-sm text-red-500 text-center bg-red-50 rounded-xl py-2 px-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="py-3 rounded-xl text-sm font-bold text-white transition-all"
            style={{
              background: loading
                ? "#52718F"
                : "linear-gradient(135deg, #002147, #5A4FC8)",
            }}
          >
            {loading ? "Daxil olunur..." : "Daxil ol →"}
          </button>
        </form>

        <p className="text-center text-sm text-[#52718F] mt-5">
          Hesabınız yoxdur?{" "}
          <Link
            href="/register"
            className="text-[#3B6FA5] font-semibold hover:underline"
            onClick={onClose}
          >
            Qeydiyyat
          </Link>
        </p>
      </div>
    </div>
  );
}
