# Nebula Graph Node.js 客户端信息

## 基本信息
- **npm包名**: `@nebula-contrib/nebula-nodejs`
- **GitHub仓库地址**: https://github.com/nebula-contrib/nebula-node
- **当前版本**: 3.0.3 (支持Nebula Graph 3.x)

## 安装

在安装之前，需要先全局安装node-gyp：
```bash
npm install -g node-gyp
```

然后安装Nebula Graph Node.js客户端：
```bash
npm install @nebula-contrib/nebula-nodejs --save --unsafe-perm
```

## 主要特性

1. 多服务器支持
2. 自动重连功能
3. 连接池支持
4. 断开连接检测
5. Thrift增强功能

## 使用方法

### 创建客户端

```javascript
// ESM
import { createClient } from '@nebula-contrib/nebula-nodejs'

// CommonJS
// const { createClient } = require('@nebula-contrib/nebula-nodejs')

// 连接选项
const options = {
  servers: ['ip-1:port', 'ip-2:port'], // Nebula服务器列表
  userName: 'xxx', // 登录用户名
  password: 'xxx', // 登录密码
  space: 'space name', // Nebula中的space名称
  poolSize: 5, // 每个服务器的连接池大小(可选，默认值:5)
  bufferSize: 2000, // 离线或连接建立前的命令缓存(可选，默认值:2000)
  executeTimeout: 15000, // 命令执行超时时间(毫秒)(可选，默认值:10000)
  pingInterval: 60000 // 心跳检测间隔(毫秒)(可选，默认值:60000)
}

// 创建客户端
const client = createClient(options)
```

### 执行命令

```javascript
// 1. 返回解析后的数据(推荐)
const response = await client.execute('GET SUBGRAPH 3 STEPS FROM -7897618527020261406')

// 2. 返回Nebula原始数据
const responseOriginal = await client.execute('GET SUBGRAPH 3 STEPS FROM -7897618527020261406', true)
```

### 事件监听

```javascript
const client = createClient(options)

// 连接准备就绪，可以执行命令
client.on('ready', ({sender}) => { })

// 发生错误
client.on('error', ({ sender, error }) => { })

// 连接成功
client.on('connected', ({ sender }) => { })

// 授权成功
client.on('authorized', ({ sender }) => { })

// 重新连接中
client.on('reconnecting', ({ sender, retryInfo }) => { })

// 连接关闭
client.on('close', ({ sender }) => { })
```

## 实用工具函数

### hash64函数

用于将字符串转换为字符串数组，基于MurmurHash3算法：

```javascript
// ESM
import { hash64 } from '@nebula-contrib/nebula-nodejs'

// CommonJS
// const { hash64 } = require('@nebula-contrib/nebula-nodejs')

const results = hash64('f10011b64aa4e7503cd45a7fdc24387b')
console.log(results) // 输出: ['2852836996923339651', '-6853534673140605817']
```

### Int64处理

由于Node.js无法直接表示Int64，因此将Int64字节转换为字符串：

```javascript
// ESM
import { bytesToLongLongString } from '@nebula-contrib/nebula-nodejs'

// CommonJS
// const { bytesToLongLongString } = require('@nebula-contrib/nebula-nodejs')

const s = '-7897618527020261406'
const buffer = [146, 102, 5, 203, 5, 105, 223, 226]
const result = bytesToLongLongString(buffer) // result等于s
```

## 开发相关

### 构建

```bash
git clone https://github.com/nebula-contrib/nebula-node.git
cd nebula-node
npm install --unsafe-perm
npm run build
```

### 单元测试

```bash
npm run build
npm run test
```

### 测试覆盖率

```bash
npm run coverage
```

### 发布

```bash
npm run build
cd dist
npm publish
```

## 注意事项

以下数据类型尚未在自动解析器中实现：

| 数据类型 | Nebula响应中的属性名 |
| --- | --- |
| DataSet | gVal |
| Geography | ggVal |
| Duration | duVal |