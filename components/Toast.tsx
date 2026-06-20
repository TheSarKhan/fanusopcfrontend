"use client";

import { useEffect, useState } from "react";

export type ToastTone = "success" | "error" | "info";
interface ToastItem { id: number; message: string; tone: ToastTone; }

let seq = 0;
let items: ToastItem[] = [];
const listeners = new Set<(t: ToastItem[]) => void>();
function emit() { listeners.forEach(l => l(items)); }

/** Fire a toast from anywhere (event handlers, catch blocks). */
export function toast(message: string, tone: ToastTone = "info") {
  const item: ToastItem = { id: ++seq, message, tone };
  items = [...items, item];
  emit();
  setTimeout(() => {
    items = items.filter(x => x.id !== item.id);
    emit();
  }, 4000);
}

/** Mount once near the app root. */
export function ToastHost() {
  const [list, setList] = useState<ToastItem[]>(items);
  useEffect(() => {
    listeners.add(setList);
    return () => { listeners.delete(setList); };
  }, []);

  return (
    <div className="ui-toast-host" aria-live="polite" aria-atomic="false">
      {list.map(t => (
        <div key={t.id} className={`ui-toast ui-toast--${t.tone}`} role="status">
          {t.message}
        </div>
      ))}
    </div>
  );
}
