import type { Metadata, Viewport } from "next";
import { Mukta } from "next/font/google";
import "./globals.css";

// Mukta covers Latin + Devanagari in one family, so English and Hindi labels share a voice.
const mukta = Mukta({ subsets: ["latin", "devanagari"], weight: ["400", "600", "700", "800"], variable: "--font-mukta" });
export const metadata: Metadata = { title: "PRIS — Prajna Regional Intelligence System", description: "Spatial intelligence for livelihood and research across Uttar Pradesh." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0F172A" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className={`${mukta.variable} font-sans`}>{children}</body></html>;
}
