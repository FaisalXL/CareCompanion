/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        calm: {
          cream: "#F8F6F1",
          surface: "#FFFFFF",
          sage: "#8FB89A",
          "sage-light": "#D4E5D0",
          blue: "#7EB8D8",
          "blue-light": "#D0E4F4",
          amber: "#D4A574",
          "amber-light": "#F0D8B8",
          coral: "#E07470",
          "coral-light": "#F0A8A4",
          lavender: "#B8A8D0",
          "lavender-light": "#DCD0EC",
          text: "#2D3436",
          "text-secondary": "#636E72",
          "text-muted": "#949EA2",
          border: "#E8E4DE",
        },
      },
    },
  },
  plugins: [],
};
