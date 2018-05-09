import fs from 'fs'

import { default as Gun, Data } from 'gun'
import 'gun-mongo-key'
import 'gun/lib/load'
import 'gun/lib/not'
import { graphql, buildSchema } from 'graphql'

import * as Type from 'runtypes'
import nanoid from 'nanoid'
import isemail from 'isemail'
import bcrypt from 'bcryptjs'

import schemafile from './users.gql'
const schema = buildSchema(schemafile)

class UserClass {
  readonly uid: string
  name: string
  email: string
  passwordHash: string
  isTemporary: boolean = true
  readonly dateRegistered: number
  constructor(email: string, password: string) {
    const tmp = nanoid()
    this.uid = tmp
    this.name = tmp
    this.email = email
    this.passwordHash = bcrypt.hashSync(password, 13)
    this.dateRegistered = Date.now()
  }
}

export const User = Type.Record({
  uid: Type.String.withConstraint(
    x => /^[A-Za-z0-9_~]{21}$/.test(x) || `Invalid id format: '${x}'`),
  name: Type.String, // url will be `https://langue.link/user/${name}`
  email: Type.String.withConstraint(
    x => isemail.validate(x) || `Invalid email format: '${x}'`),
  passwordHash: Type.String.withConstraint(
    x => /^\$2[aby]?\$[\d]+\$[./A-Za-z0-9]{53}$/.test(x) || `Invalid passwordHash format: '${x}'`),
  isTemporary: Type.Boolean,
  dateRegistered: Type.Number
})
export type User = Type.Static<typeof User>

export const db: { [key: string]: Gun } = {
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

export const generatePasswordHash = async (password: string) =>
  await bcrypt.hash(password, 13)
export const guardPassword = async (password: string, hash: string) =>
  await bcrypt.compare(password, hash)

export const findUser = async (email: string, password: string) => {
  if (!Type.String.withConstraint(
    x => /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/.test(x)
    || `Invalid password format: ${x}`
  ).guard(password)) throw new Error('Type inconformity')
  const root = {
    user: async ({ email, password }: any) => {
      return await new UserClass(email, password)
    }
  }
  /*const result = await graphql(schema, `{
    user(email: "email", password: "password")
  }`, root)
  console.log(result)*/
  const user = await new Promise<Data>(resolve => {
    db.users.get(email).not(async () => {
      process.stdout.write(`User not found or corrupt. Creating: ${email}`)
      const tmp = nanoid()
      const newUser = new UserClass(email, password)
      db.users.get(email).put(User.check(newUser))
    }).load(user => {
      process.stdout.write(`User found: ${email}`)
      resolve(user)
    })
  }) as User
  return user
}