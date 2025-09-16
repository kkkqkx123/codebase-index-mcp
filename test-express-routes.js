const express = require('express');
const app = express();

// 测试不同的路由参数格式 - path-to-regexp 8.x 语法
console.log('Testing Express route parameter formats for path-to-regexp 8.x...');

// 1. 基本参数
app.get('/test/:id', (req, res) => {
  console.log('Basic param:', req.params);
  res.json({ type: 'basic', params: req.params });
});

// 2. 通配符参数 - path-to-regexp 8.x 语法: 使用 /*path 而不是 /:path*
app.get('/files/*path', (req, res) => {
  console.log('Wildcard param:', req.params);
  res.json({ type: 'wildcard', params: req.params });
});

// 3. 可选参数 - path-to-regexp 8.x 语法: 使用 {/:id} 而不是 /:id?
app.get('/optional{/:id}', (req, res) => {
  console.log('Optional param:', req.params);
  res.json({ type: 'optional', params: req.params });
});

// 4. 正则表达式参数 - path-to-regexp 8.x 语法: 使用 {:id(\\d+)} 而不是 /:id(\\d+)
app.get('/regex/{:id(\\d+)}', (req, res) => {
  console.log('Regex param:', req.params);
  res.json({ type: 'regex', params: req.params });
});

// 测试路由解析
const routes = [
  '/test/:id',
  '/files/*path',
  '/optional{/:id}',
  '/regex/{:id(\\d+)}'
];

console.log('\nRoute patterns:');
routes.forEach(route => {
  console.log(`- ${route}`);
});

// 启动服务器测试
const port = 3001;
const server = app.listen(port, () => {
  console.log(`\nTest server running on port ${port}`);
  console.log('Try these URLs:');
  console.log(`- http://localhost:${port}/test/123`);
  console.log(`- http://localhost:${port}/files/folder/subfolder/file.txt`);
  console.log(`- http://localhost:${port}/optional/`);
  console.log(`- http://localhost:${port}/optional/456`);
  console.log(`- http://localhost:${port}/regex/789`);
  console.log(`- http://localhost:${port}/regex/abc`); // should not match
});

// 导出用于测试
module.exports = { app, server };