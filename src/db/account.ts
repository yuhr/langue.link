import { Context } from 'koa'

import * as Type from 'runtypes'
import { ValidationError } from 'runtypes/lib/runtype'
import nanoid from 'nanoid'
import isemail from 'isemail'
import bcrypt from 'bcryptjs'

import { DistributedDatabase } from './backend'
import { Verify } from './brand'

const db = {
  accounts: new DistributedDatabase('accounts'),
  emails: new DistributedDatabase('emails')
}

/**
 * Validated string type with regex `/^[A-Za-z0-9_~]{21}$/`.
 */
export const AccountId = Type.String.withConstraint(
  x => /^[A-Za-z0-9_~]{21}$/.test(x) || `Invalid id format: '${x}'`)
  .withBrand('AccountId')
export type AccountId = Type.Static<typeof AccountId>

/**
 * Validated string type with regex `/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/`.
 */
export const PasswordRaw = Type.String.withConstraint(
  x => /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/.test(x) || `Invalid password format: ${x}`)
  .withBrand('PasswordRaw')
export type PasswordRaw = Type.Static<typeof PasswordRaw>

/**
 * Validated string type with regex `/^\$2[aby]?\$[\d]+\$[./A-Za-z0-9]{53}$/`.
 */
export const PasswordHash = Type.String.withConstraint(
  x => /^\$2[aby]?\$[\d]+\$[./A-Za-z0-9]{53}$/.test(x) || `Invalid passwordHash format: '${x}'`)
  .withBrand('PasswordHash')
export type PasswordHash = Type.Static<typeof PasswordHash>

/**
 * Validated string type with `isemail.validate`.
 */
export const Email = Type.String.withConstraint(
  x => isemail.validate(x) || `Invalid email format: '${x}'`)
  .withBrand('Email')
export type Email = Type.Static<typeof Email>

/**
 * Validates UUID v4.
 */
export const Uuid = Type.String.withConstraint(
  x => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x)
  || `Invalid UUID format: '${x}'`)
  .withBrand('Uuid')
export type Uuid = Type.Static<typeof Uuid>

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

export const UserInfo = Type.Record(UserInfoRequired).And(Type.Partial(UserInfoOptional))
  .withBrand('UserInfo')
export type UserInfo = Type.Static<typeof UserInfo>

export const UserInfoPartial = Type.Partial(UserInfoRequired).And(Type.Partial(UserInfoOptional))
  .withBrand('UserInfoPartial')
export type UserInfoPartial = Type.Static<typeof UserInfoPartial>

export const Credentials = Type.Record({
  email: Email,
  password: PasswordRaw
}).withBrand('Credentials')
export type Credentials = Type.Static<typeof Credentials>

/**
 * Authentication module. On-memory representation of account information stored in the backend database. Contains attributes/properties of an user.
 */
export class Account {
  readonly accountId: AccountId
  private readonly userInfo: UserInfo
  private constructor(accountId: AccountId)
  private constructor(userInfo: UserInfo)
  private constructor(accountInfo: AccountId | UserInfo) {
    if (AccountId.guard(accountInfo)) {
      this.accountId = accountInfo
      this.userInfo = {
        accountId: this.accountId,
        username: 'user',
        email: 'mail@yuhr.org' as Email,
        email_verified: false,
        updated_at: Date.now(),
        registered_at: Date.now()
      } as UserInfo
    } else {
      this.userInfo = accountInfo
      this.accountId = this.userInfo.accountId
    }
  }
  private async update(userInfo?: Partial<UserInfo>) {
    if (userInfo) Object.assign(this.userInfo, userInfo)
    this.userInfo.updated_at = Date.now()
    await db.accounts.set(this.accountId, this.userInfo)
  }
  private async match(password: PasswordRaw) {
    return await bcrypt.compare(password, this.userInfo.passwordHash!) // TODO
  }
  private static async generateHashOf(password: PasswordRaw) {
    return await PasswordHash.check(await bcrypt.hash(password, 13))
  }
  private static generateId() {
    return AccountId.check(nanoid())
  }
  static async findIdFrom(email: Email) {
    const document = await db.emails.get(email)
    if (document === undefined) {
      const accountId = Account.generateId()
      await db.emails.set(email, accountId)
      return accountId
    } else {
      const accountId = AccountId.check(document)
      return accountId
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
      [AccountId, async accountId => accountId],
      [Type.Always, x => { throw new ValidationError('Expected AccountId or Email.') }]
    )(accountInfo) as AccountId
    const document = await db.accounts.get(accountId)
    return document === undefined ?
      document : await Account.findBy(UserInfo.check(document))
  }
  static findBy(email: Email): Promise<Account>
  static findBy(accountId: AccountId): Promise<Account>
  static findBy(userInfo: UserInfo): Promise<Account>
  static findBy(credentials: Credentials): Promise<Account>
  static async findBy(accountInfo: Email | AccountId | Credentials | UserInfo) {
    return await Type.match(
      [Email, async email => {
        return await Account.findBy(await Account.findIdFrom(email))
      }],
      [AccountId, async accountId => {
        const document = await db.accounts.get(accountId)
        if (document === undefined) {
          process.stdout.write(`Account not found. Creating: ${accountId}`)
          const account = new Account(accountId)
          await account.update()
          return account
        } else {
          process.stdout.write(`Account found: ${accountId}`)
          return await Account.findBy(UserInfo.check(document))
        }
      }],
      [Credentials, async credentials => {
        const userInfo = {
          accountId: this.generateId(),
          username: 'credentials.email',
          email: credentials.email,
          email_verified: false,
          updated_at: Date.now(),
          registered_at: Date.now(),
          passwordHash: await Account.generateHashOf(credentials.password)
        } as UserInfo
        return await Account.findBy(userInfo)
      }],
      [UserInfo, async userInfo => {
        const account = new Account(userInfo)
        await account.update()
        return account
      }],
      [Type.Always, x => {
        throw new ValidationError('Expected Email, AccountId, Credentials or UserInfo.')
      }]
    )(accountInfo)
  }
  /**
   * Callback used by `oidc-provider`.
   */
  static async findById(ctx: Context, accountId: AccountId, token?: { [key: string]: any }) {
    console.log(token)
    const account = await Account.searchBy(accountId)
    console.log(`${account}`)
    if (account) return {
      accountId,
      claims: (use: 'id_token' | 'userinfo', scope: string) => {
        return { sub: accountId, ... account.userInfo }
      }
    }
    else return false
  }
  // MISC
  toString() { return `${this.constructor.name}<${this.userInfo.email}>` }
}