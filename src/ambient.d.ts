declare module '*'
declare module 'gun' {
  type Options = {
    peers?: string[] | { [peer: string]: {} },
    radisk?: boolean,
    localStorage?: boolean,
    uuid?: boolean,
    [moduleName: string]: any
  }
  type Data = { [key: string]: Data } | string | number | boolean | null
  type Ack = {
    err?: any,
    ok?: string
  }
  export default class Gun {
    constructor()
    constructor(peer: string)
    constructor(peers: string[])
    constructor(options?: Options)
    put(data: Data, callback?: (ack: {
      err?: any,
      ok?: string
    }) => void): Gun
    get(key: string, callback?: (ack: {
      err?: any,
      put?: Data,
      get: string
    }) => void): Gun
    opt(options: Options): void
    back(amount: number): Gun
    on(callback: (data: Data, key: string) => void, option?: boolean | {
      change: boolean
    }): Gun
    once(callback: (data: Data, key: string) => void, option?: {
      wait: number
    }): Gun
    val(callback: (data: Data, key: string) => void, option?: {
      wait: number
    }): Gun
    set(data: Gun | object, callback?: (ack: {
      err?: any,
      ok?: string
    }) => void): Gun
    map(callback: (value: Data, key: string) => (Data | undefined)): Gun
    path(key: string): Gun
    not(callback: (key: string) => void): Gun
    open(callback: (data: Data) => void, option?: { wait: number }): Gun
    load(callback: (data: Data) => void, option?: { wait: number }): Gun
    then(callback?: (resolved: Data) => void): Promise<Data>
    promise(callback?: (resolved: {
      put: Data,
      get: string,
      gun: Gun
    }) => void): Promise<{
      put: Data,
      get: string,
      gun: Gun
    }>
  }
}