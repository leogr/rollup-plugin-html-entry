import buble from "rollup-plugin-buble"
import nodeResolve from "rollup-plugin-node-resolve"
import commonjs from "rollup-plugin-commonjs"

const pkg = require("./package.json")

export default {
  input: "index.js",
  plugins: [
    buble({
      include: "index.js",
      target: {
        node: "4"
      }
    }),
    nodeResolve({
      jsnext: true,
      main: true
    }),
    commonjs()
  ],
  external: Object.keys(pkg["dependencies"]).concat("path", "fs"),
  output: [
    {
      format: "cjs",
      file: pkg["main"]
    },
    {
      format: "es",
      file: pkg["jsnext:main"]
    }
  ]
}
