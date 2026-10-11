import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import esbuild from "rollup-plugin-esbuild";
import { babel } from "@rollup/plugin-babel";

const dev = process.env.ROLLUP_WATCH;

export default {
  input: "src/main.ts",
  output: {
    file: "dist/nunjucks-entity-row.js",
    format: "es",
  },
  plugins: [
    nodeResolve({ browser: true, preferBuiltins: false }),
    commonjs(),
    json(),
    esbuild({
      minify: !dev,
      target: 'es2022',
      tsconfig: './tsconfig.json'
    }),
    babel({
      presets: [["@babel/preset-env", { modules: false }]],
      babelHelpers: "bundled",
      extensions: [".js", ".jsx", ".ts", ".tsx"]
    }),
  ],
};
