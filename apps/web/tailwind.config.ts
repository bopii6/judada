import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#f97316", // orange-500
          foreground: "#ffffff"
        },
        // New "Cute & Playful" Palette
        bubblegum: "#FF8BA7",
        sunshine: "#FFC75F",
        mint: "#C7F9CC",
        sky: "#4D96FF",
        cream: "#FFFDF9",
      },
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
      },
      animation: {
        blob: "blob 7s infinite",
        "maodou-float": "maodou-float 3.5s ease-in-out infinite",
        "maodou-spin": "maodou-spin 10s linear infinite",
        "maodou-spin-fast": "maodou-spin 6s linear infinite",
        "maodou-pulse": "maodou-pulse 3s ease-in-out infinite",
        "maodou-progress": "maodou-progress 2.4s ease-in-out infinite",
        "maodou-run": "maodou-run 2.4s ease-in-out infinite"
      },
      keyframes: {
        blob: {
          "0%": {
            transform: "translate(0px, 0px) scale(1)",
          },
          "33%": {
            transform: "translate(30px, -50px) scale(1.1)",
          },
          "66%": {
            transform: "translate(-20px, 20px) scale(0.9)",
          },
          "100%": {
            transform: "translate(0px, 0px) scale(1)",
          },
        },
        "maodou-float": {
          "0%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
          "100%": { transform: "translateY(0px)" }
        },
        "maodou-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" }
        },
        "maodou-pulse": {
          "0%": { opacity: 0.45, transform: "scale(0.95)" },
          "50%": { opacity: 0.8, transform: "scale(1.05)" },
          "100%": { opacity: 0.45, transform: "scale(0.95)" }
        },
        "maodou-progress": {
          "0%": { width: "15%" },
          "40%": { width: "55%" },
          "100%": { width: "95%" }
        },
        "maodou-run": {
          "0%": { transform: "translateX(0)" },
          "70%": { transform: "translateX(calc(100% - 4rem))" },
          "100%": { transform: "translateX(calc(100% - 4rem))" }
        }
      },
    }
  },
  plugins: [require("tailwindcss-animate")]
} satisfies Config;
