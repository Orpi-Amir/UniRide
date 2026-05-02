import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Prevent Leaflet SSR issues globally (safe flag for your app)
import dynamic from "next/dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }) {
  console.log("🔧 RootLayout loaded");
  console.log(
    "📦 Clerk Key:",
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? "SET" : "NOT SET"
  );

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        
        <ClerkProvider
          publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
          afterSignOutUrl="/"
          signInFallbackRedirectUrl="/find-ride"
          signUpFallbackRedirectUrl="/verify-email"
        >
          
          {/* UniRide App Wrapper */}
          {children}

        </ClerkProvider>

      </body>
    </html>
  );
}