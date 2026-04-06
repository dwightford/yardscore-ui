/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* ── Garden Voice Design System ─────────────────────── */

        // Primary — deep forest green family
        forest: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#2d6a4f", // primary brand
          700: "#1b4332",
          800: "#0d2818",
          900: "#0d1f17", // dark bg
          950: "#07110c", // darkest bg
        },

        // Amber/Gold — scores, earnings, warmth
        amber: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },

        // Terracotta — highlights, secondary actions
        terra: {
          400: "#e07c5a",
          500: "#c4633f",
          600: "#a84e2f",
        },

        // Sage — subtle backgrounds, cards, borders
        sage: {
          50: "#f6f7f4",
          100: "#eaede5",
          200: "#d5dbc9",
          300: "#b5c0a5",
          400: "#94a67e",
          500: "#768b5f",
        },

        // Sky — links, interactive
        sky: {
          400: "#38bdf8",
          500: "#0ea5e9",
        },

        // Garden-specific data colors
        plant: "#22c55e",
        building: "#6b7280",
        boundary: "#ef4444",
        anchor: "#f59e0b",
        light: "#fbbf24",
      },

      fontFamily: {
        // Warm serif for headlines — the garden has gravitas
        display: ['"Instrument Serif"', "Georgia", "serif"],
        // Clean sans for body
        sans: ['"Inter"', "system-ui", "-apple-system", "sans-serif"],
        // Monospace for data
        mono: ['"JetBrains Mono"', "Menlo", "monospace"],
      },

      fontSize: {
        // Garden voice — slightly larger, warm
        "garden-sm": ["0.9375rem", { lineHeight: "1.5" }],
        "garden-base": ["1.0625rem", { lineHeight: "1.6" }],
        "garden-lg": ["1.1875rem", { lineHeight: "1.5" }],
      },

      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },

      boxShadow: {
        "card": "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
        "card-lg": "0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.10)",
        "glow-green": "0 0 20px rgba(45,106,79,0.3)",
        "glow-amber": "0 0 20px rgba(245,158,11,0.3)",
      },

      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
        "pulse-gentle": "pulseGentle 2s ease-in-out infinite",
      },

      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulseGentle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
    },
  },
  plugins: [],
};
