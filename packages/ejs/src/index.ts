import fs from 'fs';
import path from 'path';
import { EJS } from './core';

const fileLoader = (viewPath: string, ctx: EJS.IContext) => {
  try {
    if (!path.extname(viewPath)) {
      viewPath += ctx.suffix;
    }

    viewPath = path.join(ctx.root, viewPath);
    return fs.readFileSync(viewPath, 'utf-8');
  } catch (error) {
    throw error;
  }
};
const originalConfigure = EJS.configure;
const overrideConfigure = (options?: EJS.IOptions) => {
  return originalConfigure(Object.assign({ viewLoader: fileLoader }, options), ctx => {
    ctx.suffix = ctx.suffix.charAt(0) === '.' ? ctx.suffix : '.ejs';
    ctx.root = path.isAbsolute(ctx.root) ? ctx.root : path.resolve(process.cwd(), ctx.root || 'views');
  });
};

EJS.configure = overrideConfigure;

export { EJS };