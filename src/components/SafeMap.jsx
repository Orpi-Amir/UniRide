"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

export default function SafeMap({ children }) {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  if (!mounted) {
    return (
      <div style={{ height: "400px", width: "100%" }}>
        Loading map...
      </div>
    );
  }

  return children;
}
