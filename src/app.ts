import fs from 'fs'
import { URLSearchParams } from 'url'

import * as Type from 'runtypes'
import nanoid from 'nanoid'

import Koa from 'koa'
import Router from 'koa-router'
import bodyparser from 'koa-bodyparser'
import cors from 'kcors'
import send from 'koa-send'
import session from 'koa-session'
import helmet from 'koa-helmet'
import proxy from 'koa-proxies'
import passport from 'koa-passport'
import { Strategy as CustomStrategy } from 'passport-custom'

import Provider from 'oidc-provider'
import { Issuer } from 'openid-client'

import { Account } from './db/account'

const IS_PROD = 'production' === process.env.NODE_ENV
const URL_HOST = IS_PROD ? 'langue.link' : 'langue.link'
const keys = JSON.parse(fs.readFileSync('./.secret/.keys.json').toString())

const app = new Koa
app.listen(8000)

app.keys = ['a', 'b', 'c']
app.use(bodyparser())
app.use(session(app))
app.use(cors({
  origin: URL_HOST
}))

const router = new Router
app.use(router.routes())
app.use(router.allowedMethods())

// static
app.use(async (ctx, next) => {
  if (/^\/$/.test(ctx.path)) {
    await helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        fontSrc: ["'self'", 'fonts.googleapis.com', 'fonts.gstatic.com'],
        connectSrc: ["'self'", 'wss:', 'http:']
      }
    })(ctx, next)
  } else await next()
})

app.use(async (ctx, next) => {
  const resolve = (filename: string) => `./dst/static/${filename}`
  switch (true) {
  case /^\/$/.test(ctx.path):
    await send(ctx, resolve('index.html'))
    break
  case /^\/index$/.test(ctx.path):
    ctx.status = 301
    await send(ctx, '/')
    break
  case /^\/.+\.html$/.test(ctx.path):
    ctx.status = 301
    await send(ctx, `/${ctx.path.match(/^\/(.+).html$/)![1]}`)
    break
  case /^\/api\/.+$/.test(ctx.path):
    await next()
    break
  default:
    await send(ctx, resolve(ctx.path.replace(/^\/(.+)$/, '$1')))
  }
})

const oidc = new Provider('https://langue.link', {
  features: {
    devInteractions: false,
    claimsParameter: true,
    discovery: true,
    encryption: true,
    introspection: true,
    registration: true,
    request: true,
    revocation: true,
    sessionManagement: true
  },
  routes: {
    authorization: '/api/oidc/auth',
    certificates: '/api/oidc/certs',
    check_session: '/api/oidc/session/check',
    end_session: '/api/oidc/session/end',
    introspection: '/api/oidc/token/introspection',
    registration: '/api/oidc/reg',
    revocation: '/api/oidc/token/revocation',
    token: '/api/oidc/token',
    userinfo: '/api/oidc/me'
  },
  claims: {
    address: ['address'],
    email: ['email', 'email_verified'],
    phone: ['phone_number', 'phone_number_verified'],
    profile: ['birthdate', 'family_name', 'gender', 'given_name', 'locale', 'middle_name', 'name',
      'nickname', 'picture', 'preferred_username', 'profile', 'updated_at', 'website', 'zoneinfo']
  },
  scopes: ['openid', 'email'],
  cookies: {
    keys: ['a', 'b', 'c'],
    names: {
      session: '_session',
      interaction: '_grant',
      resume: '_grant',
      state: '_state'
    }
  },
  interactionUrl: async (ctx: any, interaction: any) => {
    return `https://langue.link/api/auth/interaction/${ctx.oidc.uuid}`
  },
  findById: Account.findById
})
oidc.initialize({
  clients: [{
    client_id: 'https://langue.link',
    client_secret: 'secret',
    redirect_uris: [`https://${URL_HOST}/api/auth/callback`],
    scope: 'openid email'
  }]
}).then(() => {
  oidc.use(helmet())

  router.get('/api/auth/interaction/:grant', async (ctx, next) => {
    console.log('/api/auth/interaction/:grant')
    const details = await oidc.interactionDetails(ctx.req)
    const client = await oidc.Client.find(details.params.client_id)
    if (details.interaction.error === 'login_required') {
      // mimic login form fill
      const endpoint = `https://langue.link/api/auth/interaction/${details.uuid}/login`
      const { email, password } = ctx.session!.cred
      const data: { [key: string]: string } = {
        uuid: details.uuid,
        login: email,
        password,
        remember: 'no'
      }
      const params = new URLSearchParams
      for (const key in data) params.append(key, data[key])
      const url = `${endpoint}?${params.toString()}`
      ctx.redirect(url)
      ctx.status = 303
    } else {
      const endpoint = `https://langue.link/api/auth/interaction/${details.uuid}/confirm`
      const data: { [key: string]: string } = {
        uuid: details.uuid
      }
      const params = new URLSearchParams
      for (const key in data) params.append(key, data[key])
      const url = `${endpoint}?${params.toString()}`
      ctx.redirect(url)
      ctx.status = 303
    }
    await next()
  })

  router.get('/api/auth/interaction/:grant/login', bodyparser(), async (ctx, next) => {
    console.log('/api/auth/interaction/:grant/login')
    const { email, password } = ctx.session!.cred
    const account = await Account.find(await Account.identify(email))
    const result = {
      login: {
        account: account.accountId,
        acr: 'urn:mace:incommon:iap:bronze',
        amr: ['pwd'],
        remember: true,
        ts: Math.floor(Date.now() / 1000)
      },
      consent: {}
    }
    const id = ctx.cookies.get(oidc.cookieName('interaction'), {
      signed: false
    })
    const interaction = await oidc.Session.find(id)
    interaction.result = result
    await interaction.save(60)
    interaction.returnTo = interaction.returnTo.replace(/^https:\/\/localhost:7999/, 'https://langue.link')
    ctx.session!.accountId = account.accountId
    ctx.redirect(interaction.returnTo)
    ctx.status = 303
    await next()
  })

  router.get('/api/auth/interaction/:grant/confirm', bodyparser(), async (ctx, next) => {
    console.log('/api/auth/interaction/:grant/confirm')
    const result = { consent: {} }
    const id = ctx.cookies.get(oidc.cookieName('interaction'), {
      signed: false
    })
    const interaction = await oidc.Session.find(id)
    interaction.result = result
    await interaction.save(60)
    interaction.returnTo = interaction.returnTo.replace(/^https:\/\/localhost:7999/, 'https://langue.link')
    ctx.redirect(interaction.returnTo)
    ctx.status = 303
    await next()
  })

  oidc.app.listen(7999)
  oidc.app.proxy = true

  app.use(proxy('/api/oidc/*', {
    target: 'http://localhost:7999',
    changeOrigin: true
  }))

  Issuer.discover('http://localhost:7999').then((issuer: any) => {
    process.stdout.write('Discovered issuer.')
    const client = new issuer.Client({
      client_id: 'https://langue.link',
      client_secret: 'secret'
    })

    router.post('/api/auth/oidc', bodyparser(), async (ctx, next) => {
      console.log('/api/auth/oidc')
      const sessionKey = 'langue.link'
      const params = {
        state: nanoid(),
        nonce: nanoid()
      }
      ctx.session![sessionKey] = params
      const url = client.authorizationUrl(params).replace(/^http:\/\/localhost:7999/, 'https://langue.link')
      ctx.session!.cred = ctx.request.body
      ctx.redirect(url)
      ctx.status = 303
      await next()
    })

    router.get('/api/auth/callback', bodyparser(), async (ctx, next) => {
      console.log('/api/auth/callback')
      const reqParams = client.callbackParams(ctx.req)
      const sessionKey = 'langue.link'
      const session = ctx.session![sessionKey]
      const state = session.state
      const nonce = session.nonce
      try {
        delete ctx.session![sessionKey]
      } catch (err) {
        console.log(err)
      }
      const checks = { state, nonce }
      const result: any = {}
      result.tokenset = await client.authorizationCallback(
        `https://${URL_HOST}/api/auth/callback`, reqParams, checks)
      if (result.tokenset.access_token) {
        result.userinfo = await client.userinfo(result.tokenset)
      }
      // verify here
      ctx.body = result
    })
  }).catch((error: any) => {
    console.log(error)
  })
}).catch((error: any) => {
  console.log(error)
})

console.log('Listening on port 8000')
process.send!('ready')