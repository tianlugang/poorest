# 注册表服务接口

> 文档正在编写中，马上就出来了
## Overview

* [Schema](#schema)
* [Client Errors](#client-errors)
* [Package](#package)
* [User](#user)
* [Search](#search)

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

## Package

* Read
  * [获取一个包的元数据](#get-a-single-package)  
* Write
  * [发布包](#publish-a-new-package)
  * [修改包的tag](#update-a-packages-tag)
  * [更新包的维修人员](#update-a-packages-maintainers)
  * [删除包的一个版本](#remove-one-version-from-package)

### 获取一个包的元数据

```
GET /:package
```

#### Response 200

```json
HTTP/1.1 200 OK
Etag: "8UDCP753LFXOG42NMX88JAN40"
// 属性基本同 npm 官方API
{
  "_id": "example",
  "_rev": "11-e6d1e6e96eaf72433fef6aaabe843af8",
  "name": "example",
  "_attachments": {}
}
```

### 发布一个包

* 是系统用户，而且必须登入

```
PUT /:package
```

#### Input

```json
```

## User

- [登入](#auth-user)
- [获取用户信息](#get-a-single-user)
- [新增用户](#add-a-new-user)
- [更新某一用户](#update-a-exists-user)

## Token

- [创建 token](#create-token)
- [查看 token](#list-token)
- [删除 token](#delete-token)
