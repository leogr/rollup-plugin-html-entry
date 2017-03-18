const htmlEntry = require("../")
const { ok } = require("assert")
const { rollup } = require("rollup")
const fs = require("fs")
const matched = require("matched").sync

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

const fileExists = (path) => {
 if (!fs.existsSync(path) || fs.lstatSync(path).isDirectory()) {
   ok(false, `expected output file ${JSON.stringify(path)}`)
 }
}

const fileDoesNotIncludes = (path, substring) => {
  if (fs.existsSync(path) && fs.readFileSync(path).indexOf(substring) !== -1) {
    ok(false, `expected output file ${JSON.stringify(path)} not to include ${JSON.stringify(substring)}`)
  }
}

const makeBundle = (entries) => {
  return rollup({ entry: entries, plugins: [htmlEntry()] })
}


const rmDirectoryRecursive = (path) => {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach((file) => {
      const curPath = `${path}/${file}`
      if (fs.lstatSync(curPath).isDirectory()) {
        rmDirectoryRecursive(curPath)
      } else {
        fs.unlinkSync(curPath)
      }
    })
    fs.rmdirSync(path)
  }
}

describe("rollup-plugin-html-entry", () => {

  afterEach(() => {
    rmDirectoryRecursive("tmp")
  })

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

  it("writes html files into destination and strips scripts", () =>
    makeBundle(
      { include: ["test/fixtures/*.html"], output: "tmp" }
    ).then(
      (bundle) => bundle.write({ format: "es", dest: "tmp/bundle.js"})
    ).then(() => {
      matched(["tmp/test/fixtures/*.html"]).forEach((path) => {
        fileExists(path)
        fileDoesNotIncludes(path, "<script>")
      })
    })
  )

  it("bundles spec example in proper ordering", () =>
    makeBundle(
      { include: ["test/fixtures/spec-example/*.html"] }
    ).then((bundle) => {
      const code = bundle.generate({ format: "es" }).code
      includes(code, `console.log('a.html');

console.log('b.html');

console.log('d.html');

console.log('f.html');

console.log('c.html');

console.log('e.html');

console.log('h.html');

console.log('g.html');`)
    })
  )

})
