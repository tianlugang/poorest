**注册表服务接口**

* [Schema](#schema)
* [Client Errors](#client-errors)
* [Package](/docs?f=/registry/package.md)
* [User](/docs?f=/registry/user.md)
* [Token](/docs?f=/registry/token.md)
* [Search](/docs?f=/registry/search.md)

[![Run in Postman](https://run.pstmn.io/button.svg)](https://app.getpostman.com/run-collection/f6c8cb46358039bcd689#?env%5BRegistry%5D=W3sia2V5IjoicmVnaXN0cnkiLCJ0eXBlIjoidGV4dCIsInZhbHVlIjoiaHR0cHM6Ly9yZWdpc3RyeS5ucG0udGFvYmFvLm9yZyIsImVuYWJsZWQiOnRydWV9LHsia2V5IjoicGFja2FnZSIsInZhbHVlIjoiY25wbSIsInR5cGUiOiJ0ZXh0IiwiZW5hYmxlZCI6dHJ1ZX1d)

## Schema

API 使用 `HTTPS` or `HTTP` 通信，接收或发送消息都使用 `JSON` 格式，当`包`不存在时，默认从`registry.npmjs.org`上拉取

```bash
$ curl -i https://registry.npmjs.org

HTTP/1.1 200 OK

{
  "db_name": "registry"
  # 一些统计信息
}
```

## Client Errors

```json
Status: 4xx

{
  "error": "error_name",
  "reason": "error reason string"
}
```
