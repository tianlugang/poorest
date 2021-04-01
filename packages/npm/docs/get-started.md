# 开始使用 NPM 私服

非常感谢以下这几个包，在我写这个包的过程中提供参考和思路
- [verdaccio](https://github.com/verdaccio/verdaccio)
- [cnpmjs.org](https://github.com/cnpm/cnpmjs.org)
- [sinopia](https://github.com/rlidwka/sinopia)
- [npm-registry-client](https://github.com/npm/npm-registry-client)

去年（2020年）11月辞职，去华为外包三日游，然后又去了另一家外包公司一日游，回来后就没再打算上班了，接下来一段时间就在写这个`包`，同时也在为我心中的那个梦奋斗着。

我是一个辍学生，大专一年就结束了，个中幸酸就不多说了。辗转到这一行，也有一个很长的故事，从培训到现在5年多，懵懵懂懂一个人凭着一股儿聪明劲钻研着。

不一个人写东西是体会不到自己的知识的匮乏的，而且不会触及自己的极限，这种没有薪水，没有希望没有人关注的日子，会令人煎熬难耐。我每天都觉得自己可以了，但还是发觉自己很渣，每次都想说服自己去转行，但每当看到`代码`时，我就可以静坐一整天，有时候甚至会超过`14`个小时，而且不吃饭，可能是除此之外我啥都不会做吧！

在写这个`包`时，我遇到了很多困难，基本上都可以认为是来自于我自身的，因此我不得不花大量的时间去补充自己的不足，大多数时间都是在`github`或`gitee`上看别人的代码，还有四处看文档（对照翻译），可能是不再像二十几岁那会儿了，此刻的我脑海里居然没有任何关于我看过的东西的记忆。尽管如此，我还是磕磕绊绊的写完了第一个版本，而且是按照自己的想法。

这也许就是我的能力吧！废话不多说了，来介绍下这个包！

## Install AND Usage

```bash
    $ npm install @poorest/clover -g
    $ poorest-npm -h  # help
    $ poorest-npm  # start
    
    $ npm set registry http://localhost:9000/
    $ npm set ca null # 如果你使用 HTTPS
```

## Config

配置文件以`yaml`格式呈现，默认写到用户家目录下`.tlg/npm/config.yaml`中。`.tlg/npm`为默认路径，不能更改
```typescript
    type IAppConfig = {
        language: string
        expire: number | string
        maxUsers: number
        userAgent: string
        secret: string
        maxBodySize: string
        users: IUserInitList
        title: string
        prefix?: string
        listen: string | number

        storage: string
        registry: IRegistryConfigs
        packages: ILegacyPackageSpecList

        https: IHttpsConfig

        webEnable: boolean
        webListen: string | number
        logo?: string

        logs: ILoggerConfig
    }
```

* `config.storage` 默认`./storage`, 包的存放目录
* `config.language` 默认或不指定时为`en`，可选值`zh_CN`
* `config.title` 将会同步到 `process.title` / `日志标题` / `web界面标题`
* `config.userAgent` 在请求其他`registry`时，将会设置到请求头部，并发送
* `config.secret` 生成用户的`Auth`信息相关的一个字符串
* `config.maxUsers` 系统最大用户数，默认为`1000`，指定为`-1`时，会认为是`Infinity`，无上限
* `config.prefix` 设置到路由路径的`pathname`上的前缀字符串
* `config.listen` 注册表`registry`服务监听的地址或端口，默认为`localhost:9000`
* `config.maxBodySize` 服务器可解析的最大`body`,默认10mb
* `config.webEnable` 是否开启web服务，默认为`false`
* `config.webListen` web服务监听的地址或端口，默认为`localhost:9001`
* `config.canSearchFromNPM` web服务中检索一个包时，是否去`npmjs.org`上检索
* `config.logo` web界面的logo, 是一个指向一张图像的地址，不设置时使用默认的logo 
* `config.https` https配置
   - `config.https.enable` 默认为 false， 是否为启动`https`服务，开启时必须提供`key` 和 `cert`
   - `config.https.key` path/to/server.key
   - `config.https.cert`  path/to/server.crt
* `config.logs` 日志配置
   - `config.logs.type` 日志的输出类型:`file | stdout | stderr` , 默认`stdout`
   - `config.logs.pretty` 是否格式化日志，默认 true
   - `config.logs.level` 日志等级, `trace | debug | info | message (default) | warn | error | fatal`， 默认为`trace`
   - `config.logs.logDir` 当类型为`file`时，日志存储的目录
   - `config.logs.maxFileSize` 日志文件的最大大小，默认是 `50M`，超过时开器旋转
    ```typescript
        type ILogMaxFileSize = number | string;
        type ILogSlicingMode = 'date' | 'level' | 'none';
        type ILogSaverConfig = {
            root: IDir,
            autoFlush?: boolean
            enableRotate?: boolean
            maxFileSize?: ILogMaxFileSize
            maxLogFiles?: number
            logFileName?: string
            slicingMode?: ILogSlicingMode
            slicingAtDay?: boolean
            slicingAtMonth?: boolean
            slicingAtYear?: boolean
        };
        type ILoggerConfig = ILogSaverConfig & {
            type: 'stdout' | 'stderr' | 'file'
            pretty: boolean
            title: string
            level: logger.IConfiguredLevel
            logDir: string
            canReconfigurable?: boolean
        }
    ```
* `config.users` 初始化用户列表，是`IUserInitList`类型，默认初始化了管理员信息
    ```typescript
        type IUserItem = {
            account: string
            passwd: string
            key: string // 预设字段
            name: string
            group: string
            role: string
            sex: 0 | 1 | 2
            mail: string
            phone: number | string
            blog: string
            company: string
            createdAt: IDateJSON
            updatedAt: IDateJSON
        };
        type IUserInitList = {
            [account: string]: Omit<IUserItem, 'key' | 'createdAt' | 'updatedAt'>
        }
    ```
* `config.registry` 其他注册表列表, 是`IRegistryConfigs`类型，如下：
    ```typescript
        type IRequestConfig = {
            cache: boolean  // 包的最大缓存时间
            defaultTag: string // 默认 tag
            fromCI: boolean // 是否来自 cicd
            headers: OutgoingHttpHeaders // 设置给 Registry 请求头的信息
            localAddress: string // 本地网段地址 
            maxAge: number // 包的最大缓存时间
            maxRedirects: number // 最大重定向次数
            maxSockets: number // 最大并发数
            name: string // registry的名称，比如 npmjs/taobao
            onFailedRetryIntervalTime: number // 如果多个请求连续失败，在接下来多长时间内不再发出请求
            onFailedRetryTimes: number  // 同一个请求失败后重试的次数
            refer: string // 请求头中 refer
            redirect: 'error' | 'no-redirect' | 'manual' | 'auto' // 重定向的模式
            session: string // 请求ID
            ssl: SecureContextOptions // socket ssl配置
            strict: boolean // agent rejectUnauthorized 
            timeout: number // 超时时间
            url: string // registry 地址，必选项
            userAgent: string
            version: string
        };

        type IOmitKeys = 'version' | 'userAgent' | 'name';
        type IOverrideKeys = 'maxAge' | 'timeout' | 'ssl';
        type IRegistryConfigOrginal = Omit<IRequestConfig, IOmitKeys>;
        type IRegistryConfig = Omit<IRegistryConfigOrginal, IOverrideKeys> & {
            maxAge: string | number
            timeout: string | number
            ssl: IRegistryConfigOrginal['ssl'] | null
        };
        type IRegistryConfigs = {
            [name: string]: IRegistryConfig
        };
    ```
* `config.packages` 包管理, 为`ILegacyPackageSpecList`类型，类型如下：
    ```typescript
        type IPackageSpec = {
            // 包的操作权限: 比如 755
            mode: string
            // 如果本地包不存在，将尝试去何处拉取
            proxy: string[]
            // 可以用这种方式覆盖一组包的存储目录
            storage: string
            // 用户
            users: []
        };

        type ILegacyPackageSpec = Omit<IPackageSpec, 'storage'> & { 
            storage?: string
        };

        type ILegacyPackageSpecList = Record<string, ILegacyPackageSpec>;
    ```
    对包进行分组, 默认将所有包划分到`**`这个组里，即系统默认组,其`mode`为`755`
    - `config.packages[@org].proxy` 如果本组内有包不存在，或者需要检测包的唯一性，将尝试去何处拉取，对应到`config.registry`的`key`值，默认为`['nmpjs']`,即如果包不存在，将会尝试到`npmjs`对应的`registry`中去寻找
    - `config.packages[@org].storage` 本组包的存储目录，默认同`config.storage`
    - `config.packages[@org].users` 用户名数组，标记了本组包归那些用户所维护，设置后只有这些用户能够操作
    - `config.packages[@org].mode` 本组包的权限`mode`, [[参考-文件的模式]](http://nodejs.cn/api/fs.html)

        使用三个八进制数字的序列构造 `mode`（ 例如 755）。
        * 最左边的数字（示例中的 7）指定文件所有者的权限。 
        * 中间的数字（示例中的 5）指定群组的权限。 
        * 最右边的数字（示例中的 5）指定其他人的权限。

        | 数字 | 说明 |
        | -- | -- |
        | 7  | 可读、可写、可检索 |
        | 6	 | 可读、可写 |
        | 5	 | 可读、可检索 |
        | 4	 | 只读 |
        | 3	 | 可写、可检索 |
        | 2	 | 只写 |
        | 1	 | 只可检索 |
        | 0	 | 没有权限 |

        例如，八进制值 765 表示：
        * 所有者可以读取、写入和执行该文件。
        * 群组可以读和写入该文件。
        * 其他人可以读取和执行该文件。