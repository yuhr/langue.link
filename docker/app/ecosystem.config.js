module.exports = {
  apps: [
    {
      name: 'production',
      script: './dst/app.js',
      cwd: '.',
      watch: false,
      wait_ready: true,
      node_args: '--harmony',
      watch_options: {
        usePolling: true
      },
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
      ignore_watch: './dst/static',
      node_args: '--harmony',
      watch_options: {
        usePolling: true
      },
      env: {
        NODE_ENV: 'development'
      }
    }
  ]
}