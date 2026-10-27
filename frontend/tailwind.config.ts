import type { Config } from "tailwindcss";
// Neo-Sovereign palette from the brief
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: {
    obsidian: { DEFAULT: "#0F172A", 700: "#1E293B", 600: "#334155" },
    sov: "#0284C7", gold: "#F59E0B", verdant: "#10B981",
  }, fontFamily: { sans: ["var(--font-mukta)", "system-ui", "sans-serif"] } } },
  plugins: [],
} satisfies Config;
