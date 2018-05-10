import { default as Gun, Document, Ack } from 'gun'
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
import { ValidationError } from 'runtypes/lib/runtype'
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

const PasswordHash = Type.String.withConstraint(
  x => /^\$2[aby]?\$[\d]+\$[./A-Za-z0-9]{53}$/.test(x)
    || `Invalid passwordHash format: '${x}'`)
type PasswordHash = Type.Static<typeof PasswordHash>

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
  passwordHash: PasswordHash
}
const UserInfo = Type.Record(UserInfoRequired).And(Type.Partial(UserInfoOptional))
const UserInfoPartial = Type.Partial(UserInfoRequired).And(Type.Partial(UserInfoOptional))
type UserInfo = Type.Static<typeof UserInfo>
type UserInfoPartial = Type.Static<typeof UserInfoPartial>
export type Document = UserInfo
export type DocumentPartial = UserInfo

export const Credentials = Type.Record({
  type: Type.Literal('credentials'),
  email: Email,
  password: PasswordRaw
})
export type Credentials = Type.Static<typeof Credentials>

export class Account {
  readonly accountId: string
  private readonly userInfo: UserInfo
  private constructor(accountInfo: AccountId | UserInfo) {
    if (AccountId.guard(accountInfo)) {
      this.accountId = accountInfo
      this.userInfo = {
        accountId: this.accountId,
        username: this.accountId,
        email: 'mail@yuhr.org',
        email_verified: false,
        updated_at: Date.now(),
        registered_at: Date.now()
      }
    } else {
      this.userInfo = accountInfo
      this.accountId = this.userInfo.accountId
    }
  }
  private async update(userInfo?: Partial<UserInfo>) {
    if (userInfo) Object.assign(this.userInfo, userInfo)
    this.userInfo.updated_at = Date.now()
    const resolve = await new Promise<Ack>(resolve => {
      db.accounts.get(this.accountId).put(this.userInfo, resolve)
    })
    if (resolve.err) throw Error(resolve.err.toString())
  }
  private async match(password: PasswordRaw) {
    return await bcrypt.compare(password, this.userInfo.passwordHash!) // TODO
  }
  private static async generateHashOf(password: PasswordRaw) {
    return await PasswordHash.check(bcrypt.hash(password, 13))
  }
  private static generateId() {
    return AccountId.check(nanoid())
  }
  static async findIdFrom(email: Email) {
    Email.check(email)
    const node = db.emails.get(email)
    const document = await new Promise<Document | undefined>(resolve => {
      node.once(resolve)
    })
    if (document === undefined) {
      process.stdout.write(`AccountId not found. Creating for: ${email}`)
      const accountId = Account.generateId()
      await new Promise(resolve => {
        node.put(accountId, resolve)
      })
      return accountId
    } else {
      process.stdout.write(`AccountId found: ${email}`)
      return AccountId.check(document)
    }
  }
  async register(credentials: Credentials) {
    Credentials.check(credentials)
    if (this.userInfo.email !== credentials.email)
      throw new ValidationError('Email adresses don\'t match.')
    await this.update({
      passwordHash: await Account.generateHashOf(credentials.password)
    })
  }
  async verify(credentials: Credentials) {
    Credentials.check(credentials)
    if (this.userInfo.email !== credentials.email)
      throw new ValidationError('Email adresses don\'t match.')
    return await this.match(credentials.password)
  }
  static async searchBy(accountInfo: AccountId | Email) {
    const accountId = await Type.match(
      [Email, async email => await Account.findIdFrom(email)],
      [AccountId, async accountId => accountId]
    )(accountInfo)
    const document = await new Promise<Document | undefined>(resolve => {
      db.accounts.get(accountId).once(resolve)
    })
    return document === undefined ?
      document : await Account.findFrom(UserInfo.check(document))
  }
  static async findFrom(accountInfo: AccountId | UserInfo): Promise<Account> {
    return await Type.match(
      [UserInfo, async userInfo => {
        const account = new Account(userInfo)
        await account.update()
        return account
      }],
      [AccountId, async accountId => {
        const node = db.accounts.get(accountId)
        const document = await new Promise<Document | undefined>(resolve => {
          node.once(resolve)
        })
        if (document === undefined) {
          process.stdout.write('User not found. Creating.')
          const account = new Account(accountId)
          await account.update()
          return account
        } else {
          process.stdout.write(`User found: ${AccountId}`)
          return await Account.findFrom(UserInfo.check(document))
        }
      }]
    )(accountInfo)
  }
  // CALLBACK BY OIDC PROVIDER
  static async findById(ctx: Context, accountId: AccountId, token?: { [key: string]: any}) {
    console.dir(token)
    const userInfo = await Account.searchBy(accountId)
    if (userInfo === undefined) return false
    else return {
      accountId,
      claims: (use: 'id_token' | 'userinfo', scope: string) => {
        return {
          sub: accountId,
          ... userInfo
        }
      }
    }
  }
  // MISC
  toString() { return `Account<${this.accountId}>` }
}