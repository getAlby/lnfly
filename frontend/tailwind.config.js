import { fontFamily } from "tailwindcss/defaultTheme";

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./index.html"],
  theme: {
    fontFamily: {
      sans: ["Inter var", ...fontFamily.sans],
    },
    extend: {},
  },
};
