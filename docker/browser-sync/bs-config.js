module.exports = {
  ui: {
    port: 8002
  },
  files: './dst/static/**/*',
  proxy: 'http://app:8000',
  port: 8001,
  //logLevel: 'debug',
  //logConnections: true,
  //logFileChanges: true,
  //logSnippet: true,
  open: false,
  cors: true,
  reloadOnRestart: true,
  socket: {
    domain: 'https://langue.link'
  },
  watchOptions: {
    usePolling: true
  },
  snippetOptions: {
    // Provide a custom Regex for inserting the snippet.
    rule: {
        match: /$/,
        fn: (snippet, match) => snippet
    }
  }
}