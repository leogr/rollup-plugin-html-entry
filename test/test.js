const htmlEntry = require("../")
const { ok } = require("assert")
const { rollup } = require("rollup")

const includes = (string, substring) => {
  if (string.indexOf(substring) === -1) {
    ok(false, `expected ${JSON.stringify(string)} to include ${JSON.stringify(substring)}`)
  }
}

const doesNotInclude = (string, substring) => {
  if (string.indexOf(substring) !== -1) {
    ok(false, `expected ${JSON.stringify(string)} not to include ${JSON.stringify(substring)}`)
  }
}

const makeBundle = (entries) => {
  return rollup({ entry: entries, plugins: [htmlEntry()] })
}

describe("rollup-plugin-html-entry", () => {
  it("takes a single file as input", () =>
    makeBundle("test/fixtures/0.html").then((bundle) => {
      const code = bundle.generate({ format: "cjs" }).code
      includes(code, "exports.zero = zero;")
    })
  )

  it("takes an array of files as input", () =>
    makeBundle(["test/fixtures/0.html", "test/fixtures/1.html"]).then((bundle) => {
      const code = bundle.generate({ format: "cjs" }).code
      includes(code, "exports.zero = zero;")
      includes(code, "exports.one = one;")
    })
  )

  it("allows an empty array as input", () =>
    makeBundle([]).then((bundle) => {
      const code = bundle.generate({ format: "cjs" }).code
      doesNotInclude(code, "exports")
    })
  )

  it("takes a glob as input", () =>
    makeBundle("test/fixtures/{0,1}.html").then((bundle) => {
      const code = bundle.generate({ format: "cjs" }).code
      includes(code, "exports.zero = zero;")
      includes(code, "exports.one = one;")
    })
  )

  it("takes an array of globs as input", () =>
    makeBundle(["test/fixtures/{0,}.html", "test/fixtures/{1,}.html"]).then((bundle) => {
      const code = bundle.generate({ format: "cjs" }).code
      includes(code, "exports.zero = zero;")
      includes(code, "exports.one = one;")
    })
  )

  it("takes an {include,exclude} object as input", () =>
    makeBundle(
      { include: ["test/fixtures/*.html"], exclude: ["test/fixtures/1.html"] }
    ).then((bundle) => {
      const code = bundle.generate({ format: "cjs" }).code
      includes(code, "exports.zero = zero;")
      doesNotInclude(code, "exports.one = one;")
    })
  )

  it("allows to prevent exporting", () =>
    makeBundle(
      { include: ["test/fixtures/*.html"], exports: false }
    ).then((bundle) => {
      const code = bundle.generate({ format: "iife" }).code
      includes(code, `console.log("Hello, 2");`)
      doesNotInclude(code, "zero")
      doesNotInclude(code, "one")
    })
  )
})
