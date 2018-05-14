import './robots.txt'
import './sitemap.xml'

import './index.html'
import './index.css'
import './imgs/langue.link.svg'
import './icons/svg-symbols.svg'

import riot from 'riot'
import 'riot-hot-reload'
import route from 'riot-route'
import './tags/*.tag'
riot.mount('view')
riot.mount('ribbon')

route(page => {
  riot.mount('content', `content-${page}`)
  riot.update()
})

Array.prototype.forEach.call(
  document.querySelectorAll('a[href]'),
  (a: HTMLAnchorElement) => {
    a.addEventListener('click', e => {
      e.preventDefault()
      if (location.pathname === a.pathname) return
      else route(a.pathname)
    })
  }
)

route.base('/')
route.start(true)
