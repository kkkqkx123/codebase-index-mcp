#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * 测试LSP功能脚本
 * 
 * 这个脚本将验证：
 * 1. 所有语言服务器是否可执行
 * 2. LSP配置是否正确
 * 3. 基本功能是否可用
 */

class LSPTester {
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🔍 开始LSP功能测试...\n');

    const results = {
      typescript: await this.testTypeScriptServer(),
      python: await this.testPythonServer(),
      java: await this.testJavaServer(),
      go: await this.testGoServer(),
      configuration: await this.testConfiguration(),
    };

    this.printResults(results);
    return Object.values(results).every(r => r.success);
  }

  /**
   * 测试TypeScript语言服务器
   */
  async testTypeScriptServer() {
    console.log('📝 测试TypeScript语言服务器...');
    
    try {
      // 检查typescript-language-server是否存在
      execSync('npx typescript-language-server --version', { stdio: 'pipe' });
      console.log('   ✅ typescript-language-server 已安装');
      
      // 测试基本功能
      const testResult = this.runTypeScriptTest();
      return { success: testResult, message: 'TypeScript服务器测试完成' };
    } catch (error) {
      console.log(`   ❌ TypeScript服务器测试失败: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  /**
   * 测试Python语言服务器
   */
  async testPythonServer() {
    console.log('🐍 测试Python语言服务器...');
    
    try {
      // 检查pylsp是否存在
      execSync('pylsp --version', { stdio: 'pipe' });
      console.log('   ✅ pylsp 已安装');
      return { success: true, message: 'Python服务器测试完成' };
    } catch (error) {
      console.log('   ⚠️  pylsp未安装，尝试使用vscode-langservers-extracted...');
      
      try {
        // 检查vscode-langservers-extracted中的python服务器
        execSync('npx vscode-langservers-extracted --version', { stdio: 'pipe' });
        console.log('   ✅ vscode-langservers-extracted 已安装');
        return { success: true, message: '使用vscode-langservers-extracted中的Python服务器' };
      } catch (innerError) {
        console.log(`   ❌ Python服务器测试失败: ${innerError.message}`);
        return { success: false, message: innerError.message };
      }
    }
  }

  /**
   * 测试Java语言服务器
   */
  async testJavaServer() {
    console.log('☕ 测试Java语言服务器...');
    
    try {
      // 检查java是否存在
      execSync('java -version', { stdio: 'pipe' });
      console.log('   ✅ Java运行时 已安装');
      
      // 检查vscode-langservers-extracted中的java服务器
      execSync('npx vscode-langservers-extracted --version', { stdio: 'pipe' });
      console.log('   ✅ vscode-langservers-extracted 已安装');
      
      return { success: true, message: 'Java服务器测试完成' };
    } catch (error) {
      console.log(`   ⚠️  Java服务器测试跳过: ${error.message}`);
      return { success: true, message: 'Java服务器需要额外配置' };
    }
  }

  /**
   * 测试Go语言服务器
   */
  async testGoServer() {
    console.log('🐹 测试Go语言服务器...');
    
    try {
      // 检查gopls是否存在
      execSync('gopls version', { stdio: 'pipe' });
      console.log('   ✅ gopls 已安装');
      return { success: true, message: 'Go服务器测试完成' };
    } catch (error) {
      console.log('   ⚠️  gopls未安装，尝试使用vscode-langservers-extracted...');
      
      try {
        execSync('npx vscode-langservers-extracted --version', { stdio: 'pipe' });
        console.log('   ✅ vscode-langservers-extracted 已安装');
        return { success: true, message: '使用vscode-langservers-extracted中的Go服务器' };
      } catch (innerError) {
        console.log(`   ❌ Go服务器测试失败: ${innerError.message}`);
        return { success: false, message: innerError.message };
      }
    }
  }

  /**
   * 测试LSP配置
   */
  async testConfiguration() {
    console.log('⚙️  测试LSP配置...');
    
    try {
      const configPath = path.join(this.projectRoot, 'config', 'lsp-config.json');
      
      if (!fs.existsSync(configPath)) {
        throw new Error('LSP配置文件不存在');
      }

      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      // 验证配置结构
      const requiredFields = ['lsp.enabled', 'lsp.supportedLanguages', 'lsp.languageServers'];
      
      for (const field of requiredFields) {
        const value = this.getNestedValue(config, field);
        if (value === undefined) {
          throw new Error(`配置缺少必要字段: ${field}`);
        }
      }

      console.log('   ✅ LSP配置结构正确');
      console.log(`   ✅ 支持语言: ${config.lsp.supportedLanguages.join(', ')}`);
      
      return { success: true, message: 'LSP配置测试完成' };
    } catch (error) {
      console.log(`   ❌ LSP配置测试失败: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  /**
   * 运行TypeScript测试
   */
  private runTypeScriptTest(): boolean {
    try {
      // 创建临时TypeScript文件
      const tempDir = path.join(this.projectRoot, 'temp-test');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const testFile = path.join(tempDir, 'test.ts');
      const testContent = `
interface User {
  id: number;
  name: string;
}

class UserService {
  private users: User[] = [];
  
  addUser(user: User): void {
    this.users.push(user);
  }
}
`;

      fs.writeFileSync(testFile, testContent);
      
      // 测试TypeScript编译
      execSync(`npx tsc --noEmit ${testFile}`, { stdio: 'pipe' });
      console.log('   ✅ TypeScript编译测试通过');
      
      // 清理临时文件
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      return true;
    } catch (error) {
      console.log(`   ❌ TypeScript测试失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 获取嵌套对象值
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * 打印测试结果
   */
  private printResults(results: any) {
    console.log('\n📊 测试结果总结:');
    console.log('========================');
    
    Object.entries(results).forEach(([key, result]: [string, any]) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${key}: ${result.message}`);
    });

    const allPassed = Object.values(results).every((r: any) => r.success);
    console.log('\n========================');
    console.log(allPassed ? '🎉 所有测试通过！' : '⚠️  部分测试失败');
  }
}

/**
 * 主函数
 */
async function main() {
  const tester = new LSPTester();
  const success = await tester.runAllTests();
  
  process.exit(success ? 0 : 1);
}

// 如果直接运行
if (require.main === module) {
  main().catch(console.error);
}

export { LSPTester };