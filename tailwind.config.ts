import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2E4A8B",
          dark: "#243A6F",
          darker: "#1C2D52",
        },
        navy: "#1A1D29",
        success: "#10B981",
        error: "#EF4444",
        match: "#FF9500",
      },
      fontFamily: {
        heading: ["Playfair Display", "Merriweather", "serif"],
        body: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.1)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.15)",
        modal: "0 10px 40px rgba(0,0,0,0.2)",
        sidebar: "0 4px 12px rgba(0,0,0,0.1)",
        "sticky-bottom": "0 -2px 10px rgba(0,0,0,0.1)",
      },
      maxWidth: {
        container: "1200px",
      },
    },
  },
  plugins: [],
};
export default config;
