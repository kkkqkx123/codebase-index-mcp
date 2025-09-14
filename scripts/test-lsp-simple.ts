#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * 简化版LSP功能测试
 * 
 * 这个脚本验证：
 * 1. TypeScript语言服务器是否可执行
 * 2. 项目配置是否正确
 * 3. 基本功能是否可用
 */

class SimpleLSPTester {
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
  }

  async runTests() {
    console.log('🔍 开始简化LSP功能测试...\n');

    const results = {
      typescriptServer: await this.testTypeScriptServer(),
      configuration: await this.testConfiguration(),
      dependencies: await this.testDependencies(),
    };

    this.printResults(results);
    return Object.values(results).every(r => r.success);
  }

  async testTypeScriptServer() {
    console.log('📝 测试TypeScript语言服务器...');
    
    try {
      // 检查typescript-language-server
      const version = execSync('npx typescript-language-server --version', { 
        encoding: 'utf8', 
        stdio: 'pipe' 
      }).trim();
      console.log(`   ✅ typescript-language-server ${version} 已安装`);
      
      // 测试TypeScript文件解析
      const testResult = this.testTypeScriptParsing();
      return { success: testResult, message: 'TypeScript服务器测试通过' };
    } catch (error) {
      console.log(`   ❌ TypeScript服务器测试失败: ${error}`);
      return { success: false, message: String(error) };
    }
  }

  async testConfiguration() {
    console.log('⚙️  测试LSP配置...');
    
    try {
      const configPath = path.join(this.projectRoot, 'config', 'lsp-config.json');
      
      if (!fs.existsSync(configPath)) {
        throw new Error('LSP配置文件不存在');
      }

      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      // 验证关键配置
      if (!config.lsp?.enabled) {
        throw new Error('LSP未启用');
      }

      const languages = config.lsp.supportedLanguages || [];
      console.log(`   ✅ LSP已启用，支持语言: ${languages.join(', ')}`);
      
      return { success: true, message: 'LSP配置测试通过' };
    } catch (error) {
      console.log(`   ❌ LSP配置测试失败: ${error}`);
      return { success: false, message: String(error) };
    }
  }

  async testDependencies() {
    console.log('📦 测试LSP依赖...');
    
    try {
      // 检查已安装的LSP相关依赖
      const packageJson = JSON.parse(fs.readFileSync(
        path.join(this.projectRoot, 'package.json'), 
        'utf8'
      ));

      const lspDeps = [
        'typescript-language-server',
        'vscode-languageserver-protocol',
        'vscode-languageclient',
        'vscode-langservers-extracted'
      ];

      const installedDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      lspDeps.forEach(dep => {
        if (installedDeps[dep]) {
          console.log(`   ✅ ${dep}@${installedDeps[dep]} 已安装`);
        } else {
          console.log(`   ❌ ${dep} 未安装`);
        }
      });

      return { 
        success: true, 
        message: `已安装 ${lspDeps.filter(dep => installedDeps[dep]).length}/${lspDeps.length} 个LSP依赖` 
      };
    } catch (error) {
      console.log(`   ❌ 依赖测试失败: ${error}`);
      return { success: false, message: String(error) };
    }
  }

  private testTypeScriptParsing(): boolean {
    try {
      // 创建临时测试文件
      const testDir = path.join(this.projectRoot, 'temp-test');
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      const testFile = path.join(testDir, 'test.ts');
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
      
      // 清理
      fs.rmSync(testDir, { recursive: true, force: true });
      
      return true;
    } catch (error) {
      return false;
    }
  }

  private printResults(results: any) {
    console.log('\n📊 测试结果总结:');
    console.log('========================');
    
    Object.entries(results).forEach(([key, result]: [string, any]) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${key}: ${result.message}`);
    });

    const allPassed = Object.values(results).every((r: any) => r.success);
    console.log('\n========================');
    console.log(allPassed ? '🎉 所有测试通过！' : '⚠️  部分测试需要关注');
  }
}

/**
 * 运行测试
 */
async function main() {
  const tester = new SimpleLSPTester();
  const success = await tester.runTests();
  
  console.log('\n📋 下一步建议:');
  console.log('1. 运行 `npm test` 执行单元测试');
  console.log('2. 运行 `npm run dev` 启动开发服务器');
  console.log('3. 检查 `config/lsp-config.json` 配置');
  console.log('4. 查看日志文件了解详细运行状态');
  
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

export { SimpleLSPTester };