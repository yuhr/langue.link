import { Context } from 'koa'

import { String, Static, Record, Boolean, Number, Partial, Always, match } from 'runtypes'
import { ValidationError } from 'runtypes/lib/runtype'
import nanoid from 'nanoid'
import isemail from 'isemail'
import bcrypt from 'bcryptjs'

import { DistributedDatabase } from './backend'
import { Verify } from './brand'
import trying from 'try-expression'

const db = {
  accounts: new DistributedDatabase('accounts'),
  emails: new DistributedDatabase('emails')
}

/**
 * Validated string type with regex `/^[A-Za-z0-9_~]{21}$/`.
 */
export const AccountId = String.withConstraint(
  x => /^[A-Za-z0-9_~]{21}$/.test(x) || `Invalid id format: '${x}'`)
  .withBrand('AccountId')
export type AccountId = Static<typeof AccountId>

/**
 * Validated string type with regex `/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/`.
 */
export const PasswordRaw = String.withConstraint(
  x => /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/.test(x) || `Invalid password format: ${x}`)
  .withBrand('PasswordRaw')
export type PasswordRaw = Static<typeof PasswordRaw>

/**
 * Validated string type with regex `/^\$2[aby]?\$[\d]+\$[./A-Za-z0-9]{53}$/`.
 */
export const PasswordHash = String.withConstraint(
  x => /^\$2[aby]?\$[\d]+\$[./A-Za-z0-9]{53}$/.test(x) || `Invalid passwordHash format: '${x}'`)
  .withBrand('PasswordHash')
export type PasswordHash = Static<typeof PasswordHash>

/**
 * Validated string type with `isemail.validate`.
 */
export const Email = String.withConstraint(
  x => isemail.validate(x) || `Invalid email format: '${x}'`)
  .withBrand('Email')
export type Email = Static<typeof Email>

/**
 * Validated string type with `isemail.validate`.
 */
export const Username = String.withConstraint(
  x => /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,30}[a-zA-Z0-9]$/.test(x)
  || `Invalid username format: '${x}'`)
  .withBrand('Username')
export type Username = Static<typeof Username>

/**
 * Validates UUID v4.
 */
export const Uuid = String.withConstraint(
  x => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x)
  || `Invalid UUID format: '${x}'`)
  .withBrand('Uuid')
export type Uuid = Static<typeof Uuid>

const UserInfoRequired = {
  accountId: AccountId,
  username: Username, // url will be `https://langue.link/@${username}`
  email: Email,
  email_verified: Boolean,
  updated_at: Number,
  registered_at: Number,
  passwordHash: PasswordHash
}
const UserInfoOptional = {
}

/**
 * Validates that an object conforms to `UserInfo`.
 */
export const UserInfo = Record(UserInfoRequired).And(Partial(UserInfoOptional))
  .withBrand('UserInfo')
export type UserInfo = Static<typeof UserInfo>

/**
 * Validates that an object conforms to `UserInfo`, but partial.
 */
export const UserInfoPartial = Partial(UserInfoRequired).And(Partial(UserInfoOptional))
  .withBrand('UserInfoPartial')
export type UserInfoPartial = Static<typeof UserInfoPartial>

/**
 * Validates that an object conforms to `Credentials`.
 */
export const Credentials = Record({
  username: Username,
  email: Email,
  password: PasswordRaw
}).withBrand('Credentials')
export type Credentials = Static<typeof Credentials>

/**
 * Authentication module. On-memory representation of account information stored in the backend database. Contains attributes/properties of an user.
 */
export class Account {
  readonly accountId: AccountId
  private readonly userInfo: UserInfo
  private constructor(userInfo: UserInfo) {
    this.userInfo = userInfo
    this.accountId = this.userInfo.accountId
  }
  private async update(userInfo?: UserInfoPartial) {
    if (userInfo) Object.assign(this.userInfo, userInfo)
    this.userInfo.updated_at = Date.now()
    await db.accounts.set(this.accountId, this.userInfo)
  }
  private async match(password: PasswordRaw) {
    return await bcrypt.compare(password, this.userInfo.passwordHash) // TODO
  }
  private static async generateHashOf(password: PasswordRaw) {
    return await PasswordHash.check(await bcrypt.hash(password, 13))
  }
  private static generateId() {
    return AccountId.check(nanoid())
  }
  static async searchIdBy(email: Email) {
    const document = await db.emails.get(email)
    if (document === undefined) return undefined
    return AccountId.check(document)
  }
  static async findIdBy(email: Email) {
    const accountId = await Account.searchIdBy(email)
    if (accountId === undefined) {
      const accountId = Account.generateId()
      await db.emails.set(email, accountId)
      return accountId
    } else return accountId
  }
  async verify(credentials: Credentials) {
    if (credentials.username !== this.userInfo.username)
      throw new ValidationError('Usernames don\'t match.')
    if (credentials.email !== this.userInfo.email)
      throw new ValidationError('Email adresses don\'t match.')
    return await this.match(credentials.password)
  }
  static async searchBy(accountId: AccountId) {
    const document = await db.accounts.get(accountId)
    if (document === undefined) return undefined
    return new Account(UserInfo.check(document))
  }
  static async findBy(credentials: Credentials) {
    const accountId = await Account.findIdBy(credentials.email)
    const account = await Account.searchBy(accountId)
    if (account === undefined) {
      console.log(`Account not found. Creating: ${accountId}`)
      const userInfo = {
        accountId,
        username: credentials.username,
        email: credentials.email,
        email_verified: false,
        updated_at: Date.now(),
        registered_at: Date.now(),
        passwordHash: await Account.generateHashOf(credentials.password)
      }
      const account = new Account(UserInfo.check(userInfo))
      await account.update()
      return account
    } else {
      console.log(`Account found: ${accountId}`)
      return account
    }
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
        console.log(use)
        return { sub: accountId, ... account.userInfo }
      }
    }
    else return undefined
  }
  // MISC
  toString() { return `${this.constructor.name}<${this.userInfo.email}>` }
}
