import { isNotString } from '@poorest/is/lib/is-not-string'
import { DBDriver } from '@poorest/simple-db-driver'
import { HttpError } from '@poorest/util'
import { getDateJSON, IDateJSON, hex, createPasswd, verifyPasswd } from '../services'

type IUserDataConfig = {
  maxUsers?: null | number
  root?: string
  users?: IUserInitList
}
type IUserError = NodeJS.ErrnoException | null
type ISetUserItem = Partial<IUserItem>
type IAddUserItem = Partial<IUserItem> & {
  passwd: string
  role: string
  mail: string
}
type IUserList = {
  [account: string]: IUserItem
}
export type IUserAccount = string
export type IUserItem = {
  account: string
  passwd: string
  key: string // 预设字段
  name: string
  role: string
  sex: 0 | 1 | 2
  mail: string
  phone: number | string
  blog: string
  github: string
  twitter: string
  company: string
  createdAt: IDateJSON
  updatedAt: IDateJSON
}
export type IUserInitList = {
  [account: string]: Omit<IUserItem, 'key' | 'createdAt' | 'updatedAt'>
}
export class UserData {
  private driver!: DBDriver<IUserItem>
  private maxUsers!: number
  private canEditableProps = [
    'mail',
    'name',
    'sex',
    'phone',
    'blog',
    'company',
    'twitter',
    'github',
  ]
  constructor(opts: IUserDataConfig) {
    this.maxUsers = opts.maxUsers == null ? Infinity : opts.maxUsers
    this.driver = new DBDriver<IUserItem>('user', {
      file: './htpasswd',
      fields: [
        ['account'],
        ['passwd'],
        ['key'],
        ['name'],
        ['role'],
        ['sex', 0],
        ['mail'],
        ['phone'],
        ['blog'],
        ['company'],
        ['twitter'],
        ['github'],
        ['createdAt'],
        ['updatedAt'],
      ],
      root: opts.root
    })

    if (opts.users) {
      this.driver.init(opts.users as any, item => {
        if (isNotString(item.account) && isNotString(item.passwd)) {
          throw new HttpError(500, 'initial user, "account" and "passwd" must requried.')
        }
        item.key = hex()
        item.passwd = createPasswd(item.passwd, item.key)
        item.createdAt = getDateJSON()
        return item
      })
    }
  }

  getUsers(cb: (err: IUserError, users: IUserList) => void) {
    this.driver.read(cb)
  }

  getUser(account: IUserAccount) {
    return new Promise<IUserItem>((resolve, reject) => {
      this.driver.read((err, userList) => {
        if (err) {
          return reject(err)
        }
        const user = userList[account]

        if (!user) {
          return reject(new HttpError(404, 'this user does not exists.'))
        }

        resolve(user)
      })
    })
  }

  authenticate(account: IUserAccount, ciphertext: string) {
    return this.getUser(account).then(user => {
      if (!verifyPasswd(ciphertext, user.passwd, user.key)) {
        throw new HttpError(403, 'password is wrong.')
      }

      return user
    })
  }

  changeAuthenticate(account: IUserAccount, password: { new: string; old: string }) {
    return new Promise<IUserItem>((resolve, reject) => {
      this.getUser(account).then(exists => {
        if (!verifyPasswd(password.old, exists.passwd, exists.key)) {
          throw new HttpError(403, 'old password is wrong, cannot change password.')
        }
        const row = {
          ...exists,
          passwd: createPasswd(password.new, exists.key),
          account,
          key: exists.key,
          updatedAt: getDateJSON()
        }

        this.driver.merge(account, row)
        this.driver.write(err => {
          if (err) {
            return reject(err)
          }
          resolve(row)
        })
      }).catch(reject)
    })
  }

  setUser(account: IUserAccount, changed: Omit<ISetUserItem, 'key'>) {
    return new Promise<IUserItem>((resolve, reject) => {
      this.getUser(account).then(exists => {
        let needUpdated = false
        const newProps = Object.create(null)

        for (const prop of this.canEditableProps) {
          if (prop in changed) {
            newProps[prop] = (changed as any)[prop]
            needUpdated = true
          }
        }

        if (!needUpdated) {
          Reflect.deleteProperty(exists, 'passwd')
          Reflect.deleteProperty(exists, 'key')
          return resolve(exists)
        }

        const row = {
          ...exists,
          ...newProps,
          account,
          key: exists.key,
          updatedAt: getDateJSON()
        }

        this.driver.merge(account, row)
        this.driver.write(err => {
          if (err) {
            return reject(err)
          }
          resolve(row)
        })

      }).catch(reject)
    })
  }

  // login
  addUser(account: IUserAccount, added: IAddUserItem) {
    return new Promise<Pick<IUserItem, 'account' | 'key' | 'role' | 'mail'>>((resolve, reject) => {
      this.getUser(account).then(user => {
        if (verifyPasswd(added.passwd, user.passwd, user.key)) {
          resolve({
            account,
            key: user.key,
            role: user.role,
            mail: user.mail
          })
        } else {
          throw new HttpError(403, 'password is wrong.')
        }
      }).catch(err => {
        if (err.code !== 'E404') {
          return reject(err)
        }
        if (Object.keys(this.driver.records).length >= this.maxUsers) {
          return reject(new HttpError(403, 'maximum amount of users reached'))
        }

        try {
          const key = hex()
          const row = {
            ...added,
            account,
            key,
            passwd: createPasswd(added.passwd, key),
            createdAt: getDateJSON()
          }
          this.driver.merge(account, row)
          this.driver.write(err => {
            if (err) {
              return reject(err)
            }

            resolve({
              account,
              key,
              role: row.role,
              mail: row.mail
            })
          })
        } catch (err) {
          reject(err)
        }
      })
    })
  }
}