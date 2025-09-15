import { SnippetChunk } from '../services/parser/types';

export interface CustomRuleDefinition {
  name: string;
  description: string;
  targetType: string;
  pattern: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

export interface RuleCondition {
  type: 'nodeType' | 'contentPattern' | 'complexity' | 'languageFeature';
  value: string;
  operator: 'equals' | 'contains' | 'matches' | 'greaterThan' | 'lessThan';
}

export interface RuleAction {
  type: 'extract' | 'highlight' | 'report';
  parameters: Record<string, any>;
}

export interface CustomRule extends CustomRuleDefinition {
  id: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  author: string;
  enabled: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CompiledRule {
  id: string;
  name: string;
  description: string;
  targetType: string;
  conditionEvaluator: (node: any, sourceCode: string) => boolean;
  actionExecutor: (node: any, sourceCode: string) => SnippetChunk | null;
}
