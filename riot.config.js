const fs = require('fs')

const rc = JSON.parse(fs.readFileSync('.postcssrc', 'utf8'))
const plugins = Object.entries(rc.plugins).map(pair =>
  require(pair[0])(pair[1])
)

module.exports = {
  parsers: {
    type: 'ts',
    style: 'cssnext',
    js: {
      ts: src => require('typescript').transpile(src)
    },
    css: {
      cssnext: (tagname, src, opts, url) => {
        src = src.replace(/:scope/g, ':root')
        src = require('postcss')(plugins).process(src).css
        src = src.replace(/:root/g, ':scope')
        return src
      }
    }
  }
}
