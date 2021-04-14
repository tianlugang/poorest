import { IRouterMiddleware } from '../types'

export const about: IRouterMiddleware = async ctx => {
    ctx.render('about', {
        asset: ctx.asset('index'),
        baisc: ['HTML5', 'JSX', 'Vue', 'Pug/Jade', 'EJS', 'Nunjucks', 'Handlebars', 'Markdown'],
        style: ['CSS3', 'Sass/Scss', 'Less', 'emotion.js', 'postcss', 'css module'],
        master: ['JavaScript/ES5/ES6/ES7', 'Typescript', 'jQuery', 'React', 'ECharts', 'Vue', 'Redux', 'NodeJs', 'Koa', 'Express', 'Jest', 'Mocha',],
        tools: ['git', 'svn', 'postman', 'vs code', 'WebStrom', 'npm', 'yarn', 'lerna']
    })
}