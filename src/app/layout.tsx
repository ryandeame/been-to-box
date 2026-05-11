import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AuthStatusButton from "@/components/auth/AuthStatusButton";
import { AuthProvider } from "@/components/auth/AuthProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Been-To-Box",
  description: "Turn travel memories into a colorful shareable bento box.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          {children}
          <AuthStatusButton />
        </AuthProvider>
      </body>
    </html>
  );
}
