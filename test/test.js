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
    ok(false, `expected output file ${JSON.stringify(path)} to exist`)
  }
}

const fileDoesNotExist = (path) => {
  if (fs.existsSync(path)) {
    ok(false, `expected output file ${JSON.stringify(path)} to not exist`)
  }
}

const fileDoesNotInclude = (path, substring) => {
  if (fs.existsSync(path) && fs.readFileSync(path).indexOf(substring) !== -1) {
    ok(false, `expected output file ${JSON.stringify(path)} not to include ${JSON.stringify(substring)}`)
  }
}

const fileIncludes = (path, substring) => {
  if (fs.existsSync(path) && fs.readFileSync(path).indexOf(substring) === -1) {
    ok(false, `expected output file ${JSON.stringify(path)} to include ${JSON.stringify(substring)}`)
  }
}

const makeBundle = (entries) => {
  return rollup({ input: entries, plugins: [htmlEntry()] })
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
    makeBundle("test/fixtures/0.html").then((bundle) =>
      bundle.generate({ format: "cjs" }).then(({ code }) => {
        includes(code, "exports.zero = zero;")
      })
    )
  )

  it("takes an array of files as input", () =>
    makeBundle(["test/fixtures/0.html", "test/fixtures/1.html"]).then((bundle) =>
      bundle.generate({ format: "cjs" }).then(({ code }) => {
        includes(code, "exports.zero = zero;")
        includes(code, "exports.one = one;")
      })
    )
  )

  it("allows an empty array as input", () =>
    makeBundle([]).then((bundle) =>
      bundle.generate({ format: "cjs" }).then(({ code }) => {
        doesNotInclude(code, "exports")
      })
    )
  )

  it("takes a glob as input", () =>
    makeBundle("test/fixtures/{0,1}.html").then((bundle) =>
      bundle.generate({ format: "cjs" }).then(({ code }) => {
        includes(code, "exports.zero = zero;")
        includes(code, "exports.one = one;")
      })
    )
  )

  it("takes an array of globs as input", () =>
    makeBundle(["test/fixtures/{0,}.html", "test/fixtures/{1,}.html"]).then((bundle) =>
      bundle.generate({ format: "cjs" }).then(({ code }) => {
        includes(code, "exports.zero = zero;")
        includes(code, "exports.one = one;")
      })
    )
  )

  it("takes an {include,exclude} object as input", () =>
    makeBundle(
      { include: ["test/fixtures/*.html"], exclude: ["test/fixtures/1.html"] }
    ).then((bundle) =>
      bundle.generate({ format: "cjs" }).then(({ code }) => {
        includes(code, "exports.zero = zero;")
        includes(code, `console.log("Hello, 2");`)
        doesNotInclude(code, "exports.one = one;")
      })
    )
  )

  it("takes an {include,external,output} object as input", () =>
    makeBundle(
      { include: ["test/fixtures/all-imports.html"], external: ["test/fixtures/1.html"], output: "tmp" }
    ).then((bundle) =>
      bundle.generate({ format: "cjs" }).then(({ code }) => {
        includes(code, "exports.zero = zero;")
        includes(code, `console.log("Hello, 2");`)
        doesNotInclude(code, "exports.one = one;")
        return bundle.write({ format: "es", file: "tmp/bundle.js"})
      })
    ).then(() => {
      matched(["tmp/test/fixtures/*.html", "!tmp/test/fixtures/1.html"]).forEach((path) => {
        fileExists(path)
        fileDoesNotInclude(path, "<script>")
      })
      fileExists("test/fixtures/1.html")
      fileIncludes("test/fixtures/1.html", "<script>export const one = 1;</script>")
    })
  )

  it("takes an {include,external,exclude,output} object as input", () =>
    makeBundle({
        include: ["test/fixtures/all-imports.html"],
        external: ["test/fixtures/0-and-1.html"],
        exclude: ["test/fixtures/3.html"],
        output: "tmp"
    }).then((bundle) =>
      bundle.generate({ format: "cjs" }).then(({ code }) => {
        doesNotInclude(code, "exports.zero = zero;") // external
        doesNotInclude(code, "exports.one = one;") // external
        doesNotInclude(code, `export const three = 3;`) // excluded
        includes(code, `console.log("Hello, 2");`)
        return bundle.write({ format: "es", file: "tmp/bundle.js"})
      })
    ).then(() => {

      fileExists("tmp/test/fixtures/all-imports.html")
      fileIncludes("tmp/test/fixtures/all-imports.html", `<link rel="import" href="0.html">`) // external
      fileIncludes("tmp/test/fixtures/all-imports.html", `<link rel="import" href="1.html">`) // external
      fileIncludes("tmp/test/fixtures/all-imports.html", `<link rel="import" href="2.html">`)
      fileDoesNotInclude("tmp/test/fixtures/all-imports.html", `<link rel="import" href="3.html">`) // excluded

      fileExists("tmp/test/fixtures/2.html")
      fileDoesNotInclude("tmp/test/fixtures/2.html", "<script>")

      fileDoesNotExist("tmp/test/fixtures/0-and-1.html")
      fileDoesNotExist("tmp/test/fixtures/0.html")
      fileDoesNotExist("tmp/test/fixtures/1.html")
      fileDoesNotExist("tmp/test/fixtures/3.html")

    })
  )

  it("allows to prevent exporting", () =>
    makeBundle(
      { include: ["test/fixtures/*.html"], exports: false }
    ).then((bundle) =>
      bundle.generate({ format: "iife" }).then(({ code }) => {
        includes(code, `console.log("Hello, 2");`)
        doesNotInclude(code, "zero")
        doesNotInclude(code, "one")
      })
    )
  )

  it("writes html files into destination and strips scripts", () =>
    makeBundle(
      { include: ["test/fixtures/*.html"], output: "tmp" }
    ).then(
      (bundle) => bundle.write({ format: "es", file: "tmp/bundle.js"})
    ).then(() => {
      matched(["tmp/test/fixtures/*.html"]).forEach((path) => {
        fileExists(path)
        fileDoesNotInclude(path, "<script>")
      })
    })
  )

  it("bundles spec example in proper ordering", () =>
    makeBundle(
      { include: ["test/fixtures/spec-example/*.html"] }
    ).then((bundle) =>
      bundle.generate({ format: "cjs" }).then(({ code }) => {
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
  )

})
