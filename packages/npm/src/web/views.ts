import path from 'path'
import { EJS } from '@poorest/ejs'
import { NODE_APP_ENVIRONMENT } from '@poorest/util';
import { IAppMiddleware } from '../types'
import { paging } from '../services/paging'
import { svgIcons } from '../services/icons'
import { timespan, i18n } from '../services';
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
        let result = EJS.render(view, data, opts)

        if (!noLayout && layout) {
          result = EJS.render(layout, {
            ...data,
            body: result
          }, opts)
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
