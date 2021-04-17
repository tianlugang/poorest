# a lightweight private npm repository server

## Install AND Usage

```bash
    $ npm i @poorest/clover -g
    $ poorest-npm -h  # help
    $ poorest-npm  # start
    
    $ npm set registry http://localhost:9000/
    $ npm set ca null # 如果你使用 HTTPS

    $ nohup poorest-npm & /dev/null 2&1
    $ lsof -i:9001
```