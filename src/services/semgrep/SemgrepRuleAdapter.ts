import { inject, injectable } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../core/LoggerService';
import {
  SemgrepRule,
  ValidationResult
} from '../../models/StaticAnalysisTypes';

/**
 * Semgrep规则转换适配器
 * 负责将内部规则格式转换为Semgrep支持的格式
 */
@injectable()
export class SemgrepRuleAdapter {
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {}

  /**
   * 将内部规则转换为Semgrep规则格式
   */
  adaptInternalRule(internalRule: any): SemgrepRule {
    return {
      id: internalRule.id || this.generateRuleId(internalRule),
      message: internalRule.description || internalRule.message || internalRule.name || internalRule.title,
      severity: this.mapSeverity(internalRule.severity),
      languages: this.mapLanguages(internalRule.languages || internalRule.language),
      pattern: this.buildPattern(internalRule),
      patterns: [],
      patternEither: [],
      patternInside: '',
      patternNot: '',
      metadata: {
        ...internalRule.metadata,
        source: internalRule.source || 'internal',
        category: internalRule.category || 'security',
        createdAt: new Date().toISOString(),
      },
      fix: '',
      options: {}
    };
  }

  /**
   * 从常见格式转换规则
   */
  adaptFromCommonFormat(source: 'eslint' | 'sonarqube' | 'custom', ruleData: any): SemgrepRule {
    switch (source) {
      case 'eslint':
        return this.adaptESLintRule(ruleData);
      case 'sonarqube':
        return this.adaptSonarQubeRule(ruleData);
      case 'custom':
        return this.adaptCustomRule(ruleData);
      default:
        throw new Error(`Unsupported rule source: ${source}`);
    }
  }

  /**
   * 批量转换规则
   */
  adaptRulesBatch(rules: any[], source: string = 'internal'): SemgrepRule[] {
    return rules.map(rule => {
      try {
        return this.adaptFromCommonFormat(source as any, rule);
      } catch (error) {
        this.logger.warn(`Failed to adapt rule ${rule.id || rule.name}:`, error);
        return null;
      }
    }).filter(Boolean) as SemgrepRule[];
  }

  /**
   * 验证规则格式
   */
  validateRuleFormat(rule: SemgrepRule): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!rule.id || rule.id.trim().length === 0) {
      errors.push('Rule ID is required');
    }

    if (!rule.message || rule.message.trim().length === 0) {
      errors.push('Rule message is required');
    }

    if (!rule.pattern || rule.pattern.trim().length === 0) {
      errors.push('Rule pattern is required');
    }

    if (!rule.languages || rule.languages.length === 0) {
      errors.push('At least one language must be specified');
    }

    if (!['ERROR', 'WARNING', 'INFO'].includes(rule.severity)) {
      errors.push('Severity must be ERROR, WARNING, or INFO');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 生成复合规则（多个模式组合）
   */
  buildCompositeRule(baseRule: SemgrepRule, additionalPatterns: string[]): SemgrepRule {
    const compositePattern = additionalPatterns.reduce((acc, pattern, index) => {
      return `${acc}\n    pattern-${index + 2}: |
      ${pattern}`;
    }, baseRule.pattern);

    return {
      ...baseRule,
      id: `${baseRule.id}_composite`,
      pattern: compositePattern,
      metadata: {
        ...baseRule.metadata,
        composite: true,
        patterns: additionalPatterns.length + 1,
      },
    };
  }

  /**
   * 创建通用安全规则模板
   */
  createSecurityRuleTemplates(): SemgrepRule[] {
    return [
      {
        id: 'sql-injection',
        message: 'Detect potential SQL injection vulnerabilities',
        severity: 'ERROR',
        languages: ['javascript', 'typescript', 'python', 'java'],
        pattern: '...',
        patterns: [],
        patternEither: [],
        patternInside: '',
        patternNot: '',
        metadata: {
          category: 'security',
          cwe: ['CWE-89'],
          owasp: ['A03:2021'],
        },
        fix: '',
        options: {}
      },
      {
        id: 'xss-reflected',
        message: 'Detect reflected XSS vulnerabilities',
        severity: 'ERROR',
        languages: ['javascript', 'typescript', 'html'],
        pattern: '...',
        patterns: [],
        patternEither: [],
        patternInside: '',
        patternNot: '',
        metadata: {
          category: 'security',
          cwe: ['CWE-79'],
          owasp: ['A03:2021'],
        },
        fix: '',
        options: {}
      },
      {
        id: 'hardcoded-secret',
        message: 'Detect hardcoded secrets in code',
        severity: 'ERROR',
        languages: ['javascript', 'typescript', 'python', 'java', 'go'],
        pattern: '...',
        patterns: [],
        patternEither: [],
        patternInside: '',
        patternNot: '',
        metadata: {
          category: 'security',
          cwe: ['CWE-798'],
        },
        fix: '',
        options: {}
      },
      {
        id: 'insecure-deserialization',
        message: 'Detect insecure deserialization patterns',
        severity: 'WARNING',
        languages: ['javascript', 'typescript', 'python', 'java'],
        pattern: '...',
        patterns: [],
        patternEither: [],
        patternInside: '',
        patternNot: '',
        metadata: {
          category: 'security',
          cwe: ['CWE-502'],
          owasp: ['A08:2021'],
        },
        fix: '',
        options: {}
      },
    ];
  }

  private generateRuleId(rule: any): string {
    const name = rule.name || rule.title || 'unnamed-rule';
    const timestamp = Date.now().toString(36);
    return `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${timestamp}`;
  }

  private mapSeverity(severity: string): 'ERROR' | 'WARNING' | 'INFO' {
    const severityMap: Record<string, 'ERROR' | 'WARNING' | 'INFO'> = {
      'error': 'ERROR',
      'high': 'ERROR',
      'critical': 'ERROR',
      'warning': 'WARNING',
      'medium': 'WARNING',
      'info': 'INFO',
      'low': 'INFO',
    };

    return severityMap[severity?.toLowerCase()] || 'WARNING';
  }

  private mapLanguages(languages: string | string[]): string[] {
    if (typeof languages === 'string') {
      languages = [languages];
    }

    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'java': 'java',
      'go': 'go',
      'rb': 'ruby',
      'php': 'php',
      'cs': 'csharp',
      'cpp': 'cpp',
      'c': 'c',
    };

    return languages.map(lang => languageMap[lang.toLowerCase()] || lang.toLowerCase());
  }

  private buildPattern(internalRule: any): string {
    if (internalRule.pattern) {
      return internalRule.pattern;
    }

    if (internalRule.regex) {
      return `pattern-regex: ${internalRule.regex}`;
    }

    if (internalRule.astPattern) {
      return internalRule.astPattern;
    }

    // 根据规则类型生成默认模式
    switch (internalRule.type) {
      case 'function-call':
        return `${internalRule.functionName}(...)`;
      case 'variable-assignment':
        return `${internalRule.variableName} = ${internalRule.valuePattern}`;
      case 'import':
        return `import ${internalRule.moduleName}`;
      default:
        return '...'; // 通配符模式
    }
  }

  private adaptESLintRule(eslintRule: any): SemgrepRule {
    return {
      id: `eslint-${eslintRule.name}`,
      message: eslintRule.description || eslintRule.message,
      severity: this.mapSeverity(eslintRule.severity || 'warning'),
      languages: this.mapLanguages(eslintRule.language || 'javascript'),
      pattern: eslintRule.pattern || eslintRule.schema || '...',
      patterns: [],
      patternEither: [],
      patternInside: '',
      patternNot: '',
      metadata: {
        source: 'eslint',
        originalRule: eslintRule,
      },
      fix: '',
      options: {}
    };
  }

  private adaptSonarQubeRule(sonarRule: any): SemgrepRule {
    return {
      id: `sonar-${sonarRule.key}`,
      message: sonarRule.description || sonarRule.htmlDesc,
      severity: this.mapSeverity(sonarRule.severity || 'major'),
      languages: this.mapLanguages(sonarRule.lang || 'javascript'),
      pattern: sonarRule.pattern || '...',
      patterns: [],
      patternEither: [],
      patternInside: '',
      patternNot: '',
      metadata: {
        source: 'sonarqube',
        originalKey: sonarRule.key,
        type: sonarRule.type,
      },
      fix: '',
      options: {}
    };
  }

  private adaptCustomRule(customRule: any): SemgrepRule {
    return {
      id: customRule.id,
      message: customRule.description,
      severity: customRule.severity || 'WARNING',
      languages: Array.isArray(customRule.languages) ? customRule.languages : [customRule.language],
      pattern: customRule.pattern,
      patterns: [],
      patternEither: [],
      patternInside: '',
      patternNot: '',
      metadata: {
        ...customRule.metadata,
        source: 'custom',
      },
      fix: '',
      options: {}
    };
  }
}