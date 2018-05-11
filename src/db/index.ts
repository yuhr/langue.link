import { default as Gun, Document, Ack } from 'gun'
import 'gun-mongo-key'
import 'gun/lib/load'
import nanoid from 'nanoid'

const gun = new Gun({
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

export class Database {
  private readonly node: Gun
  constructor(name: string) {
    this.node = gun.get(name)
  }
  async get(key: string) {
    return await new Promise<Document | undefined>(resolve => {
      this.node.load(resolve)
    })
  }
  async set(key: string, document: Document) {
    const resolve = await new Promise<Ack>(resolve => {
      this.node.get(key).put(document, resolve)
    })
    if (resolve.err) throw Error(resolve.err.toString())
  }
}