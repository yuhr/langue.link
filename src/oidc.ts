import fs from 'fs'
import path from 'path'

const IS_PROD = 'production' === process.env.NODE_ENV
const URL = IS_PROD ? 'https://langue.link' : 'http://localhost:4000'
const URL_DB = IS_PROD ? `${URL}/db` : 'http://localhost:3001'
const keys = JSON.parse(fs.readFileSync(path.resolve('.keys.json')).toString())

import Provider from 'oidc-provider'
const config = {}
const clients = [{
  client_id: 'foo',
  client_secret: 'bar',
  redirect_uris: [`${URL}/auth/callback`],
  scope: 'openid email'
}]

const oidc = new Provider('http://localhost:3030', config)
oidc.initialize({ clients }).then(() => {
  console.log(oidc.callback)
  console.log(oidc.app)
  oidc.app.listen(3030)
})