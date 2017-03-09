import buble from "rollup-plugin-buble"
import nodeResolve from "rollup-plugin-node-resolve"
import commonjs from "rollup-plugin-commonjs"

const pkg = require("./package.json")

export default {
  entry: "index.js",
  plugins: [
    buble({
      include: "index.js",
      target: {
        node: "0.12"
      }
    }),
    nodeResolve({
      jsnext: true,
      main: true
    }),
    commonjs()
  ],
  external: Object.keys(pkg["dependencies"]).concat("path", "fs"),
  targets: [
    {
      format: "cjs",
      dest: pkg["main"]
    },
    {
      format: "es",
      dest: pkg["jsnext:main"]
    }
  ]
}
