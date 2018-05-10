import { default as Gun, Document } from 'gun'
import 'gun-mongo-key'
import 'gun/lib/load'
import 'gun/lib/not'
import { graphql, buildSchema } from 'graphql'

import { Context } from 'koa'

import * as Type from 'runtypes'
import nanoid from 'nanoid'
import isemail from 'isemail'
import bcrypt from 'bcryptjs'

import schemafile from './account.gql'
const schema = buildSchema(schemafile)

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
db.accounts = db.gun.get('accounts')
db.emails = db.gun.get('emails')

const AccountId = Type.String.withConstraint(
  x => /^[A-Za-z0-9_~]{21}$/.test(x)
    || `Invalid id format: '${x}'`)
type AccountId = Type.Static<typeof AccountId>

const PasswordRaw = Type.String.withConstraint(
  x => /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/.test(x)
    || `Invalid password format: ${x}`)
type PasswordRaw = Type.Static<typeof PasswordRaw>

const Email = Type.String.withConstraint(
  x => isemail.validate(x)
    || `Invalid email format: '${x}'`)
type Email = Type.Static<typeof Email>

const UserInfoRequired = {
  accountId: AccountId,
  username: Type.String, // url will be `https://langue.link/user/${name}`
  email: Email,
  email_verified: Type.Boolean,
  updated_at: Type.Number,
  registered_at: Type.Number
}
const UserInfoOptional = {
  passwordHash: Type.String.withConstraint(
    x => /^\$2[aby]?\$[\d]+\$[./A-Za-z0-9]{53}$/.test(x)
      || `Invalid passwordHash format: '${x}'`)
}
const UserInfo = Type.Record(UserInfoRequired).And(Type.Partial(UserInfoOptional))
const UserInfoPartial = Type.Partial(UserInfoRequired).And(Type.Partial(UserInfoOptional))
type UserInfo = Type.Static<typeof UserInfo>
type UserInfoPartial = Type.Static<typeof UserInfoPartial>
export type Document = UserInfo
export type DocumentPartial = UserInfo

export class Account {
  readonly accountId: string
  private readonly userInfo: UserInfo
  private constructor(accountId?: string, userInfo?: UserInfo) {
    this.accountId = accountId || nanoid()
    this.userInfo = userInfo || {
      accountId: this.accountId,
      username: this.accountId,
      email: 'mail@yuhr.org',
      email_verified: false,
      updated_at: Date.now(),
      registered_at: Date.now()
    }
  }
  toString() {
    return `Account (id: '${this.accountId}')`
  }
  private async update(userInfo: Partial<UserInfo>) {
    UserInfoPartial.check(userInfo)
    userInfo.updated_at = Date.now()
    return await new Promise<UserInfo>(resolve => {
      db.accounts.get(this.accountId).put(userInfo as Document, () => {
        resolve(userInfo as UserInfo)
      })
    })
  }
  async setPassword(password: string) {
    PasswordRaw.check(password)
    this.update({
      passwordHash: await Account.generatePasswordHash(password)
    })
  }
  private async matchPassword(password: string) {
    return await bcrypt.compare(password, this.userInfo.passwordHash!)
  }
  private static async generatePasswordHash(password: string) {
    return await bcrypt.hash(password, 13)
  }
  static async from(document: Document) {
    const userInfo = UserInfo.check(document)
    const account = new Account(userInfo.accountId, userInfo)
    await account.update(userInfo)
    return account
  }
  static async identify(email: string) {
    UserInfoRequired.email.check(email)
    const node = db.emails.get(email)
    return await new Promise<string>(resolve => {
      node.not(() => {
        node.put(nanoid())
      }).load(accountId => {
        resolve(accountId as string)
      })
    })
  }
  static async login(email: string, password?: string) {
    const accountId = await Account.identify(email)
    const account = await Account.find(accountId)
    if (await account.matchPassword(PasswordRaw.check(password))) {
      console.log('login success')
    } else {
      console.log('login failed')
    }
    return account
  }
  static async find(accountId?: string) {
    if (accountId === undefined) accountId = nanoid()
    UserInfoRequired.accountId.check(accountId)
    const node = db.accounts.get(accountId!)
    const document = await new Promise<Document>(resolve => {
      node.not(() => {
        process.stdout.write('User not found or corrupt. Creating.')
        node.put(new Account(accountId).userInfo)
      }).load(userInfo => {
        process.stdout.write(`User found: ${accountId}`)
        resolve(userInfo)
      })
    })
    return await Account.from(document)
  }
  // CALLBACK BY OIDC PROVIDER
  static async findById(ctx: Context, accountId: string, token?: { [key: string]: any}) {
    const account = await Account.find(accountId)
    //console.log(`token: ${JSON.stringify(token, null, 2)}`)
    return {
      accountId,
      claims: (use: 'id_token' | 'userinfo', scope: string) => {
        return {
          sub: account.accountId,
          ... account.userInfo
        }
      }
    }
  }
}