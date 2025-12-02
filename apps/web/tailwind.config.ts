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
      },
    }
  },
  plugins: [require("tailwindcss-animate")]
} satisfies Config;
