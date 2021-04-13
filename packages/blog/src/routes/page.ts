import { logger } from '@poorest/util'
import { Auth } from '../auth'
import { IRouterMiddleware } from '../types'

export const sign: IRouterMiddleware = async (ctx) => {
    const token = ctx.cookies.get('token') || ctx.get('authorization')

    if (token) {
        const [, tokenBody] = await Auth.verifyToken(token)
            .then(tokenBody => [null, Auth.checkToken(tokenBody, ctx.method, ctx.ip)])
            .catch(err => [err, null])
        if (tokenBody) {
            logger.debug(tokenBody, 'current user name: @{name}')
            ctx.user = tokenBody as any
            return ctx.redirect('/')
        }
    }

    ctx.render('login', {
        asset: ctx.asset('login'),
    }, { noLayout: true })
}

export const home: IRouterMiddleware = async (ctx, _next) => {
    ctx.render('index', {
        asset: ctx.asset('index')
    })
}

export const about: IRouterMiddleware = async (ctx, _next) => {
    ctx.render('about', {
        asset: ctx.asset('index'),
        baisc: ['HTML5', 'JSX', 'Vue', 'Pug/Jade', 'EJS', 'Nunjucks', 'Handlebars', 'Markdown'],
        style: ['CSS3', 'Sass/Scss', 'Less', 'emotion.js', 'postcss', 'css module'],
        master: ['JavaScript/ES5/ES6/ES7', 'Typescript', 'jQuery', 'React', 'ECharts', 'Vue', 'Redux', 'NodeJs', 'Koa', 'Express', 'Jest', 'Mocha',],
        tools: ['git', 'svn', 'postman', 'vs code', 'WebStrom', 'npm', 'yarn', 'lerna']
    })
}

export const article: IRouterMiddleware = async (ctx, _next) => {
    ctx.render('article', {
        asset: ctx.asset('index')
    })
}

export const grow: IRouterMiddleware = async (ctx, _next) => {
    const content = `Christmas or Christmas Day is an annual festival commemorating the birth of Jesus Christ,  observed most commonly on December 25 as a   religious and cultural celebration among billions  of people around the world. `
    const timelineColors = [
        'turqoise', 'black', 'brown', 'indigo', 'purple', 'grey', 'blue',
        'red', 'orange', 'opal', 'green', 'pink'
    ]

    ctx.render('grow', {
        asset: ctx.asset('index'),
        timelines: timelineColors.map(color => ({
            date: 'Dec 25',
            title: 'Christmas Day',
            content: content,
            color: color
        }))
    })
}
export const bdMap: IRouterMiddleware = async (ctx, _next) => {
    ctx.render('bd-map', {
        asset: {}
    }, { noLayout: true })
}

export const tolerant: IRouterMiddleware = async (ctx, next) => {
    await next()
    logger.debug(null, 'enter tolerant page.')
    const isError = (ctx.status === 404 || ctx.status > 500)
    if (isError) {
        ctx.render('tolerant', {
            asset: ctx.asset('index'),
            status: ctx.status,
            message: '抱歉，没有找到页面。',
            title: `页面出错了_`
        })
        return
    }
}
