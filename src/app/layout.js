import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthSync from "@/components/AuthSync";
import { ToastProvider } from "@/components/ToastProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        
        <ClerkProvider
          publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
          afterSignOutUrl="/"
          signInFallbackRedirectUrl="/profile"
          signUpFallbackRedirectUrl="/profile"
        >
          <ToastProvider>
            <AuthSync />
            {children}
          </ToastProvider>

        </ClerkProvider>

      </body>
    </html>
  );
}