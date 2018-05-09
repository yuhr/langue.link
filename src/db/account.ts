import { default as Gun, Document } from 'gun'
import 'gun-mongo-key'
import 'gun/lib/load'
import 'gun/lib/not'
import { graphql, buildSchema } from 'graphql'

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

const Username = Type.String
type Username = Type.Static<typeof Username>

const Email = Type.String.withConstraint(
  x => isemail.validate(x)
    || `Invalid email format: '${x}'`)
type Email = Type.Static<typeof Email>

const UserInfoRequired = {
  accountId: AccountId,
  username: Username, // url will be `https://langue.link/user/${name}`
  email: Email,
  isVerified: Type.Boolean,
  dateRegistered: Type.Number
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
      isVerified: false,
      dateRegistered: Date.now()
    }
  }
  toString() {
    return `Account (id: '${this.accountId}')`
  }
  private async update(userInfo: Partial<UserInfo>) {
    UserInfoPartial.check(userInfo)
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
    if (UserInfo.guard(document)) {
      const account = new Account(document.accountId, document)
      await account.update(document)
      return account
    } else throw UserInfo.check(document)
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
  static async findById(ctx: any, accountId: string, token: any) {
    const account = await Account.find(accountId)
    return {
      accountId,
      async claims(use: 'id_token' | 'userinfo', scope: string) {
        // @param use - can either be "id_token" or "userinfo", depending on
        //   where the specific claims are intended to be put in.
        // @param scope - the intended scope, while oidc-provider will mask
        //   claims depending on the scope automatically you might want to skip
        //   loading some claims from external resources etc. based on this detail
        //   or not return them in id tokens but only userinfo and so on.
        console.log(scope)
        const { accountId, username, email } = account.userInfo
        return {
          sub: account.accountId,
          accountId,
          username,
          email
        }
      }
    }
  }
}