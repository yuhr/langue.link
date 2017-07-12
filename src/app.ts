import path from 'path'
import fs, { access } from 'fs'
import crypto from 'crypto'
import fetch from 'node-fetch'
import { URLSearchParams } from 'url'

import * as Type from 'runtypes'

import https from 'https'
import Koa from 'koa'
import Router from 'koa-router'
import bodyparser from 'koa-bodyparser'
import cors from 'kcors'
import send from 'koa-send'
import mount from 'koa-mount'
import rewrite from 'koa-rewrite'
import session from 'koa-session'
import helmet from 'koa-helmet'
import proxy from 'koa-proxies'

import Provider from 'oidc-provider'
import { Issuer } from 'openid-client'

import jwt from 'jsonwebtoken'
const generateJWT = (userId: string) => {
  return jwt.sign({ dat: true }, 'secret', {
    expiresIn: '1 hour',
    audience: 'https://langue.link',
    issuer: 'https://langue.link',
    subject: userId,
    jwtid: nanoid()
  })
}

import passport from 'koa-passport'
import { Strategy as CustomStrategy } from 'passport-custom'

import Gun from 'gun'
import 'gun-mongo-key'
import 'gun/lib/load'
import 'gun/lib/not'
import 'gun/lib/then'

import nanoid from 'nanoid'
import isemail from 'isemail'
import bcrypt from 'bcrypt'
import { nonExecutableDefinitionMessage } from 'graphql/validation/rules/ExecutableDefinitions'
import { DESTRUCTION } from 'dns'
import { INSPECT_MAX_BYTES } from 'buffer'

const IS_PROD = 'production' === process.env.NODE_ENV
const URL_HOST = IS_PROD ? 'langue.link' : 'langue.link'
const keys = JSON.parse(fs.readFileSync(path.resolve('./.secret/.keys.json')).toString())

const db: { [key: string]: Gun } = {
  gun: new Gun({
    radisk: false,
    localStorage: false,
    uuid: nanoid,
    mongo: {
      host: 'mongo',
      port: '27017',
      database: 'gun',
      collection: 'gun_mongo_key',
      query: '',
      opt: {
        poolSize: 25
      },
      chunkSize: 250
    }
  })
}
db.users = db.gun.get('users')

const User = Type.Record({
  uid: Type.String.withConstraint(
    x => /^[A-Za-z0-9_~]{21}$/.test(x) || `Invalid id format: '${x}'`),
  name: Type.String, // url will be `https://langue.link/user/${name}`
  email: Type.String.withConstraint(
    x => isemail.validate(x) || `Invalid email format: '${x}'`),
  passwordHash: Type.String.withConstraint(
    x => /^hash:.+$/.test(x) || `Invalid passwordHash format: '${x}'`),
  isTemporary: Type.Boolean,
  dateRegistered: Type.Number
})
type User = Type.Static<typeof User>

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
  const resolve = (filename: string) => `./dst/public/${filename}`
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

const findUser = async (email: string, password: string) => {
  if (!Type.String.withConstraint(
    x => /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/.test(x)
    || `Invalid password format: ${x}`
  ).guard(password)) throw new Error('Type inconformity')
  const node: any = await db.users.get(email).not(() => {
    process.stdout.write(`User not found or corrupt. Creating: ${email}`)
    const tmp = nanoid()
    const newUser: User = {
      uid: tmp,
      name: tmp,
      email,
      passwordHash: `hash:${password}`,
      isTemporary: true,
      dateRegistered: Date.now()
    }
    db.users.get(email).put(User.check(newUser))
  }).load(user => {
    process.stdout.write(`User found: ${email}`)
    return user
  }).then()
  const account = { ...node }
  delete account['_']
  return account
}

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
  }
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
    } else {
      const endpoint = `https://langue.link/api/auth/interaction/${details.uuid}/confirm`
      const data: { [key: string]: string } = {
        uuid: details.uuid
      }
      const params = new URLSearchParams
      for (const key in data) params.append(key, data[key])
      const url = `${endpoint}?${params.toString()}`
      ctx.redirect(url)
    }
    await next()
  })

  router.get('/api/auth/interaction/:grant/login', bodyparser(), async (ctx, next) => {
    console.log('/api/auth/interaction/:grant/login')
    const { email, password } = ctx.session!.cred
    const account = await findUser(email, password)
    const result = {
      login: {
        account: account.email,
        acr: 'urn:mace:incommon:iap:bronze',
        amr: ['pwd'],
        remember: false,
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
    ctx.session!.uid = account.uid
    ctx.redirect(interaction.returnTo)
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
    await next()
  })

  oidc.app.listen(7999)
  oidc.app.proxy = true

  app.use(proxy('/api/oidc/*', {
    target: 'http://localhost:7999',
    changeOrigin: true
  }))

  //process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  Issuer.useRequest()
  Issuer.discover('http://localhost:7999').then((issuer: any) => {
    process.stdout.write('Discovered issuer.')
    const client = new issuer.Client({
      client_id: 'https://langue.link',
      client_secret: 'secret'
    })
    passport.use('oidc', new CustomStrategy(async (req: any, done: any) => {
      console.log('OidcStrategy')
      const reqParams = client.callbackParams(req)
      const sessionKey = 'langue.link'
      if (reqParams.type && reqParams.type === 'cred') {
        console.log('authorizationUrl')
        const params = {
          state: nanoid(),
          nonce: nanoid()
        }
        req.session[sessionKey] = params
        const url = client.authorizationUrl(params).replace(/^http:\/\/localhost:7999/, 'https://langue.link')
        return done(null, { url })
      } else {
        console.log('authorizationCallback')
        const session = req.session[sessionKey]
        const state = session.state
        const nonce = session.nonce
        try {
          delete req.session[sessionKey]
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
        return done(null, result)
      }
    }))
  }).catch((error: any) => {
    console.log(error)
  })

}). catch (process.stderr.write)

router.post('/api/auth/oidc', bodyparser(), async (ctx, next) => {
  console.log('/api/auth/oidc')
  return passport.authenticate('oidc', async (error, result) => {
    ctx.session!.cred = ctx.request.body
    ctx.redirect(result.url)
    await next()
  })(ctx, next)
})

router.get('/api/auth/callback', bodyparser(), async (ctx, next) => {
  console.log('/api/auth/callback')
  return passport.authenticate('oidc', (error, { tokenset, userinfo }) => {
    console.log('auth completed')
    ctx.body = { tokenset, userinfo }
  })(ctx, next)
})
/*
passport.use('jwt', new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: 'secret',
  issuer: 'https://langue.link',
  audience: 'https://langue.link'
}, (payload, done) => {
  // check payload.sub on user database
  return done(null, { user: 'jwt' }, payload)
}))
*/
/*
app.get('/api', passport.authenticate('jwt', {
  session: false
}), (req, res) => {
  res.send(`Secure response from ${JSON.stringify(req.user)}`)
})
*/

console.log('Listening on port 8000')
fs.writeFileSync('./trig/online', new Date, 'utf8')
process.send!('ready')