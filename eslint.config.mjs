import next from "eslint-config-next";
import tseslint from "typescript-eslint";

export default [
  ...next(),
  ...tseslint.configs.recommended
];