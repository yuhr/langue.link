import chokidar from 'chokidar'
import child_process from 'child_process'

const options = {
  './docker/app/ecosystem.config.js': 'docker-compose restart app',
  './docker/dnsmasq/*': 'docker-compose restart dnsmasq',
  './docker/haproxy/haproxy.cfg': 'docker-compose kill -s HUP haproxy',
  './docker/browser-sync/bs-config.js*': 'docker-compose restart browser-sync'

}

for (const key in options) {
  const option = typeof options[key] === 'string' ? {
    command: options[key]
  } : options[key]
  chokidar.watch(
    key,
    option.options || {}
  ).on(option.event || 'change', (event, path) => {
    if (!path) {
      path = event,
      event = option.event || 'change'
    }
    console.log(`${event} ${path}: running: '${option.command}'`)
    child_process.exec(option.command, {
      stdio: 'pipe',
      encoding: 'utf8'
    }).stdout.pipe(process.stdout)
  })
}