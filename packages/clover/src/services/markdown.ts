import xss, { getDefaultWhiteList } from 'xss'
import MarkdownIt from 'markdown-it'
import highlightjs from 'highlight.js'

const md = new MarkdownIt({
    html: true,
    linkify: true,
    highlight(code, lang) {
        try {
            return highlightjs.highlight(lang, code).value
        } catch (err) {
            return code
        }
    }
})
const xssWhiteList = getDefaultWhiteList()
const xssOptions = {
    whiteList: xssWhiteList
}
let isModified = false

function modifyXssDefaultWhiteList() {
    if (isModified) return
    isModified = true

    for (const tag in xssWhiteList) {
        if (xssWhiteList.hasOwnProperty(tag)) {
            const attrs = ((xssWhiteList as any)[tag] || []) as string[];
            attrs.unshift('class');
            (xssWhiteList as any)[tag] = attrs
        }
    }
}

export function mdRender(content: string, filterXss = false) {
    let html = md.render(content);
    if (filterXss !== false) {
        modifyXssDefaultWhiteList()
        html = xss(html, xssOptions)
    }

    return html;
}