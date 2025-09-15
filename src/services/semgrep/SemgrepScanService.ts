import { inject, injectable } from 'inversify';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { TYPES } from '../../types';
import { LoggerService } from '../../core/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import {
  SemgrepScanResult,
  SemgrepScanOptions,
  SemgrepFinding,
  SemgrepRule,
  ValidationResult,
} from '../../models/StaticAnalysisTypes';

// 使用统一的接口定义
export interface ISemgrepScanService {
  scanProject(projectPath: string, options?: SemgrepScanOptions): Promise<SemgrepScanResult>;
  addCustomRule(rule: SemgrepRule): Promise<void>;
  getAvailableRules(): Promise<SemgrepRule[]>;
  validateRule(rule: SemgrepRule): Promise<ValidationResult>;
  isSemgrepAvailable(): Promise<boolean>;
}

@injectable()
export class SemgrepScanService implements ISemgrepScanService {
  private semgrepPath: string;
  private rulesDir: string;

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ConfigService) private configService: ConfigService
  ) {
    const semgrepConfig = this.configService.get('semgrep');
    this.semgrepPath = semgrepConfig.binaryPath || 'semgrep';
    this.rulesDir = semgrepConfig.customRulesPath || './config/semgrep-rules';
  }

  async scanProject(
    projectPath: string,
    options: SemgrepScanOptions = {}
  ): Promise<SemgrepScanResult> {
    const startTime = Date.now();
    this.logger.info(`Starting Semgrep scan for project: ${projectPath}`);

    try {
      // 验证Semgrep可用性
      if (!(await this.isSemgrepAvailable())) {
        throw new Error('Semgrep CLI is not available. Please install Semgrep first.');
      }

      // 构建命令参数
      const args = this.buildScanArgs(projectPath, options);

      // 执行扫描
      const result = await this.executeSemgrep(args);

      const scanResult: SemgrepScanResult = {
        id: `scan-${Date.now()}`,
        projectPath,
        scanTime: new Date(),
        duration: Date.now() - startTime,
        summary: {
          totalFiles: result.stats?.totalFiles || 0,
          totalFindings: (result.findings || []).length,
          errorCount: (result.errors || []).length,
          rulesRun: 0,
          targetBytes: 0,
          timing: {
            totalTime: Date.now() - startTime,
            configTime: 0,
            coreTime: 0,
            parsingTime: 0,
            matchingTime: 0,
            ruleParseTime: 0,
            fileParseTime: 0,
          },
        },
        findings: result.findings || [],
        errors: result.errors || [],
        metadata: {
          semgrepVersion: '',
          configHash: '',
          projectHash: '',
        },
      };

      this.logger.info(`Semgrep scan completed for ${projectPath} in ${scanResult.duration}ms`);
      return scanResult;
    } catch (error) {
      this.logger.error(`Semgrep scan failed for ${projectPath}:`, error);
      throw error;
    }
  }

  async addCustomRule(rule: SemgrepRule): Promise<void> {
    try {
      const rulePath = path.join(this.rulesDir, `${rule.id}.yaml`);
      const ruleContent = this.generateRuleYaml(rule);

      await fs.mkdir(path.dirname(rulePath), { recursive: true });
      await fs.writeFile(rulePath, ruleContent, 'utf-8');

      this.logger.info(`Added custom Semgrep rule: ${rule.id}`);
    } catch (error) {
      this.logger.error('Failed to add custom rule:', error);
      throw error;
    }
  }

  async getAvailableRules(): Promise<SemgrepRule[]> {
    try {
      const rules: SemgrepRule[] = [];

      // 检查规则目录是否存在
      try {
        await fs.access(this.rulesDir);
      } catch {
        return rules;
      }

      const files = await fs.readdir(this.rulesDir, { recursive: true });

      for (const file of files) {
        if (file.toString().endsWith('.yaml') || file.toString().endsWith('.yml')) {
          const filePath = path.join(this.rulesDir, file.toString());
          const content = await fs.readFile(filePath, 'utf-8');

          // 解析YAML文件并提取规则信息
          const rule = this.parseRuleFromYaml(content);
          if (rule) {
            rules.push(rule);
          }
        }
      }

      return rules;
    } catch (error) {
      this.logger.error('Failed to get available rules:', error);
      return [];
    }
  }

  async validateRule(rule: SemgrepRule): Promise<ValidationResult> {
    try {
      const tempRulePath = path.join(this.rulesDir, 'temp', `${rule.id}.yaml`);
      await fs.mkdir(path.dirname(tempRulePath), { recursive: true });

      const ruleContent = this.generateRuleYaml(rule);
      await fs.writeFile(tempRulePath, ruleContent, 'utf-8');

      // 使用Semgrep验证规则
      const args = ['--validate', '--config', tempRulePath, '.'];
      const result = await this.executeSemgrep(args, process.cwd());

      // 清理临时文件
      await fs.unlink(tempRulePath);

      return {
        valid: result.errors.length === 0,
        errors: result.errors,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  async isSemgrepAvailable(): Promise<boolean> {
    try {
      const result = await this.executeCommand(this.semgrepPath, ['--version']);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  private buildScanArgs(projectPath: string, options: SemgrepScanOptions): string[] {
    const args = ['scan', '--json', '--quiet', '--error'];

    // 添加规则
    if (options.rules && options.rules.length > 0) {
      for (const rule of options.rules) {
        args.push('--config', rule);
      }
    } else {
      args.push('--config', this.rulesDir);
    }

    // 添加严重性过滤
    if (options.severity && options.severity.length > 0) {
      for (const severity of options.severity) {
        args.push('--severity', severity);
      }
    }

    // 添加超时
    if (options.timeout) {
      args.push('--timeout', options.timeout.toString());
    }

    // 添加最大文件大小限制
    const semgrepConfig = this.configService.get('semgrep');
    const maxTargetBytes = options.maxTargetBytes || semgrepConfig.maxTargetBytes || 1000000;
    args.push('--max-target-bytes', String(maxTargetBytes));

    // 添加项目路径
    args.push(projectPath);

    return args;
  }

  private async executeSemgrep(args: string[], cwd?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.semgrepPath, args, {
        cwd: cwd || process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', data => {
        stdout += data.toString();
      });

      child.stderr.on('data', data => {
        stderr += data.toString();
      });

      child.on('close', exitCode => {
        try {
          if (stdout.trim()) {
            const result = JSON.parse(stdout);
            resolve({
              ...result,
              errors: result.errors || [],
              exitCode: exitCode || 0,
            });
          } else {
            resolve({
              findings: [],
              errors: stderr ? [stderr] : [],
              exitCode: exitCode || 0,
            });
          }
        } catch (error) {
          reject(
            new Error(
              `Failed to parse Semgrep output: ${error instanceof Error ? error.message : String(error)}`
            )
          );
        }
      });

      child.on('error', error => {
        reject(new Error(`Failed to execute Semgrep: ${error.message}`));
      });
    });
  }

  private async executeCommand(
    command: string,
    args: string[]
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', data => {
        stdout += data.toString();
      });

      child.stderr.on('data', data => {
        stderr += data.toString();
      });

      child.on('close', exitCode => {
        resolve({ exitCode: exitCode || 0, stdout, stderr });
      });

      child.on('error', error => {
        reject(error);
      });
    });
  }

  private generateRuleYaml(rule: SemgrepRule): string {
    return `
rules:
  - id: ${rule.id}
    message: ${rule.message}
    severity: ${rule.severity.toLowerCase()}
    languages:
${rule.languages.map(lang => `      - ${lang}`).join('\n')}
    pattern: |
      ${rule.pattern || ''}
${
  rule.metadata
    ? `
    metadata:
${Object.entries(rule.metadata)
  .map(([key, value]) => `      ${key}: ${value}`)
  .join('\n')}
`
    : ''
}
`;
  }

  private parseRuleFromYaml(content: string): SemgrepRule | null {
    try {
      // 简单的YAML解析，实际项目中应使用专门的YAML解析库
      const ruleMatch = content.match(/- id:\s*(\w+)/);
      const messageMatch = content.match(/message:\s*(.+)/);
      const severityMatch = content.match(/severity:\s*(\w+)/);
      const languagesMatch = content.match(/languages:([\s\S]*?)(?=\n\s*\w+:|$)/);
      const patternMatch = content.match(/pattern:\s*\|([\s\S]*?)(?=\n\s*\w+:|$)/);

      if (!ruleMatch || !messageMatch || !severityMatch || !languagesMatch || !patternMatch) {
        return null;
      }

      return {
        id: ruleMatch[1],
        message: messageMatch[1].trim(),
        severity: severityMatch[1].toUpperCase() as 'ERROR' | 'WARNING' | 'INFO',
        languages: languagesMatch[1]
          .trim()
          .split('\n')
          .map(l => l.trim().replace('- ', '')),
        pattern: patternMatch[1].trim(),
        metadata: {},
        fix: '',
        options: {},
      };
    } catch {
      return null;
    }
  }
}
