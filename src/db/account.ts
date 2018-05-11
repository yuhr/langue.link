import { Context } from 'koa'

import * as Type from 'runtypes'
import { ValidationError } from 'runtypes/lib/runtype'
import nanoid from 'nanoid'
import isemail from 'isemail'
import bcrypt from 'bcryptjs'

import { Database } from '.'

const db = {
  accounts: new Database('accounts'),
  emails: new Database('emails')
}

export const AccountId = Type.String.withConstraint(
  x => /^[A-Za-z0-9_~]{21}$/.test(x)
    || `Invalid id format: '${x}'`)
export type AccountId = Type.Static<typeof AccountId>

export const PasswordRaw = Type.String.withConstraint(
  x => /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/.test(x)
    || `Invalid password format: ${x}`)
export type PasswordRaw = Type.Static<typeof PasswordRaw>

export const PasswordHash = Type.String.withConstraint(
  x => /^\$2[aby]?\$[\d]+\$[./A-Za-z0-9]{53}$/.test(x)
    || `Invalid passwordHash format: '${x}'`)
export type PasswordHash = Type.Static<typeof PasswordHash>

export const Email = Type.String.withConstraint(
  x => isemail.validate(x)
    || `Invalid email format: '${x}'`)
export type Email = Type.Static<typeof Email>

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
export const UserInfoPartial = Type.Partial(UserInfoRequired).And(Type.Partial(UserInfoOptional))
export type UserInfo = Type.Static<typeof UserInfo>
export type UserInfoPartial = Type.Static<typeof UserInfoPartial>

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
    await db.accounts.set(this.accountId, this.userInfo)
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
    const document = await db.emails.get(email)
    if (document === undefined) {
      const accountId = Account.generateId()
      process.stdout.write(`AccountId not found. Creating: ${email}: ${accountId}`)
      await db.emails.set(email, accountId)
      return accountId
    } else {
      const accountId = AccountId.check(document)
      process.stdout.write(`AccountId found: ${email}: ${accountId}`)
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
    )(accountInfo)
    const document = await db.accounts.get(accountId)
    return document === undefined ?
      document : await Account.findBy(UserInfo.check(document))
  }
  static async findBy(accountInfo: AccountId | UserInfo): Promise<Account> {
    return await Type.match(
      [UserInfo, async userInfo => {
        const account = new Account(userInfo)
        await account.update()
        return account
      }],
      [AccountId, async accountId => {
        const node = db.accounts.get(accountId)
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
      [Type.Always, x => { throw new ValidationError('Expected AccountId or UserInfo.') }]
    )(accountInfo)
  }
  // CALLBACK BY OIDC PROVIDER
  static async findById(ctx: Context, accountId: AccountId, token?: { [key: string]: any }) {
    console.dir(token)
    const account = await Account.searchBy(accountId)
    console.dir(account)
    if (account === undefined) {
      return false
    } else return {
      accountId,
      claims: (use: 'id_token' | 'userinfo', scope: string) => {
        return {
          sub: accountId,
          ... account.userInfo
        }
      }
    }
  }
  // MISC
  toString() { return `Account<${this.accountId}>` }
}