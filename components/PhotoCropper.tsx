"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Profile photo cropper — square viewport (rectangular).
 *
 * Pick a file → drag/zoom inside a square viewport → "Tətbiq et" produces a
 * cropped square PNG File via canvas. No external dependency.
 *
 * The zoom slider's minimum is the image's own cover-fit scale (computed on
 * load from its natural size), not a fixed constant — a fixed min like 0.3
 * sits well ABOVE the cover-fit scale of typical large photos (e.g. a 3000px
 * phone photo needs ~0.1 to cover a 320px viewport), so users could zoom in
 * but never zoom back out past that fixed floor to the original framing.
 */
export default function PhotoCropper({
  initialFile,
  onCropped,
  onCancel,
  size = 320,
  outputSize = 512,
}: {
  initialFile?: File | null;
  onCropped: (cropped: File, previewUrl: string) => void;
  onCancel: () => void;
  size?: number;
  outputSize?: number;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, ox: 0, oy: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!initialFile) return;
    const url = URL.createObjectURL(initialFile);
    setSrc(url);
    setZoom(1);
    setPos({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [initialFile]);

  // Şəkil zoom-dan asılı olaraq kvadrat viewport-u örtəndə, boşluq görünməsin
  // deyə sürüşdürmə məsafəsini məhdudlaşdırır.
  const maxOffsetAt = useCallback((z: number, dims: { w: number; h: number }) => ({
    mx: Math.max(0, (dims.w * z - size) / 2),
    my: Math.max(0, (dims.h * z - size) / 2),
  }), [size]);

  const clamp = (o: { x: number; y: number }, mx: number, my: number) => ({
    x: Math.min(mx, Math.max(-mx, o.x)),
    y: Math.min(my, Math.max(-my, o.y)),
  });

  const onLoad = () => {
    if (!imgRef.current) return;
    const w = imgRef.current.naturalWidth;
    const h = imgRef.current.naturalHeight;
    setImgDims({ w, h });
    // Viewport-u ilk açılışda tam örtsün: kiçik tərəf == size.
    const cover = size / Math.min(w, h);
    setBaseScale(cover);
    setZoom(cover);
    setPos({ x: 0, y: 0 });
  };

  const changeZoom = (z: number) => {
    const clampedZoom = Math.max(baseScale, Math.min(baseScale * 5, z));
    const { mx, my } = maxOffsetAt(clampedZoom, imgDims);
    setZoom(clampedZoom);
    setPos((p) => clamp(p, mx, my));
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    changeZoom(zoom - e.deltaY * (baseScale * 0.0015));
  };

  // Pointer drag
  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const { mx, my } = maxOffsetAt(zoom, imgDims);
    setPos(clamp({ x: dragStart.ox + (e.clientX - dragStart.x), y: dragStart.oy + (e.clientY - dragStart.y) }, mx, my));
  };
  const onPointerUp = () => setDragging(false);

  const apply = () => {
    if (!src || !imgDims.w) return;
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // White background fill (no clip — square crop)
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, outputSize, outputSize);

    // Source rectangle (in original image pixels) that maps to the visible square viewport
    const displayedW = imgDims.w * zoom;
    const displayedH = imgDims.h * zoom;
    const dispLeft = (size - displayedW) / 2 + pos.x;
    const dispTop = (size - displayedH) / 2 + pos.y;

    const sx = (-dispLeft) / zoom;
    const sy = (-dispTop) / zoom;
    const sSize = size / zoom;

    const img = imgRef.current!;
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, outputSize, outputSize);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "profile.png", { type: "image/png" });
      const previewUrl = canvas.toDataURL("image/png");
      onCropped(file, previewUrl);
    }, "image/png", 0.92);
  };

  if (!src) return null;

  return (
    <div onClick={onCancel}
      style={{ position: "fixed", inset: 0, background: "rgba(15,28,46,0.65)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 18, padding: 22, width: "min(420px, 100%)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1A2535", textAlign: "center", marginBottom: 12 }}>
          Profil şəklini düzəlt
        </h3>
        <p style={{ fontSize: 12, color: "#52718F", textAlign: "center", marginBottom: 14 }}>
          Şəkli sürüşdür və zoom et — kvadratın içində qalan hissə profil şəkliniz olacaq
        </p>

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          style={{
            position: "relative",
            width: size,
            height: size,
            margin: "0 auto",
            borderRadius: 12,
            overflow: "hidden",
            background: "#0F1C2E",
            cursor: dragging ? "grabbing" : "grab",
            touchAction: "none",
            userSelect: "none",
          }}
        >
          { }
          <img
            ref={imgRef}
            src={src}
            onLoad={onLoad}
            draggable={false}
            alt=""
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: imgDims.w * zoom,
              height: imgDims.h * zoom,
              transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
              maxWidth: "none",
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "absolute", inset: 0, borderRadius: 12, pointerEvents: "none", border: "2px solid rgba(255,255,255,0.6)" }} />
        </div>

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "#52718F" }}>Zoom</span>
          <input
            type="range"
            min={baseScale}
            max={baseScale * 5}
            step={(baseScale * 5 - baseScale) / 200 || 0.001}
            value={zoom}
            onChange={(e) => changeZoom(parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={onCancel}
            style={{ flex: 1, padding: "10px 14px", border: "1px solid #E5E7EB", background: "#fff", color: "#1A2535", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>
            Ləğv et
          </button>
          <button onClick={apply}
            style={{ flex: 1, padding: "10px 14px", border: "none", background: "var(--brand)", color: "#fff", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Tətbiq et
          </button>
        </div>
      </div>
    </div>
  );
}
