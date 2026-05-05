"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

const ToastContext = createContext(null);

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const remove = useCallback((id) => {
    const t = timersRef.current.get(id);
    if (t) clearTimeout(t);
    timersRef.current.delete(id);
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = "info", durationMs = 4200) => {
      const id = `${Date.now()}-${idCounter++}`;
      setToasts((prev) => [...prev, { id, message, type }]);

      const timer = setTimeout(() => remove(id), durationMs);
      timersRef.current.set(id, timer);
      return id;
    },
    [remove]
  );

  const value = useMemo(
    () => ({
      showToast,
      showSuccess: (msg) => showToast(msg, "success"),
      showError: (msg) => showToast(msg, "error"),
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toastHost" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.type}`}>
            <div className="toast__message">{toast.message}</div>
            <button
              type="button"
              className="toast__close"
              onClick={() => remove(toast.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
