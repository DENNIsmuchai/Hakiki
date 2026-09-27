/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0F172A",
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
          950: "#020617",
        },
        yellow: {
          50: "#FEF9E7",
          100: "#FCF3CF",
          200: "#F9E79F",
          300: "#F7DC6F",
          400: "#F4D03F",
          500: "#F1C40F",
          600: "#D4AC0D",
          700: "#B7950B",
          800: "#9A7D0A",
          900: "#7D6608",
        },
        brand: {
          yellow: "#FFC229",
          "yellow-deep": "#E29200",
          navy: "#0F172A",
          "navy-light": "#1E293B",
        },
        paper: "#FFFEF7",
        terracotta: "#D2491E",
        "terracotta-light": "#FDF1EC",
        savanna: "#3C6E47",
        "savanna-light": "#E8F3EA",
        sky: "#1E6FB0",
        "sky-light": "#E8F2FB",
      },
      fontFamily: {
        display: ['"Bebas Neue"', '"Arial Narrow"', "sans-serif"],
        body: ['"Manrope"', "-apple-system", '"Segoe UI"', "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        hard: "4px 4px 0 #0F172A",
        "hard-sm": "2px 2px 0 #0F172A",
        "hard-lg": "6px 6px 0 #0F172A",
        soft: "0 4px 20px rgba(15, 23, 42, 0.08)",
        "soft-lg": "0 12px 40px rgba(15, 23, 42, 0.12)",
        glow: "0 0 20px rgba(255, 194, 41, 0.3)",
        "glow-lg": "0 0 40px rgba(255, 194, 41, 0.4)",
      },
      transitionProperty: {
        smooth: "all",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: ".5" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.5s ease-out forwards",
        shimmer: "shimmer 2s infinite",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};
