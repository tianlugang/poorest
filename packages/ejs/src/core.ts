export namespace EJS {
  export type ICacheScheduler<T = IRender> = {
    get(key: string): T | undefined
    set(key: string, data: T): unknown
    clear(): unknown
  };

  export type IInjects = {
    name: string
    handle: any
  }[];

  export type IContext<T = null> = {
    strict: boolean
    debug: boolean
    rmWhitespace: boolean
    parseComment: boolean
    scope: T
    delimiter: string
    cache: boolean
    cacheScheduler: ICacheScheduler
    suffix: string
    root: string
    locals: string
    viewLoader: <T>(path: string, ctx: EJS.IContext<T>) => string

    injects: string
    provide: any[]
    modes: IModes
    breakline: string
  };

  export type IOptions = Partial<Omit<IContext, 'injects' | 'provide' | 'modes' | 'breakline'>> & {
    inject?: IInjects
  };
}
type IRender = {
  (...data: any[]): string
}
type IModes = ReturnType<typeof createModes>;
function createModes(delimiter: string) {
  return {
    open: '<' + delimiter,
    eval: '<' + delimiter + '_',
    escaped: '<' + delimiter + '=',
    raw: '<' + delimiter + '-',
    comment: '<' + delimiter + '#',
    literal: '<' + delimiter + delimiter,
    literalClose: delimiter + delimiter + '>',
    close: delimiter + '>',
  };
}

function createRegex(delimiter: string) {
  return new RegExp(
    '(<%%|<%=|<%-|<%_|<%#|<%|%>|%%>)'.replace(/%/g,
      delimiter.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
    )
  );
}

function parseText(text: string, delimiter: string): string[] {
  const matches: string[] = [];
  const regex = createRegex(delimiter);
  let meta = text.replace(/^\uFEFF/, '');
  let result = regex.exec(meta);
  let index, matched;

  while (result) {
    index = result.index;

    if (index !== 0) {
      matches.push(meta.substring(0, index));
      meta = meta.slice(index);
    }

    matched = result[0];

    if (matched) {
      matches.push(matched);
      meta = meta.slice(matched.length);
      result = regex.exec(meta);
    }
  }

  if (meta) {
    matches.push(meta);
  }

  return matches;
}

function parseMode(line: string, modes: IModes) {
  let mode = '';

  switch (line) {
    case modes.open:
      mode = 'open';
      break;
    case modes.eval:
      mode = 'eval';
      break;
    case modes.escaped:
      mode = 'escaped';
      break;
    case modes.raw:
      mode = 'raw';
      break;
    case modes.comment:
      mode = 'comment';
      break;
    case modes.literal:
      mode = 'literal';
      break;
    case modes.literalClose:
      mode = 'literalClose';
      break;
    case modes.close:
      mode = 'close';
      break;
    default:
      break;
  }

  return mode;
}

function parseLine(mode: string | undefined, line: string, modes: IModes, parseComment: boolean) {
  let token = '';

  switch (mode) {
    case 'open':
      token = line;
      break;
    case 'eval':
      token = '__append(' + line + ');'
      break;
    case 'escaped':
      token = '__append(' + escapeXML(line) + ');';
      break;
    case 'raw':
      token = '__append(' + line.replace(/;(\s*$)/, '$1') + ');';
      break;
    case 'comment':
      token = parseComment ? '__append("<!--' + line + '-->");' : '';
      break;
    case 'literal':
      token = '__append("' + line.replace(modes.literal, modes.open) + '");';
      break;
    case 'literalClose':
      token = '__append("' + line.replace(modes.literalClose, modes.close) + '");';
      break;
    case 'close':
      token = '__append("' + line + '");';
      break;
    default:
      token = '__append("' + line + '");';
      break;
  }

  return token;
}

function createRender(path: string, ctx: EJS.IContext = context): IRender {
  const {
    strict, injects, viewLoader, scope, provide,
    modes, breakline, debug, rmWhitespace, parseComment,
    delimiter
  } = ctx;
  const text = viewLoader(path, ctx);
  const matches = parseText(text, delimiter);
  const src: string[] = [];
  const source: string[] = [];
  let lineCount = 0, lineNo = 1, code = '', tag = '';

  // 使用严格模式
  if (strict) {
    src.push('"use strict";');
  }
  matches.forEach((line, i) => {
    if (line.indexOf(modes.open) === 0 && line.indexOf(modes.literal) !== 0) {
      if (matches[i + 2] !== modes.close) {
        throw new Error(`Could not matching close tag at (${i + 2});`);
      }
    }

    // line.match(/^\s*include\s+(\S+)/)
    lineCount = line.split('\n').length - 1;
    const mode = parseMode(line, modes);

    if (!mode) {
      if (rmWhitespace) {
        line = clearWhitespace(line);
      }

      line = formatLine(line);
      code = parseLine(tag, line, modes, parseComment);
      source.push(code, breakline);
    }

    if (debug && lineCount) {
      lineNo += lineCount;
      source.push('__line = ' + lineNo + ';', breakline);
    }

    tag = mode;
  });

  src.push(
    `try {
      var __line = 1;
      var __output = [];
      var __append = __output.push.bind(__output);
      ${source.join('')}
      return __output.join("");
    } catch (error) {
      console.log("Error lineNo", __line);
      console.log("Error message", error.message);
    }`
  );

  code = src.join('');
  const func = new Function(injects, code);

  return function r(...data: any[]): string {
    return func.apply(scope, [...provide, ...data]);
  };
}

function returnString(str: string) {
  return str;
}

function escapeXML(line: string) {
  return line.replace(/;(\s*$)/, '$1').replace(ENCODE_ESCAPE, escapeChar)
}

function escapeChar(c: string) {
  return (ENCODE_RULES as any)[c] || c;
}

function formatLine(line: string) {
  return line.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/"/g, '\\"');
}

function clearWhitespace(line: string) {
  return line.replace(/^\n/, '').replace(/^\s+/, '');
}

const ENCODE_RULES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&#34;',
  '\'': '&#39;'
};
const ENCODE_ESCAPE = /[&<>\'"]/;
const injects: EJS.IInjects = [
  {
    // <%- include('about/index', obj); %>
    name: 'include',
    handle: (path: string, ...data: any[]) => {
      const render = EJS.complie(path);

      return render(...data);
    }
  },
];

const context: EJS.IContext = {
  cache: true,
  cacheScheduler: new Map<string, (data: any) => string>(),
  viewLoader: returnString,
  root: 'views',
  suffix: '.html',
  locals: 'locals',

  scope: null,
  debug: false,
  rmWhitespace: false,
  parseComment: true,
  strict: false,
  delimiter: '%',

  injects: '',
  provide: [],
  breakline: '',
  modes: createModes('%')
};

export const EJS = {
  configure(options: EJS.IOptions = {}, fixContext?: <T>(ctx: EJS.IContext<T>) => void) {
    const { delimiter, debug, locals, inject } = Object.assign(context, options);
    const names: string[] = [];
    const handles: any[] = [];

    if (inject) {
      injects.push(...inject);
    }

    injects.forEach(({ name, handle }, index) => {
      names[index] = name;
      handles[index] = handle;
    });
    names.push(locals);

    context.injects = names.join(',');
    context.provide = handles;
    context.breakline = debug ? '\n' : '';
    context.modes = createModes(delimiter);

    if (fixContext) {
      fixContext(context);
    }

    return context
  },

  inject(name: string, handle: any, replace: boolean = false) {
    if (typeof handle === 'undefined' || name.length === 0 || !isNaN(parseInt(name))) {
      return;
    }

    let index = injects.findIndex(inject => inject.name === name);

    if (index === -1) {
      injects.push({
        name,
        handle
      });
      return;
    }

    if (replace && index > -1) {
      injects[index]!.name = name;
      injects[index]!.handle = handle;
    }
  },

  complie(path: string, options?: EJS.IOptions) {
    if (options) {
      EJS.configure(options);
    }
    const { cacheScheduler, cache } = context;

    if (cache) {
      const render = cacheScheduler.get(path);
      if (render) {
        return render;
      }
    }

    const render = createRender(path);

    if (cache) {
      cacheScheduler.set(path, render);
    }

    return render;
  },

  render(path: string, data: any, options?: EJS.IOptions): string {
    const fn = EJS.complie(path, options);

    return fn(data);
  },

  // 清除缓存
  clearCache() {
    context.cacheScheduler.clear();
  }
}