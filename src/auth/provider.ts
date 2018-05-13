import Provider from 'oidc-provider'
import { Account } from '../db/account'
import Adapter from '../db/adapter'

export default new Provider('https://langue.link', {
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
  findById: Account.findById,
  adapter: Adapter
})