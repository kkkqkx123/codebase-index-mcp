# CodeQL 部署方案

## 1. 系统要求

根据官方文档，CodeQL 支持以下操作系统：

- **Linux**: Ubuntu 22.04/24.04
- **Windows**: Windows 10/11 及对应的 Server 版本
- **macOS**: macOS 13-15 (x86-64)，arm64 beta 版本

## 2. 安装步骤

### 2.1 下载 CodeQL CLI

CodeQL CLI 可以从 GitHub 的官方发布页面下载：

1. 访问 [CodeQL CLI 发布页面](https://github.com/github/codeql-cli-binaries/releases)
2. 选择最新的版本（例如 v2.22.4）
3. 根据你的操作系统选择合适的下载包：
   - `codeql-PLATFORM.zip`：平台专用包
   - `codeql.zip`：包含所有平台二进制文件的通用包
   
   注意：请忽略页面上额外的 "source code" 下载链接。

### 2.2 安装 CodeQL CLI

1. 下载完成后，解压 ZIP 文件到你选择的目录，例如：
   - Linux/macOS: `/opt/codeql` 或 `~/codeql`
   - Windows: `C:\Program Files\CodeQL` 或 `C:\Users\[用户名]\codeql`
   
2. 将 CodeQL 可执行文件的路径添加到系统的 PATH 环境变量中：
   - Linux/macOS: 添加 `export PATH=$PATH:/path/to/codeql` 到你的 shell 配置文件（如 `.bashrc` 或 `.zshrc`）
   - Windows: 在系统环境变量中添加 CodeQL 路径
   
3. 验证安装：
   ```bash
   codeql version
   ```
   
   如果安装成功，该命令将显示 CodeQL CLI 的版本号。

### 2.3 配置 CodeQL

CodeQL CLI 会自动下载所需的语言包。你也可以手动安装特定版本的语言包：

```bash
# 安装 CodeQL 包
codeql pack install
```

## 3. 基本使用

### 3.1 创建数据库

要分析代码库，首先需要创建 CodeQL 数据库：

```bash
# 为项目创建 CodeQL 数据库
codeql database create <database-name> --language=<language> --source-root=<source-root>
```

例如，为一个 JavaScript 项目创建数据库：

```bash
codeql database create my-js-project --language=javascript --source-root=/path/to/project
```

### 3.2 运行查询

创建数据库后，可以运行 CodeQL 查询来分析代码：

```bash
# 运行查询
codeql database analyze <database-name> <query-file> --format=<format> --output=<output-file>
```

例如，运行内置的 JavaScript 安全查询：

```bash
codeql database analyze my-js-project javascript-security-queries --format=sarif-latest --output=results.sarif
```

### 3.3 查看结果

分析完成后，可以查看生成的结果文件（如 SARIF 格式），或使用 CodeQL CLI 的其他命令来进一步处理结果。

## 4. 高级配置

### 4.1 环境变量

CodeQL CLI 支持多个环境变量来配置其行为：

- `CODEQL_ALLOW_INSTALLATION_ANYWHERE`：设置为 `true` 可以抑制在用户主目录或桌面安装时的警告
- `CODEQL_REGISTRIES_AUTH`：用于容器注册表的身份验证
- `GITHUB_TOKEN`：用于 GitHub API 调用的身份验证

### 4.2 缓存配置

CodeQL CLI 使用缓存来存储下载的 QL 包和编译的查询计划。可以通过 `--common-caches` 参数控制缓存位置：

```bash
codeql --common-caches=/path/to/cache/database analyze ...
```

## 5. 故障排除

1. 如果在 Windows 上遇到问题，请确保安装了最新版本的 CodeQL CLI，并检查 Windows 可执行文件属性中的版本信息是否正确。
2. 如果遇到内存不足问题，CodeQL CLI 应该以状态码 99 退出，而不是 34。
3. 如果在分析过程中遇到问题，请检查生成的日志文件以获取更多信息。

## 6. 参考资料

- [CodeQL 官方文档](https://codeql.github.com/docs/)
- [CodeQL CLI 发布页面](https://github.com/github/codeql-cli-binaries/releases)
- [CodeQL 仓库](https://github.com/github/codeql)