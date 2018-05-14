import { Record, Partial, String, Static } from 'runtypes'
import { DistributedDatabase } from './backend'
import nanoid from 'nanoid'
import { MongoClient, Db } from 'mongodb'

const db = {
  grants: new DistributedDatabase('grants'),
  payloads: new DistributedDatabase('payloads')
}

const GrantId = String.withBrand('GrantId')
type GrantId = Static<typeof GrantId>

const GrantKey = String.withBrand('GrantKey')
type GrantKey = Static<typeof GrantKey>

const Payload = Record({
  header: String,
  payload: String,
  signature: String
}).And(Partial({
  grantId: GrantId
})).withBrand('Payload')
type Payload = Static<typeof Payload>

type Grant = {
  [key: string]: string
}

const Id = String.withBrand('Id')
type Id = Static<typeof Id>

const Key = String.withBrand('Key')
type Key = Static<typeof Key>

let DB: Db

export class Adapter {
  name: string
  static names: string[] = []
  constructor(name: string) {
    this.name = name
    const i = Adapter.names.findIndex(name => name === this.name)
    if (i !== -1) {
      DB.collection(name).createIndexes([
        { key: { grantId: 1 } },
        { key: { expiresAt: 1 }, expireAfterSeconds: 0 }
      ])
      Adapter.names.push(name)
    }
  }
  coll(name?: string) {
    return Adapter.coll(name || this.name)
  }
  static coll(name: string) {
    return DB.collection(name)
  }
  async destroy(id: Id) {
    const found = await this.coll().findOneAndDelete({ _id: id })
    if (found.value && found.value.grantId) {
      const promises: any[] = []
      Adapter.names.forEach(name => {
        promises.push(this.coll(name).deleteMany({ grantId: found.value.grantId }))
      })
      return await Promise.all(promises)
    }
    return undefined
  }
  key(id: Id) {
    console.log('ok: key!')
    return `${this.name}:${id}` as Key
  }
  async consume(id: Id) {
    return await this.coll().findOneAndUpdate({ _id: id }, { $currentDate: { consumed: true } })
  }
  async find(id: Id) {
    return await this.coll().find({ _id: id }).limit(1).next()
  }
  async upsert(id: Id, payload: Payload, expiresIn: number) {
    let expiresAt
    if (expiresIn) {
      expiresAt = new Date(Date.now() + (expiresIn * 1000))
    }
    if (this.name === 'client') {
      expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000))
    }
    const document = { ...payload, ...(expiresAt && { expiresAt }) }
    return await this.coll().updateOne({ _id: id }, { $set: document }, { upsert: true })
  }
  static async connect(provider: any) {
    console.log('ok: connect')
    const client = await MongoClient.connect('mongodb://mongo:27017')
    DB = client.db('adapter:oidc')
  }
}