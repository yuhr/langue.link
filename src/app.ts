import fs from 'fs'
import path from 'path'
import { URLSearchParams } from 'url'
import crypto from 'crypto'
import base64url from 'base64url'

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

import jwt from 'jsonwebtoken'

import authProvider from './auth/provider'
//import authClient from './auth/client'

import { Issuer } from 'openid-client'
import { Account, Credentials } from './db/account'
import mail from './mail'

import { ValidationError } from 'runtypes/lib/runtype'

const IS_PROD = 'production' === process.env.NODE_ENV
const keys = JSON.parse(fs.readFileSync('./.secret/.keys.json', 'utf8'))

const app = new Koa()
app.proxy = true
app.listen(8000)

app.keys = ['a', 'b', 'c']
app.use(session({ key: '_session' }, app))
app.use(
  cors({
    allowMethods: 'GET,HEAD,POST',
    origin: 'langue.link'
  })
)

const router = new Router()
app.use(router.routes())
app.use(router.allowedMethods())

// static
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      fontSrc: ["'self'", 'fonts.googleapis.com', 'fonts.gstatic.com'],
      connectSrc: ["'self'"].concat(IS_PROD ? [] : ['wss:'])
    }
  })
)

// api request logging
router.get('*', async (ctx, next) => {
  if (ctx.path.startsWith('/api')) console.log(`${ctx.method} ${ctx.path}`)
  await next()
})
router.post('*', async (ctx, next) => {
  if (ctx.path.startsWith('/api')) console.log(`${ctx.method} ${ctx.path}`)
  await next()
})

app.use(async (ctx, next) => {
  const resolve = (path: string) => `./dst/static${path}`
  const hasExtention = 1 < path.extname(ctx.path).length
  if (ctx.path.startsWith('/api'))
    try {
      await next()
    } catch (err) {
      console.log(err.message)
    }
  else if (hasExtention)
    try {
      await send(ctx, resolve(ctx.path))
    } catch (err) {
      console.log(err.message)
    }
  else if (ctx.path.startsWith('/docs'))
    try {
      if (!hasExtention && !ctx.path.endsWith('/')) {
        ctx.redirect(`${ctx.url}/`)
        ctx.status = 301
      } else {
        await send(ctx, resolve(ctx.path.endsWith('/') ? `${ctx.path}index.html` : ctx.path))
      }
    } catch (err) {
      console.log(err.message)
    }
  else await send(ctx, resolve('/index.html'))
})

const op = authProvider
op
  .initialize({
    clients: [
      {
        client_id: keys.OIDC_LANGUE_CLIENT_ID,
        client_secret: keys.OIDC_LANGUE_CLIENT_SECRET,
        redirect_uris: ['https://langue.link/api/auth/callback']
      }
    ]
  })
  .then((provider: any) => {
    const prefix = '/api/oidc'
    app.use(mount(prefix, op.app))

    router.get('/api/auth/interaction/:grant', async ctx => {
      // shows a login/confirm form
      const details = await op.interactionDetails(ctx.req)
      //const client = await op.Client.find(details.params.client_id)
      // TODO: response a login form html
      if (details.interaction.error === 'login_required') {
        // mimic login form fill
        const endpoint = `https://langue.link/api/auth/interaction/${details.uuid}/login`
        const { email, password } = ctx.session!.credentials
        delete ctx.session!.credentials
        const data: { [key: string]: string } = {
          uuid: details.uuid,
          email,
          password,
          remember: 'true'
        }
        const params = new URLSearchParams()
        for (const key in data) params.append(key, data[key])
        const url = `${endpoint}?${params}`
        ctx.redirect(url)
      } else {
        const endpoint = `https://langue.link/api/auth/interaction/${details.uuid}/confirm`
        const data: { [key: string]: string } = {
          uuid: details.uuid
        }
        const params = new URLSearchParams()
        for (const key in data) params.append(key, data[key])
        const url = `${endpoint}?${params}`
        ctx.redirect(url)
      }
      // `params` can be retrieved by `ctx.query` later
    })

    router.get('/api/auth/interaction/:grant/login', async ctx => {
      // this is not shown as a visual login form, but is just an API endpoint
      const { email, password } = ctx.query
      console.log(ctx.query)
      const credentials = { email, password } as Credentials
      // verify account credentials
      const account = await Account.findBy(credentials)
      const result = {
        login: {
          account: account.accountId,
          acr: 'urn:mace:incommon:iap:bronze',
          amr: ['pwd'],
          remember: ctx.query.remember === 'true',
          ts: Math.floor(Date.now() / 1000)
        },
        consent: {}
      }
      // return authorization code to RP
      await op.interactionFinished(ctx.req, ctx.res, result)
    })

    router.get('/api/auth/interaction/:grant/confirm', async ctx => {
      const result = { consent: {} }
      await op.interactionFinished(ctx.req, ctx.res, result)
    })

    if (!IS_PROD) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    Issuer.discover('https://langue.link/api/oidc')
      .then((issuer: any) => {
        process.stdout.write('Discovered issuer.')
        const rp = new issuer.Client({
          // Client Attributes / Client Metadata
          client_id: keys.OIDC_LANGUE_CLIENT_ID,
          client_secret: keys.OIDC_LANGUE_CLIENT_SECRET,
          grant_types: ['implicit', 'authorization_code', 'refresh_token'],
          default_max_age: 7 * 24 * 60 * 60,
          response_types: ['code id_token token'],
          id_token_signed_response_alg: 'RS256',
          userinfo_signed_response_alg: 'RS256',
          application_type: 'web',
          subject_type: 'public',
          token_endpoint_auth_method: 'client_secret_basic'
        })

        router.post('/api/auth', bodyparser(), async ctx => {
          try {
            const credentials = Credentials.check(ctx.request.body)
            /*mail.sendMail({ to: credentials.email }, (err: any, info: any) => {
        if (err) throw err
        console.dir(info)
      })*/
            const sessionKey = 'langue.link'
            const params = {
              // Authorization Request
              state: nanoid(),
              nonce: nanoid(),
              redirect_uri: 'https://langue.link/api/auth/callback',
              scope: 'openid email profile',
              max_age: 7 * 24 * 60 * 60
            }
            ctx.session![sessionKey] = params
            ctx.session!.credentials = credentials
            // redirect to the authorization endpoint
            ctx.redirect(rp.authorizationUrl(params))
            ctx.status = 303
          } catch (err) {
            ctx.body = {
              message: err.message,
              ...err
            }
            ctx.status = 400
          }
        })

        router.get('/api/auth/callback', bodyparser(), async ctx => {
          const reqParams = rp.callbackParams(ctx.req)
          const sessionKey = 'langue.link'
          console.log(ctx.session![sessionKey])
          const { state, nonce } = ctx.session![sessionKey]
          delete ctx.session![sessionKey]
          const checks = { state, nonce }
          const result: any = {}
          // send authorization code and retrieve access token and id token
          result.tokenset = await rp.authorizationCallback(
            'https://langue.link/api/auth/callback',
            reqParams,
            checks
          )
          //const x = base64url.decode(result.tokenset.id_token.split('.')[1])
          //console.log(JSON.stringify(JSON.parse(x), null, 2))
          //// request user resource
          //if (result.tokenset.access_token) {
          //  result.userinfo = await rp.userinfo(result.tokenset)
          //}
          // verify here
          ctx.body = { result: 'succeeded', ...result }
        })
      })
      .catch((error: any) => {
        console.log(error)
      })
  })
  .catch((error: any) => {
    console.log(error)
  })

console.log('Listening on port 8000')
process.send!('ready')
