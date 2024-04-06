const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  // Don't warn about unused 't' variables in tests
  {
    files: ["tests/**"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Allow casting to any in tests
  {
    files: ["tests/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // I'm cool with explicitly casting to any as generally the alternative is so
  // verbose as to be unhelpful
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
