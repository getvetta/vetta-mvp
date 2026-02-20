import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lets us use "next/core-web-vitals" + "next/typescript" in flat config style
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  // Base JS rules
  js.configs.recommended,

  // Next.js recommended rules (works reliably on Vercel)
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // TS recommended rules (flat)
  ...tseslint.configs.recommended,

  // React recommended rules (flat)
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: { react },
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      "no-unused-vars": "warn",
      "react/react-in-jsx-scope": "off",
      "@next/next/no-img-element": "off",
    },
    settings: {
      react: { version: "detect" },
    },
  },
];