"use client";

import { type PointerEvent, type ReactNode, useRef } from "react";

/** Üfüqi kart zolağı — mobil sürüşdürmə və desktop-da siçanla dartma üçün. */
export default function HorizontalCardRail({ children, className }: { children: ReactNode; className: string }) {
  const railRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0 });

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rail = railRef.current;
    if (!rail) return;
    drag.current = { active: true, startX: event.clientX, scrollLeft: rail.scrollLeft };
    rail.setPointerCapture(event.pointerId);
    rail.classList.add("card-rail--dragging");
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current.active || !railRef.current) return;
    railRef.current.scrollLeft = drag.current.scrollLeft - (event.clientX - drag.current.startX);
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current.active || !railRef.current) return;
    drag.current.active = false;
    railRef.current.classList.remove("card-rail--dragging");
    if (railRef.current.hasPointerCapture(event.pointerId)) railRef.current.releasePointerCapture(event.pointerId);
  }

  return (
    <div
      ref={railRef}
      className={`${className} card-rail`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      aria-label="Psixoloqlar siyahısı"
    >
      {children}
    </div>
  );
}
