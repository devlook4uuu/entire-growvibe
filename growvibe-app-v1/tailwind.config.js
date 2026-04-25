/** @type {import('tailwindcss').Config} */
import { Fonts } from "./constant/fonts";

module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}","./components/**/*.{js,jsx,ts,tsx}" ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        light: Fonts.light,
        regular: Fonts.regular, 
        medium: Fonts.medium,
        semiBold: Fonts.semiBold,
        bold: Fonts.bold,
        extraBold: Fonts.extraBold,
      },
    },
  },
  plugins: [],
}