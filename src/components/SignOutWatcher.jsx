"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useToast } from "@/components/ToastProvider";

const STORAGE_KEY = "uniride.lastSignedInState";

export default function SignOutWatcher() {
  const { isLoaded, isSignedIn } = useUser();
  const { showSuccess } = useToast();
  const prevSignedInRef = useRef(null);

  useEffect(() => {
    if (!isLoaded) return;

    let lastKnown = prevSignedInRef.current;
    if (lastKnown === null && typeof window !== "undefined") {
      try {
        const stored = window.sessionStorage.getItem(STORAGE_KEY);
        if (stored === "true") lastKnown = true;
        else if (stored === "false") lastKnown = false;
      } catch {}
    }

    if (lastKnown === true && !isSignedIn) {
      showSuccess("You have been signed out. See you next ride!");
    }

    prevSignedInRef.current = isSignedIn;
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, isSignedIn ? "true" : "false");
      } catch {}
    }
  }, [isLoaded, isSignedIn, showSuccess]);

  return null;
}
