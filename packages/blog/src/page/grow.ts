import { IRouterMiddleware } from '../types'

export const grow: IRouterMiddleware = async (ctx, _next) => {
    const content = `对于一个web前端开发人员而言，本身对业务需求的理解是不触及业务市场部分的，作为产品的第一批用户， 我们往往并不会考虑产品的生存之道，这不是说我们想不到，而是工作安排和环境氛围不许可， 一般情况下我们基本上都没有时间去考虑更好的用户体验方案，在紧促的开发工作中，大多数时候都是为了完成任务，领到工资。 一个认真研究，想搞出成绩的人是突出的，被孤立的，因为你和别人不一样。 `
    const timelineColors = [
        'turqoise', 'black', 'brown', 'indigo', 'purple', 'grey', 'blue',
        'red', 'orange', 'opal', 'green', 'pink'
    ]

    ctx.render('grow', {
        asset: ctx.asset('index'),
        timelines: timelineColors.map(color => ({
            date: '4 13',
            title: '我是谁',
            content: content,
            color: color
        }))
    })
}