import { writeFile, readdirSync, mkdirSync } from "fs"
import { resolve as resolvePath, relative as relativePath, dirname } from "path"
import { sync as matched } from "matched"
import { predicates, isLocal, resolve, VisitorHelper } from "html-imports-visitor"
import { serialize } from "parse5"
import { getAttribute, getTextContent, remove } from "dom5"

const mkdir = (path) => {
  try {
    readdirSync(path)
  } catch (err) {
    mkdir(dirname(path))
    mkdirSync(path)
  }
}

const writeFileEx = (path, doc) => (res, rej) => {
  writeFile(path, serialize(doc), (err) => err ? rej(err) : res())
}

const mkdirEx = (path) => (res, rej) => {
  try {
    mkdir(path)
    res()
  } catch (err) {
    rej(err)
  }
}

const writeHtmls = (htmls, destPath) => {

  const executors = {}
  for (const filepath in htmls) {
    const destFilepath = resolvePath(destPath, relativePath(process.cwd(), filepath))
    const destDirpath = dirname(destFilepath)
    const ex = writeFileEx(destFilepath, htmls[filepath])
    if (executors[destDirpath]) {
      executors[destDirpath].push(ex)
    } else {
      executors[destDirpath] = [ex]
    }
  }

  return Promise.all(
    Object.keys(executors).map(
      (path) => new Promise(mkdirEx(path)).then(
        Promise.all(
          executors[path].map((ex) => new Promise(ex))
        )
      )
    )
  )
}

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
        return writeHtmls(htmls, output)
      }
    }
  }

}
