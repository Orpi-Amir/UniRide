"use client";

import { useSignUp, useAuth, useClerk } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export default function DebugPage() {
  const { isLoaded: signUpLoaded, signUp } = useSignUp();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { loaded: clerkLoaded } = useClerk();
  const [clerkStatus, setClerkStatus] = useState("Checking...");

  useEffect(() => {
    console.log("=== CLERK DEBUG INFO ===");
    console.log("signUpLoaded:", signUpLoaded);
    console.log("authLoaded:", authLoaded);
    console.log("clerkLoaded:", clerkLoaded);
    console.log("isSignedIn:", isSignedIn);
    console.log("signUp object:", signUp);
    
    if (clerkLoaded && authLoaded && signUpLoaded) {
      setClerkStatus("✅ ALL LOADED");
    } else {
      setClerkStatus("⏳ Still loading...");
    }
  }, [signUpLoaded, authLoaded, clerkLoaded, isSignedIn, signUp]);

  return (
    <div style={{ padding: "40px", fontFamily: "monospace", maxWidth: "800px", margin: "0 auto" }}>
      <h1>🔍 Clerk Authentication Debug</h1>
      
      <div style={{ background: "#f5f5f5", padding: "20px", borderRadius: "8px", marginBottom: "20px" }}>
        <h2>Status: {clerkStatus}</h2>
        
        <div style={{ marginTop: "20px" }}>
          <p><strong>signUpLoaded:</strong> {String(signUpLoaded)}</p>
          <p><strong>authLoaded:</strong> {String(authLoaded)}</p>
          <p><strong>clerkLoaded:</strong> {String(clerkLoaded)}</p>
          <p><strong>isSignedIn:</strong> {String(isSignedIn)}</p>
        </div>
      </div>

      <h2>Environment Variables:</h2>
      <div style={{ background: "#ffe6e6", padding: "20px", borderRadius: "8px", marginBottom: "20px" }}>
        <p><strong>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:</strong></p>
        <code style={{ wordBreak: "break-all" }}>
          {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? "✅ SET" : "❌ NOT SET"}
        </code>
        <p style={{ marginTop: "10px", color: "#666", fontSize: "12px" }}>
          (Secret key cannot be displayed here for security)
        </p>
      </div>

      <h2>Open Browser Console (F12)</h2>
      <div style={{ background: "#e6f3ff", padding: "20px", borderRadius: "8px" }}>
        <p>Look for any error messages like:</p>
        <ul>
          <li>Network errors</li>
          <li>CORS errors</li>
          <li>Missing API keys</li>
          <li>Clerk initialization errors</li>
        </ul>
      </div>

      <div style={{ marginTop: "30px", textAlign: "center" }}>
        <a href="/auth/signup" style={{ 
          padding: "10px 20px", 
          background: "#667eea", 
          color: "white", 
          textDecoration: "none", 
          borderRadius: "4px",
          display: "inline-block"
        }}>
          Go to Signup Page
        </a>
      </div>
    </div>
  );
}
