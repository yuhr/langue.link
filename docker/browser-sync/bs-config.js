module.exports = {
  ui: {
    port: 8002
  },
  files: './dst/static/**/*',
  proxy: 'http://app:8000',
  port: 8001,
  logLevel: 'debug',
  logConnections: true,
  logFileChanges: true,
  logSnippet: true,
  open: false,
  cors: true,
  reloadOnRestart: true,
  socket: {
    domain: 'langue.link'
  }
}