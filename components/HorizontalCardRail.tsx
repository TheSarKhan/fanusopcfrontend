"use client";

import { type PointerEvent, type ReactNode, useRef } from "react";

/** Sürüşmə niyyəti bu qədər piksel hərəkətdən sonra təsdiqlənir — bundan az
 *  hərəkət sadə klik sayılır. Bu olmadan `setPointerCapture` HƏR klikdə (hətta
 *  siçan 0px tərpənsə belə) dərhal çağırılır və altındakı "Profilə bax" kimi
 *  linklərin click hadisəsini udur — keçid işləmirdi, bax V145 sonrası bug. */
const DRAG_THRESHOLD = 6;

/** Üfüqi kart zolağı — mobil sürüşdürmə və desktop-da siçanla dartma üçün. */
export default function HorizontalCardRail({ children, className }: { children: ReactNode; className: string }) {
  const railRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, active: false, pointerId: 0, startX: 0, scrollLeft: 0 });

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rail = railRef.current;
    if (!rail) return;
    // Diqqət: burada HƏLƏ setPointerCapture çağırmırıq — yalnız DRAG_THRESHOLD
    // aşılanda (onPointerMove-da) capture edirik ki, sadə klik toxunulmaz qalsın.
    drag.current = { down: true, active: false, pointerId: event.pointerId, startX: event.clientX, scrollLeft: rail.scrollLeft };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const rail = railRef.current;
    if (!d.down || !rail) return;
    const delta = event.clientX - d.startX;
    if (!d.active) {
      if (Math.abs(delta) < DRAG_THRESHOLD) return;
      d.active = true;
      rail.setPointerCapture(d.pointerId);
      rail.classList.add("card-rail--dragging");
    }
    rail.scrollLeft = d.scrollLeft - delta;
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const rail = railRef.current;
    if (!d.down) return;
    d.down = false;
    d.active = false;
    if (rail) {
      rail.classList.remove("card-rail--dragging");
      if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
    }
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
