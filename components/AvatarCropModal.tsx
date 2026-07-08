"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const VIEWPORT = 280;
const OUTPUT_SIZE = 480;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

interface Offset { x: number; y: number; }

/** Square-crop + pan/zoom modal shown before a profile photo is uploaded.
 *  Output is always a square JPEG so it lines up with the circular avatar mask
 *  used everywhere the photo is displayed. */
export default function AvatarCropModal({
  file,
  onCancel,
  onCropped,
}: {
  file: File;
  onCancel: () => void;
  onCropped: (cropped: File) => Promise<void>;
}) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; start: Offset } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !saving) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, saving]);

  const baseScale = natural ? Math.max(VIEWPORT / natural.w, VIEWPORT / natural.h) : 1;
  const scale = baseScale * zoom;
  const dispW = natural ? natural.w * scale : 0;
  const dispH = natural ? natural.h * scale : 0;

  const maxOffsetAt = useCallback((z: number) => {
    if (!natural) return { mx: 0, my: 0 };
    const s = baseScale * z;
    return {
      mx: Math.max(0, (natural.w * s - VIEWPORT) / 2),
      my: Math.max(0, (natural.h * s - VIEWPORT) / 2),
    };
  }, [natural, baseScale]);

  const clamp = (o: Offset, mx: number, my: number): Offset => ({
    x: Math.min(mx, Math.max(-mx, o.x)),
    y: Math.min(my, Math.max(-my, o.y)),
  });

  const onImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const onZoomChange = (z: number) => {
    const { mx, my } = maxOffsetAt(z);
    setZoom(z);
    setOffset(o => clamp(o, mx, my));
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    onZoomChange(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom - e.deltaY * 0.0015)));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!natural) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, start: offset };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const { mx, my } = maxOffsetAt(zoom);
    setOffset(clamp({ x: d.start.x + (e.clientX - d.startX), y: d.start.y + (e.clientY - d.startY) }, mx, my));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const onConfirm = async () => {
    const img = imgRef.current;
    if (!natural || !img) return;
    setSaving(true);
    setErr(null);
    try {
      const displayLeft = (VIEWPORT - dispW) / 2 + offset.x;
      const displayTop = (VIEWPORT - dispH) / 2 + offset.y;
      const sx = -displayLeft / scale;
      const sy = -displayTop / scale;
      const sSize = VIEWPORT / scale;

      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas dəstəklənmir");
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (!blob) throw new Error("Şəkil emalı uğursuz oldu");

      await onCropped(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
    } catch (e) {
      setErr((e as Error).message || "Kəsmə uğursuz oldu");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rsc-modal-back" onClick={saving ? undefined : onCancel}>
      <div className="rsc-modal avcrop-modal" onClick={e => e.stopPropagation()}>
        <h2>Şəkli kəs</h2>
        <p className="rsc-modal-sub">
          Sürüşdürərək yerini, aşağıdakı sürgü ilə ölçüsünü tənzimləyin. İşıqlandırılmış dairə profildə görünəcək sahədir.
        </p>

        <div
          className="avcrop-viewport"
          style={{ width: VIEWPORT, height: VIEWPORT }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          {imgSrc && (
            <img
              ref={imgRef}
              src={imgSrc}
              alt=""
              onLoad={onImgLoad}
              draggable={false}
              style={{
                position: "absolute",
                left: (VIEWPORT - dispW) / 2 + offset.x,
                top: (VIEWPORT - dispH) / 2 + offset.y,
                width: dispW || undefined,
                height: dispH || undefined,
                maxWidth: "none",
              }}
            />
          )}
          <div className="avcrop-mask" aria-hidden />
        </div>

        <div className="avcrop-zoom">
          <span aria-hidden>−</span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={e => onZoomChange(Number(e.target.value))}
            disabled={!natural || saving}
            aria-label="Yaxınlaşdırma"
          />
          <span aria-hidden>+</span>
        </div>

        {err && <div className="uprof-error-inline">{err}</div>}

        <div className="rsc-modal-actions">
          <button type="button" className="rsc-btn rsc-btn--close" onClick={onCancel} disabled={saving}>
            Ləğv et
          </button>
          <button
            type="button"
            className="rsc-btn"
            style={{ background: "var(--brand)", color: "#fff" }}
            onClick={onConfirm}
            disabled={saving || !natural}
          >
            {saving ? "Yüklənir…" : "Təsdiqlə"}
          </button>
        </div>
      </div>
    </div>
  );
}
