import fs from 'fs'
import path from 'path'
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
import mount from 'koa-mount'
import rewrite from 'koa-rewrite'

import Provider from 'oidc-provider'
import { Issuer } from 'openid-client'
import httpsProxyAgent from 'https-proxy-agent'

import { Account, Credentials } from './db/account'

const IS_PROD = 'production' === process.env.NODE_ENV
const keys = JSON.parse(fs.readFileSync('./.secret/.keys.json', 'utf8'))

const app = new Koa
app.proxy = true
app.listen(8000)

app.keys = ['a', 'b', 'c']
app.use(session(app))
app.use(cors({
  allowMethods: 'GET,HEAD,POST',
  origin: IS_PROD ? 'langue.link' : 'langue.link localhost:8002'
}))

const router = new Router
app.use(router.routes())
app.use(router.allowedMethods())

// static
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    fontSrc: ["'self'", 'fonts.googleapis.com', 'fonts.gstatic.com'],
    connectSrc: ["'self'"].concat(IS_PROD ? [] : ['wss:'])
  }
}))

app.use(async (ctx, next) => {
  const resolve = (path: string) => `./dst/static${path}`
  const hasExtention = 1 < path.extname(ctx.path).length
  if (ctx.path.startsWith('/api')) try {
    console.log(`${ctx.method} ${ctx.path}`)
    await next()
  } catch (err) {
    console.log(err.message)
  } else if (hasExtention) try {
    await send(ctx, resolve(ctx.path))
  } catch (err) {
    console.log(err.message)
  } else if (ctx.path.startsWith('/docs')) try {
    if (!hasExtention && !ctx.path.endsWith('/')) {
      ctx.redirect(`${ctx.url}/`)
      ctx.status = 301
    } else {
      await send(ctx, resolve(ctx.path.endsWith('/') ? `${ctx.path}index.html` : ctx.path))
    }
  } catch (err) {
    console.log(err.message)
  } else await send(ctx, resolve('/index.html'))
})

const oidc = new Provider('https://langue.link', {
  features: {
    devInteractions: false,
    encryption: true,
    introspection: true,
    registration: true,
    request: true,
    revocation: true
  },
  routes: {
    authorization: '/auth',
    certificates: '/certs',
    check_session: '/session/check',
    end_session: '/session/end',
    introspection: '/token/introspection',
    registration: '/reg',
    revocation: '/token/revocation',
    token: '/token',
    userinfo: '/me'
  },
  claims: {
    address: ['address'],
    email: ['email', 'email_verified'],
    phone: ['phone_number', 'phone_number_verified'],
    profile: ['birthdate', 'gender', 'locale', 'name', 'nickname', 'picture', 'preferred_username', 'profile', 'updated_at', 'website', 'zoneinfo', 'username']
  },
  scopes: ['openid'],
  cookies: {
    keys: ['a', 'b', 'c'],
    names: {
      session: '_session',
      interaction: '_grant',
      resume: '_grant',
      state: '_state'
    },
    short: {
      signed: true
    }
  },
  discovery: {
    service_documentation: 'https://langue.link/docs/',
    // TODO: need more considerations
    claims_locales_supported: undefined,
    ui_locales_supported: undefined
  },
  interactionUrl: async (ctx: any, interaction: any) => {
    return `/api/auth/interaction/${ctx.oidc.uuid}`
  },
  interactionCheck: async (ctx: any) => {
    if (!ctx.oidc.session.sidFor(ctx.oidc.client.clientId)) {
      return {
        error: 'consent_required',
        error_description: 'client not authorized for End-User session yet',
        reason: 'client_not_authorized'
      }
    } else if (
      ctx.oidc.client.applicationType === 'native' &&
      ctx.oidc.params.response_type !== 'none' &&
      !ctx.oidc.result) { // TODO: in 3.x require consent to be passed in results
      return {
        error: 'interaction_required',
        error_description: 'native clients require End-User interaction',
        reason: 'native_client_prompt'
      }
    }
    return false
  },
  findById: Account.findById
})
oidc.initialize({
  clients: [{
    client_id: keys.OIDC_LANGUE_CLIENT_ID,
    client_secret: keys.OIDC_LANGUE_CLIENT_SECRET,
    redirect_uris: ['https://langue.link/api/auth/callback']
  }]
}).then((provider: any) => {
  const prefix = '/api/oidc'
  app.use(rewrite('/.well-known/(.*)', `${prefix}/.well-known/$1`))
  app.use(mount(prefix, oidc.app))

  router.get('/api/auth/interaction/:grant', async ctx => {
    const details = await oidc.interactionDetails(ctx.req)
    //const client = await oidc.Client.find(details.params.client_id)
    // TODO: response a login form html
    console.log(details.interaction.error)
    if (details.interaction.error === 'login_required') {
      // mimic login form fill
      const endpoint = `https://langue.link/api/auth/interaction/${details.uuid}/login`
      const { email, password } = ctx.session!.credentials
      const data: { [key: string]: string } = {
        uuid: details.uuid,
        login: email,
        password,
        remember: 'no'
      }
      const params = new URLSearchParams
      for (const key in data) params.append(key, data[key])
      const url = `${endpoint}?${params}`
      ctx.redirect(url)
    } else {
      const endpoint = `https://langue.link/api/auth/interaction/${details.uuid}/confirm`
      const data: { [key: string]: string } = {
        uuid: details.uuid
      }
      const params = new URLSearchParams
      for (const key in data) params.append(key, data[key])
      const url = `${endpoint}?${params}`
      ctx.redirect(url)
    }
  })

  router.get('/api/auth/interaction/:grant/login', async ctx => {
    //console.log(ctx.query)
    const { email, password } = ctx.session!.credentials
    delete ctx.session!.credentials
    // verify credentials
    const account = await Account.findBy(await Account.findIdFrom(email))
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
    await oidc.interactionFinished(ctx.req, ctx.res, result)
  })

  router.get('/api/auth/interaction/:grant/confirm', async ctx => {
    const result = { consent: {} }
    await oidc.interactionFinished(ctx.req, ctx.res, result)
  })

  if (!IS_PROD) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  Issuer.discover('https://langue.link/api/oidc').then((issuer: any) => {
    process.stdout.write('Discovered issuer.')
    const client = new issuer.Client({
      client_id: keys.OIDC_LANGUE_CLIENT_ID,
      client_secret: keys.OIDC_LANGUE_CLIENT_SECRET
    })

    router.post('/api/auth/oidc', bodyparser(), async ctx => {
      const credentials = Credentials.check(ctx.request.body)
      const sessionKey = 'langue.link'
      const params = {
        state: nanoid(),
        nonce: nanoid(),
        redirect_uri: 'https://langue.link/api/auth/callback',
        scope: 'openid email profile'
      }
      ctx.session![sessionKey] = params
      ctx.session!.credentials = credentials
      ctx.redirect(client.authorizationUrl(params))
      ctx.status = 303
    })

    router.get('/api/auth/callback', bodyparser(), async ctx => {
      const reqParams = client.callbackParams(ctx.req)
      const sessionKey = 'langue.link'
      const { state, nonce } = ctx.session![sessionKey]
      delete ctx.session![sessionKey]
      const checks = { state, nonce }
      const result: any = {}
      result.tokenset = await client.authorizationCallback(
        'https://langue.link/api/auth/callback', reqParams, checks)
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