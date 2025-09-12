# Semgrep增强规则库指南

## 概述
本文档详细描述了用于替代CodeQL的Semgrep增强规则库，旨在在2周内实现80% CodeQL核心功能覆盖。

## 当前状态分析
- **控制流规则**：1个（basic-cfg.yml）→ 目标8个
- **数据流规则**：1个（taint-analysis.yml）→ 目标6个  
- **安全规则**：2个（sql-injection.yml, xss-detection.yml）→ 目标26个
- **总体覆盖率**：当前约15% → 目标85%

## 增强规则库结构

### 📁 目录结构
```
enhanced-rules/
├── control-flow/          # 控制流分析规则
├── data-flow/            # 数据流分析规则
├── security/             # 安全漏洞检测规则
└── templates/            # 规则模板和示例
```

## 规则详细规范

### 1. 控制流分析规则（✅已完成8个）

#### 1.1 enhanced-cfg-simple.yml ✅
**功能**：基础控制流分析
**状态**：已完成
**包含规则**：
- complex-nested-conditions：复杂嵌套条件检测
- unreachable-code：不可达代码检测
- missing-break-in-switch：switch语句缺失break
- infinite-recursion：无限递归检测

#### 1.2 js-control-flow.yml ✅
**功能**：JavaScript控制流分析
**状态**：已完成
**包含规则**：
- js-complex-nested-if：复杂嵌套if语句
- js-empty-catch：空catch块检测
- js-return-in-finally：finally块中的返回语句
- js-infinite-loop：无限循环检测
- js-unused-loop-variable：未使用的循环变量

#### 1.3 loop-analysis-fixed.yml ✅
**功能**：循环分析规则
**状态**：已完成
**包含规则**：
- loop-invariant-code：循环不变代码检测
- empty-loop-body：空循环体检测
- off-by-one-error：循环边界错误
- loop-condition-modification：循环条件变量修改
- infinite-loop-risk：无限循环风险

#### 1.4 exception-flow-simple.yml ✅
**功能**：异常流分析
**状态**：已完成
**包含规则**：
- empty-catch-block：空catch块
- return-in-finally：finally块返回
- throw-in-finally：finally块抛出异常

#### 1.5 resource-management.yml ✅
**功能**：资源管理分析
**状态**：已完成
**包含规则**：
- resource-leak-file-handle：文件句柄泄漏
- resource-leak-database-connection：数据库连接泄漏
- resource-leak-memory：内存泄漏
- resource-pool-misuse：资源池使用不当

### 2. 数据流分析规则（6个）

#### 2.1 taint-analysis.yml（已存在）
**功能**：基础污点分析
**增强内容**：支持跨函数污点传播

#### 2.2 cross-function-taint.yml
**功能**：跨函数污点传播分析
**检测模式**：
- 参数污染传播
- 返回值污染链
- 全局变量污染

**规则示例**：
```yaml
rules:
  - id: cross-function-taint-propagated
    pattern-either:
      - pattern: |
          def $FUNC($PARAM):
            ...
            return $PARAM
          ...
          $SINK = $FUNC($SOURCE)
    message: "Cross-function taint propagation detected"
    severity: ERROR
```

#### 2.3 constant-propagation.yml
**功能**：常量传播分析
**检测内容**：
- 编译时常量计算
- 运行时常量优化
- 死代码消除

#### 2.4 null-pointer-analysis.yml
**功能**：空指针分析
**检测内容**：
- 潜在的空指针解引用
- 空值传播路径
- 防御性编程缺失

#### 2.5 buffer-overflow-detection.yml
**功能**：缓冲区溢出检测
**检测内容**：
- 数组越界访问
- 字符串缓冲区溢出
- 内存操作错误

#### 2.6 race-condition-analysis.yml
**功能**：竞态条件分析
**检测内容**：
- 并发访问冲突
- 共享资源竞争
- 线程安全缺陷

### 3. 安全规则（26个）

#### 3.1 输入验证类（4个）
[x]
##### path-traversal-complete.yml
**功能**：完整路径遍历检测
**检测内容**：
- 目录遍历攻击
- 文件系统访问控制
- 路径规范化检查

**规则示例**：
```yaml
rules:
  - id: path-traversal-vulnerable
    pattern-either:
      - pattern: |
          open($PATH + $USER_INPUT)
      - pattern: |
          fs.readFile(`./uploads/${req.params.filename}`)
    message: "Potential path traversal vulnerability"
    severity: ERROR
```

##### command-injection-advanced.yml
**功能**：高级命令注入检测
**检测内容**：
- 动态命令构造
- Shell元字符注入
- 命令参数注入

##### ldap-injection.yml
**功能**：LDAP注入检测
**检测内容**：
- LDAP查询构造
- 特殊字符注入
- 身份验证绕过

##### nosql-injection.yml
**功能**：NoSQL注入检测
**检测内容**：
- MongoDB注入
- Redis命令注入
- 其他NoSQL注入

#### 3.2 认证授权类（4个）
[x]
##### broken-authentication.yml
**功能**：认证绕过检测
**检测内容**：
- 会话管理缺陷
- 认证逻辑错误
- 弱会话标识

##### session-fixation.yml
**功能**：会话固定攻击检测
**检测内容**：
- 会话ID未更新
- 登录后未重新生成会话
- 会话劫持风险

##### privilege-escalation.yml
**功能**：权限提升检测
**检测内容**：
- 垂直权限提升
- 水平权限提升
- 访问控制绕过

##### jwt-vulnerabilities.yml
**功能**：JWT漏洞检测
**检测内容**：
- 算法混淆攻击
- 密钥泄露
- 令牌过期检查

#### 3.3 加密安全类（4个）

##### weak-crypto-algorithms.yml
**功能**：弱加密算法检测
**检测内容**：
- 过时加密算法使用
- 弱密钥长度
- 不安全的随机数

##### hardcoded-secrets.yml
**功能**：硬编码密钥检测
**检测内容**：
- 代码中硬编码密码
- API密钥泄露
- 私钥存储不当

##### insecure-random.yml
**功能**：不安全随机数检测
**检测内容**：
- 伪随机数生成器
- 可预测的随机数
- 加密用途的弱随机源

##### ssl-tls-misconfiguration.yml
**功能**：SSL/TLS配置错误检测
**检测内容**：
- 弱协议版本
- 弱密码套件
- 证书验证问题

#### 3.4 代码注入类（4个）

##### code-injection.yml
**功能**：代码注入检测
**检测内容**：
- eval()使用
- 动态代码执行
- 模板注入

##### deserialization-vulnerabilities.yml
**功能**：反序列化漏洞检测
**检测内容**：
- 不安全反序列化
- 对象注入攻击
- 远程代码执行

##### template-injection.yml
**功能**：模板注入检测
**检测内容**：
- 服务端模板注入
- 客户端模板注入
- 模板引擎安全配置

#### 3.5 配置安全类（4个）

##### cors-misconfiguration.yml
**功能**：CORS配置错误检测
**检测内容**：
- 过于宽松的CORS策略
- 通配符使用不当
- 凭据传输风险

##### csrf-protection.yml
**功能**：CSRF保护缺失检测
**检测内容**：
- 缺少CSRF令牌
- 验证机制缺陷
- 状态改变操作风险

##### security-headers.yml
**功能**：安全头缺失检测
**检测内容**：
- 缺少X-Frame-Options
- 缺少Content-Security-Policy
- 缺少X-Content-Type-Options

##### clickjacking.yml
**功能**：点击劫持防护检测
**检测内容**：
- 缺少frame busting
- X-Frame-Options配置
- 客户端防护机制

#### 3.6 业务逻辑类（6个）

##### business-logic-flaws.yml
**功能**：业务逻辑漏洞检测
**检测内容**：
- 竞态条件
- 时序攻击
- 业务规则绕过

##### mass-assignment.yml
**功能**：批量赋值漏洞检测
**检测内容**：
- 未过滤的属性赋值
- 敏感字段暴露
- 对象属性控制

##### insecure-direct-object.yml
**功能**：不安全直接对象引用检测
**检测内容**：
- 直接对象访问
- 缺少访问控制
- ID枚举攻击

##### timing-attack.yml
**功能**：时序攻击检测
**检测内容**：
- 密码比较时序
- 用户枚举时序
- 敏感操作时序

## 实施计划

### 第1周：核心安全规则
**优先级：高**
- [ ] 输入验证类规则（4个）
- [ ] 基础数据流规则（3个）
- [ ] 控制流核心规则（4个）

### 第1.5周：认证授权
**优先级：中**
- [ ] 认证授权类规则（4个）
- [ ] 加密安全类规则（4个）
- [ ] 高级数据流规则（2个）

### 第2周：高级特性
**优先级：低**
- [ ] 代码注入类规则（4个）
- [ ] 配置安全类规则（4个）
- [ ] 业务逻辑类规则（6个）
- [ ] 控制流高级规则（4个）

## 测试策略

### 测试用例结构
```
test/enhanced-rules/
├── vulnerable-examples/
│   ├── sql-injection-vuln.js
│   ├── xss-vuln.py
│   └── path-traversal-vuln.java
├── secure-examples/
│   ├── sql-injection-secure.js
│   ├── xss-secure.py
│   └── path-traversal-secure.java
└── rule-tests/
    ├── test-sql-injection.js
n    ├── test-xss-detection.js
    └── test-cross-function-taint.js
```

### 验证方法
```bash
# 测试单个规则
semgrep --config=enhanced-rules/security/sql-injection.yml test/

# 批量测试所有规则
semgrep --config=enhanced-rules test/

# 生成测试报告
semgrep --config=enhanced-rules --json test/ > test-results.json
```

## 覆盖率目标

| 类别 | 当前数量 | 目标数量 | 覆盖率 |
|------|----------|----------|--------|
| 控制流规则 | 1 | 8 | 100% |
| 数据流规则 | 1 | 6 | 500% |
| 安全规则 | 2 | 26 | 1200% |
| **总计** | **4** | **40** | **900%** |

## 维护指南

### 规则更新流程
1. **需求分析**：根据新漏洞类型或语言特性
2. **规则设计**：编写YAML规则文件
3. **测试验证**：使用测试用例验证
4. **文档更新**：更新本指南文档
5. **版本发布**：标记版本和变更记录

### 性能优化
- 使用`pattern-either`减少重复规则
- 合理使用`metavariable-pattern`提高精度
- 定期清理无效或过时的规则

### 多语言支持
- JavaScript/TypeScript：完整支持
- Python：完整支持
- Java：完整支持
- Go：完整支持
- C#：完整支持
- Ruby：基础支持
- PHP：基础支持

## 相关文档
- [Semgrep集成指南](./semgrep-integration-guide.md)
- [静态分析使用指南](./static-analysis-usage.md)
- [CodeQL替代实施计划](./plan/codeql-replacement-implementation-plan.md)

---

*最后更新：2024年*
*版本：v1.0*