import { defineConfig } from "eslint/config"
import tseslint from "typescript-eslint"
import globals from "globals"

export default defineConfig({
  files: ["**/*.js", "types/**/*.d.ts"],
  ignores: ["node_modules/**"],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      project: ["./tsconfig.json", "./tsconfig.tests.json"],
      tsconfigRootDir: import.meta.dirname
    },
    globals: {
      ...globals.node
    }
  },
  plugins: {
    "@typescript-eslint": tseslint.plugin
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-argument": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-return": "error",
    "@typescript-eslint/no-unsafe-type-assertion": "error"
  }
})
