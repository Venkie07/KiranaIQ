import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  text: string;
}

interface ToastContextValue {
  push: (kind: ToastKind, text: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef<number[]>([]);

  const push = useCallback((kind: ToastKind, text: string) => {
    const id = nextId++;
    setToasts((list) => [...list, { id, kind, text }]);
    const handle = window.setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
    }, 4000);
    timers.current.push(handle);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending) window.clearTimeout(t);
    };
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Live region: screen readers announce new toasts politely. */}
      <div className="toast-region" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast${toast.kind === 'error' ? ' toast--error' : ''}`}>
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
