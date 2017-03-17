import { writeFile } from "fs"
import { resolve as resolvePath, relative as relativePath, dirname } from "path"
import { mkdir } from "shelljs"
import { sync as matched } from "matched"
import { predicates, isLocal, resolve, VisitorHelper } from "html-imports-visitor"
import { serialize } from "parse5"
import { getAttribute, getTextContent, remove } from "dom5"

const entry = "\0rollup-plugin-html-entry:entry-point"

export default (config) => {
  let include = "**/*.html"
  let exclude = []
  let exporter = (path) => `export * from ${JSON.stringify(path)};`
  let output = false

  const configure = (options) => {
    if (typeof options === "string") {
      include = [options];
    } else if (Array.isArray(options)) {
      include = options
    } else {
      include = options.include || []
      exclude = options.exclude || []
      if (options.exports === false) {
        exporter = (path) => `import ${JSON.stringify(path)};`
      }
    }

    if (options.output) {
      output = options.output
    }
  }

  if (config) {
    configure(config)
  }

  const realPaths = {}
  const virtualPaths = {}
  const pathsList = []
  const htmls = {}
  const blackList = {}

  const visitor = {

    import(link, { location }) {
      if (output && blackList[location]) {
        remove(link)
      }
    },

    enter(document, { path }) {
      htmls[path] = document
    },

    visit(element, { path, index }) {
      realPaths[path] = true
      const src = getAttribute(element, "src")
      if (src) {
        if (isLocal(src)) {
          pathsList.push(resolve(path, src))
          if (output) {
            remove(element)
          }
        }
      } else {
        // (todo) should avoid possibile collision against real paths
        const virtualPath = `${path}_${index}.js`
        pathsList.push(virtualPath)
        virtualPaths[virtualPath] = getTextContent(element)
        if (output) {
          remove(element)
        }
      }
    }

  }

  const analyze = () => {

    if (include.length) {
      include = matched(
        include.concat(exclude.map((pattern) => `!${pattern}`)),
        { realpath: true }
      )
    }

    if (exclude.length) {
      exclude = matched(exclude, { realpath: true })
    }

    for (const i in exclude) {
      blackList[exclude[i]] = true
    }

    const helper = new VisitorHelper(visitor, predicates.hasTagName("script"))
    for (const i in include) {
      helper.enter(include[i])
    }
  }

  const writeHtmls = (destPath) => {
    const promises = []
    for (const filepath in htmls) {
      const doc = htmls[filepath]
      // (todo) check the correctness of path construction
      const destFilepath = resolvePath(destPath, relativePath("./", filepath))
      promises.push(new Promise((res, rej) => { // eslint-disable-line no-loop-func
        mkdir("-p", dirname(destFilepath))
        writeFile(destFilepath, serialize(doc), (err) => {
          if (err) {
            rej(err)
          } else {
            res()
          }
        })
      }))
    }
    return Promise.all(promises)
  }

  return {
    options(options) {
      if (options.entry && options.entry !== entry) {
        configure(options.entry)
      }
      options.entry = entry
      analyze()
    },

    resolveId(id) {
      if (id === entry) {
        return entry
      }

      if (id in virtualPaths) {
        return id
      }
    },

    load(id) {
      if (id === entry) {
        if (!pathsList.length) {
          return Promise.resolve("")
        }
        return new Promise(
          (res) => res(pathsList.map(exporter).join("\n"))
        )
      }

      if (id in virtualPaths) {
        return virtualPaths[id]
      }
    },

    ongenerate() {
      if (output) {
        return writeHtmls(output)
      }
    }
  }

}
