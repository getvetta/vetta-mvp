/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}", // ✅ covers /pages if used
  ],
  darkMode: "class", // ✅ controlled by ThemeToggle
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1E3A8A", // Main Vetta blue
          light: "#3B82F6",   // lighter accent
          dark: "#1E40AF",    // darker variant
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 4px 20px rgba(0,0,0,0.1)",
        soft: "0 2px 10px rgba(0,0,0,0.08)",
      },
      screens: {
        "xs": "480px", // ✅ extra-small devices
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),       // ✅ better form defaults
    require("@tailwindcss/typography"),  // ✅ prose styling
    require("@tailwindcss/aspect-ratio") // ✅ responsive embeds/images
  ],
};
