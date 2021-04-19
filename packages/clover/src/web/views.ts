import path from 'path'
import { EJS } from '@poorest/ejs'
import { NODE_APP_ENVIRONMENT } from '@poorest/util';
import { paging } from '@poorest/paging'
import { i18n } from '@poorest/i18n'
import { generateMenuTree } from '@poorest/markdown'
import { IAppMiddleware } from '../types'
import { svgIcons } from '../services/icons'
import { timespan } from '../services'
import { Package } from '../storage/package'

const defaults = {
  writeResp: true,
};

type IKoaEJSMiddlewareOptions = {
  writeResp: boolean
  pretty?(result: string): string
  minify?(result: string): string
};

export function views(opts: IKoaEJSMiddlewareOptions = defaults): IAppMiddleware {
  const { pretty, minify, writeResp } = Object.assign({}, opts, defaults)
  const viewsRoot = path.resolve(__dirname, '../../views')
  const renderOptions = {
    layout: 'public/layout.html',
    noLayout: false,
    noWriteResp: false,
    status: 200
  }
  const scope = Object.create(null)

  scope.getPackageOwner = Package.getOwner
  scope.getPackageKeywords = Package.getKeywords
  scope.timespan = timespan
  scope.renderDocsTree = generateMenuTree

  EJS.configure({
    cache: NODE_APP_ENVIRONMENT.isProd,
    debug: true,
    suffix: '.html',
    root: viewsRoot,
    inject: [
      {
        name: 'paging',
        handle: paging
      },
      {
        name: 'svgIcons',
        handle: svgIcons
      },
      {
        name: 't',
        handle: i18n.t
      }
    ],
    scope
  });

  return async function koaEJSMiddleware(ctx, next) {
    if (!ctx.render) {
      ctx.render = (view, data = {}, opts) => {

        const { layout, noLayout, noWriteResp, status } = opts || renderOptions
        const record = { ...ctx.state, ...data }
        let result = EJS.render(view, record, opts)

        if (!noLayout && layout) {
          record.body = result
          result = EJS.render(layout, record, opts)
        }

        if (pretty) {
          result = pretty(result);
        } else if (minify) {
          result = minify(result);
        }

        if (!noWriteResp && writeResp) {
          ctx.type = 'html';
          ctx.status = status || 200;
          ctx.body = result;
        }

        return result;
      }
    }

    return next();
  };
}
