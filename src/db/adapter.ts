import { DistributedDatabase } from './backend'
import nanoid from 'nanoid'

const db = {
  grants: new DistributedDatabase('grants'),
  payloads: new DistributedDatabase('payloads')
}

type Payload = {
  grantId: string,
  header: string,
  payload: string,
  signature: string
}

type Grant = {
  [key: string]: string
}

type Id = string

export default class Adapter {
  name: string
  constructor(name: string) {
    console.log('adapter')
    this.name = name
  }
  async upsert(id: Id, payload: Payload, expiresIn: number) {
    console.log(`payload ${payload}`)
    const key = this.key(id)
    const { grantId } = payload
    if (grantId !== undefined) {
      const grantKey = Adapter.grantKeyFor(grantId)
      await db.grants.set(grantKey, { [nanoid()]: key } )
    }
    await db.payloads.set(key, payload) // expiresIn * 1000
  }
  async find(id: Id) {
    return await db.payloads.get(this.key(id)) as Payload
  }
  async consume(id: Id) {
    console.log('consume')
    await db.payloads.get(this.key(id))
  }
  async destroy(id: Id) {
    const key = this.key(id)
    const payload = await db.payloads.get(key) as Payload
    if (payload) {
      const grantId = payload.grantId
      // db.payloads.unload(key)
      if (grantId) {
        const grantKey = Adapter.grantKeyFor(grantId)
        const grant = await db.grants.get(grantKey) as Grant
        //Object.values(grant).forEach(token => db.payloads.unload(token))
      }
    }
  }
  key(id: Id) {
    return `${this.name}:${id}`
  }
  static grantKeyFor(id: Id) {
    return `grant:${id}`
  }
  static async connect(provider: any) {
    console.log('connect')
  }
}