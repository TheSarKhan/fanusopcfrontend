"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/LocaleProvider";

export default function ShareBar({ className }: { className?: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={className ? `bl-share-bar ${className}` : "bl-share-bar"}>
      <button className="bl-share-btn" onClick={copy}>
        {copied ? t("article.shareCopied") : t("article.shareCopy")}
      </button>
    </div>
  );
}
