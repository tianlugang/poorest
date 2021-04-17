`@poorest/clover` 是一个 Node.js 创建的轻量的私有npm registry
**Install AND Usage**

```bash
    $ npm install @poorest/clover -g
    $ poorest-npm -h  # help
    $ poorest-npm  # start
    
    $ npm set registry http://localhost:9000/
    $ npm set ca null # 如果你使用 HTTPS
```

非常感谢以下这几个包，在我写这个包的过程中提供参考和思路
- [verdaccio](https://github.com/verdaccio/verdaccio)
- [cnpmjs.org](https://github.com/cnpm/cnpmjs.org)
- [sinopia](https://github.com/rlidwka/sinopia)
- [npm-registry-client](https://github.com/npm/npm-registry-client)

去年（2020年）11月辞职，去华为外包三日游，然后又去了另一家外包公司一日游，回来后就没再打算上班了，接下来一段时间就在写这个`包`，同时也在为我心中的那个梦奋斗着。

我是一个辍学生，大专一年就结束了，个中幸酸就不多说了。辗转到这一行，也有一个很长的故事，从培训到现在5年多，懵懵懂懂一个人凭着一股儿聪明劲钻研着。

不一个人写东西是体会不到自己的知识的匮乏的，而且不会触及自己的极限，这种没有薪水，没有希望没有人关注的日子，会令人煎熬难耐。我每天都觉得自己可以了，但还是发觉自己很渣，每次都想说服自己去转行，但每当看到`代码`时，我就可以静坐一整天，有时候甚至会超过`14`个小时，而且不吃饭，可能是除此之外我啥都不会做吧！

在写这个`包`时，我遇到了很多困难，基本上都可以认为是来自于我自身的，因此我不得不花大量的时间去补充自己的不足，大多数时间都是在`github`或`gitee`上看别人的代码，还有四处看文档（对照翻译），可能是不再像二十几岁那会儿了，此刻的我脑海里居然没有任何关于我看过的东西的记忆。尽管如此，我还是磕磕绊绊的写完了第一个版本，而且是按照自己的想法。

这也许就是我的能力吧！废话不多说了，来介绍下这个包！
