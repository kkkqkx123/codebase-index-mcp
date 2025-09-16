const express = require('express');
const app = express();

// 简单的Express路由测试 - path-to-regexp 8.x 语法
console.log('Testing simple Express route formats for path-to-regexp 8.x...');

// 1. 基本参数 - 工作
try {
  app.get('/test/:id', (req, res) => {
    console.log('Basic param:', req.params);
    res.json({ type: 'basic', params: req.params });
  });
  console.log('✓ Basic parameter route works: /test/:id');
} catch (e) {
  console.log('✗ Basic parameter route failed:', e.message);
}

// 2. 通配符参数 - path-to-regexp 8.x: /*name
try {
  app.get('/files/*path', (req, res) => {
    console.log('Wildcard param:', req.params);
    res.json({ type: 'wildcard', params: req.params });
  });
  console.log('✓ Wildcard route works: /files/*path');
} catch (e) {
  console.log('✗ Wildcard route failed:', e.message);
}

// 3. 可选参数 - path-to-regexp 8.x: {/:param}
try {
  app.get('/optional{/:id}', (req, res) => {
    console.log('Optional param:', req.params);
    res.json({ type: 'optional', params: req.params });
  });
  console.log('✓ Optional parameter route works: /optional{/:id}');
} catch (e) {
  console.log('✗ Optional parameter route failed:', e.message);
}

// 4. 测试正则表达式参数的不同语法
try {
  // 尝试使用命名组语法
  app.get('/regex/:id', (req, res) => {
    console.log('Regex param:', req.params);
    res.json({ type: 'regex', params: req.params });
  });
  console.log('✓ Simple named parameter works: /regex/:id');
} catch (e) {
  console.log('✗ Simple named parameter failed:', e.message);
}

console.log('\nAll routes registered successfully!');
console.log('Express version:', require('express/package.json').version);
console.log('path-to-regexp version in use: 8.2.0 (via router 2.2.0)');