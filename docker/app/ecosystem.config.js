module.exports = {
  apps: [
    {
      name: 'production',
      script: './dst/app.js',
      cwd: '.',
      watch: false,
      wait_ready: true,
      listen_timeout: 5000,
      node_args: '--harmony',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'development',
      script: './dst/app.js',
      cwd: '.',
      watch: './dst',
      wait_ready: true,
      listen_timeout: 5000,
      ignore_watch: './dst/public',
      node_args: '--harmony',
      env: {
        NODE_ENV: 'development'
      }
    }
  ]
}