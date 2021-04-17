# @poorest/ejs
my ejs

<br/>

### install

```sh
	 npm i -S @poorest/ejs
```

### API 说明
- `EJS.configure(options, [fixContext])`修改内置`Context`，第一个参数是`配置项`, 第二个参数可选函数，可以对`Context`进行补充修改
- `EJS.inject(name: string, handle: any, replace: boolean = false)`为模板注入一些功能, `name`在模板中名称，`handle`在模板中`name`变量对应的值或函数，`replace`是否替换已经注入的
- `EJS.complie(path: string, options?: EJS.IOptions)` 翻译模板，返回一个render函数
- `EJS.render(path: string, data: any, options?: EJS.IOptions)` 渲染指定`path`的模板，`path`为模板路径，`data`为传递给渲染函数的数据，`options`为配置项，可以修改`Context`
- `EJS.clearCache` 清空现有缓存

```ts
	// 所有API都绑定在 EJS 这个对象上 
	const { EJS } = require('@poorest/ejs');

	// 一些可选配置项
	EJS.configure({
	})
	
	// 注入一些
	EJS.inject(name, handle, replace)

	// 渲染模板
	EJS.render(path, data, options?)

	// 翻译模板，返回一个render函数
	EJS.complie(path: string, options?: EJS.IOptions)
```

### 配置项说明

- `strict` boolean 类型，是否在模板翻译之后的函数内部使用`"use strict";`
- `debug` boolean 类型, 是否在模版翻译时输出行号
- `rmWhitespace` boolean 类型，是否移除模板每一行行首的的空格与换行符
- `scope` 自定义类型，翻译模板得到的函数的内部`this`指针
- `delimiter` string类型，模板标签的标志性字符，默认是`%`, 如:`<%- %>`
- `cache` boolean类型，是否启用翻译缓存，将模板的翻译后的函数缓存起来，下次翻译时直接使用
- `cacheScheduler` 内置Map类型，缓存管理的调度对象，可使用`LRU`算法替换
```ts
	const LRU = require('lru-cache');
    const cacheScheduler = new LRU(Object.assign({ max: 100 }, cacheOptions));
```
- `suffix` string类型，模板文件的后缀名
- `root` string类型，模板文件的根目录
- `locals` string类型，默认为`locals`，即在模版中的全局变量的名称
- `viewLoader` 函数类型，返回模版的内容，这个函数具有两个参数，第一个是模板文件的相对路径；第二个是模板翻译时的`context`，上面存储了翻译过程中使用的量，请不要在该函数中修改这些量
- `inject` 对象数组类型, 注入到模板的函数或这变量，该对象包含`name`和`handle`两个属性，`name`即注入到模板中时使用的名称，`handle`即该对应的处理方式，可以是一个函数，也可以是变量，同时还可以使用API给模版中注入，默认注入:`include`功能

