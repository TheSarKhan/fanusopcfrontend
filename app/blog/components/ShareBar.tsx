"use client";

import { useState } from "react";

export default function ShareBar({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const share = (platform: "twitter" | "linkedin") => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(title);
    const link =
      platform === "twitter"
        ? `https://twitter.com/intent/tweet?text=${text}&url=${url}`
        : `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    window.open(link, "_blank", "width=600,height=450");
  };

  return (
    <div className="bl-share-bar">
      <span className="bl-share-label">Paylaş:</span>
      <button className="bl-share-btn" onClick={copy}>
        {copied ? "Kopyalandı!" : "Keçidi kopyala"}
      </button>
      <button className="bl-share-btn" onClick={() => share("twitter")}>
        Twitter
      </button>
      <button className="bl-share-btn" onClick={() => share("linkedin")}>
        LinkedIn
      </button>
    </div>
  );
}
