"use client";

import { useEffect, useState } from "react";

export default function SafeMap({ children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div style={{ height: "400px", width: "100%" }}>
        Loading map...
      </div>
    );
  }

  return children;
}