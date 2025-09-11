该项目是一个TypeScript项目，用于为llm提供MCP形式的代码库索引，同时支持用户直接通过该项目高效检索代码库信息

该项目中请使用tsc --noEmit检查是否有类型错误

更新代码后进行下一阶段前先使用tsc --noEmit检查是否有类型错误，修复编译错误后再继续下一阶段

**semgrep**
- `semgrep --validate --config=<规则路径>` - 验证 semgrep 规则配置
- `semgrep --config=<规则路径> <目标路径>` - 对目标文件运行 semgrep 规则
**注意**：添加新 semgrep 规则时，请务必使用上述验证和测试命令检查规则有效性。
**警告**：在Windows系统中，Semgrep可能无法正确处理包含非ASCII字符的文件。若遇到编码错误，请确保规则文件以UTF-8格式保存，并考虑将消息部分中的非英文文本转换为英文。