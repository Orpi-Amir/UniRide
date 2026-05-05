"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";

export default function AuthSync() {
  const { isLoaded, isSignedIn } = useUser();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || syncedRef.current) return;

    syncedRef.current = true;
    fetch("/api/users/sync", { method: "POST" }).catch(() => {
      syncedRef.current = false;
    });
  }, [isLoaded, isSignedIn]);

  return null;
}
