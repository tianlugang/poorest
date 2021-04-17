**Package**

* Read
  * [获取一个包的元数据](#get-a-single-package)  
* Write
  * [发布包](#publish-a-new-package)
  * [修改包的tag](#update-a-packages-tag)
  * [更新包的维修人员](#update-a-packages-maintainers)
  * [删除包的一个版本](#remove-one-version-from-package)

### 获取一个包的元数据

```
GET /:name
```

#### Response 200

```json
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
PUT /:name
```

#### Input

```json
  // 参考 npm publish 的提交参数
```

