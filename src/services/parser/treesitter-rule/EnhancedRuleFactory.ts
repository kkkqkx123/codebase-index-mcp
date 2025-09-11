import { SnippetExtractionRule } from './SnippetExtractionRule';
import { ControlStructureRule } from './ControlStructureRule';
import { FunctionCallChainRule } from './FunctionCallChainRule';
import { ErrorHandlingRule } from './ErrorHandlingRule';
import { TemplateLiteralRule } from './TemplateLiteralRule';
import { DestructuringAssignmentRule } from './DestructuringAssignmentRule';
import { ObjectArrayLiteralRule } from './ObjectArrayLiteralRule';
import { ArithmeticLogicalRule } from './ArithmeticLogicalRule';
import { LogicBlockRule } from './LogicBlockRule';
import { ExpressionSequenceRule } from './ExpressionSequenceRule';
import { CommentMarkedRule } from './CommentMarkedRule';

// Modern features rules
import { AsyncPatternRule } from './modern-features/AsyncPatternRule';
import { DecoratorPatternRule } from './modern-features/DecoratorPatternRule';
import { GenericPatternRule } from './modern-features/GenericPatternRule';
import { FunctionalProgrammingRule } from './modern-features/FunctionalProgrammingRule';

// Language-specific rules
import { PythonComprehensionRule } from './languages/python/PythonComprehensionRule';

import { JavaStreamRule } from './languages/java/JavaStreamRule';
import { JavaLambdaRule } from './languages/java/JavaLambdaRule';
import { GoGoroutineRule } from './languages/go/GoGoroutineRule';
import { GoInterfaceRule } from './languages/go/GoInterfaceRule';

// Enhanced data flow rules
import { EnhancedDataFlowRule } from './enhanced-data-flow/EnhancedDataFlowRule';
import { ReactDataFlowRule } from './enhanced-data-flow/frameworks/ReactDataFlowRule';
import { DjangoDataFlowRule } from './enhanced-data-flow/frameworks/DjangoDataFlowRule';
import { SpringBootDataFlowRule } from './enhanced-data-flow/frameworks/SpringBootDataFlowRule';

/**
 * Enhanced Rule Factory - Creates and manages rules based on language and feature requirements
 */
export class EnhancedRuleFactory {
  
  /**
   * Creates a comprehensive set of rules for general code analysis
   */
  static createComprehensiveRules(): SnippetExtractionRule[] {
    return [
      // Core rules (enhanced)
      new ControlStructureRule(),
      new FunctionCallChainRule(),
      new ErrorHandlingRule(),
      
      // Modern language features
      new AsyncPatternRule(),
      new DecoratorPatternRule(),
      new GenericPatternRule(),
      new FunctionalProgrammingRule(),
      
      // Pattern-specific rules
      new TemplateLiteralRule(),
      new DestructuringAssignmentRule(),
      new ObjectArrayLiteralRule(),
      new ArithmeticLogicalRule(),
      new LogicBlockRule(),
      new ExpressionSequenceRule(),
      new CommentMarkedRule(),
      
      // Enhanced data flow rules
      new EnhancedDataFlowRule(),
      new ReactDataFlowRule(),
      new DjangoDataFlowRule(),
      new SpringBootDataFlowRule()
    ];
  }

  /**
   * Creates language-specific rules based on the detected programming language
   */
  static createLanguageSpecificRules(language: string): SnippetExtractionRule[] {
    const baseRules = this.createComprehensiveRules();
    const languageRules = this.getLanguageSpecificRules(language);
    
    return [...baseRules, ...languageRules];
  }

  /**
   * Gets language-specific rules for the given language
   */
  private static getLanguageSpecificRules(language: string): SnippetExtractionRule[] {
    switch (language.toLowerCase()) {
      case 'python':
        return [
          new PythonComprehensionRule(),
          new DjangoDataFlowRule()
        ];
      
      case 'java':
        return [
          new JavaStreamRule(),
          new JavaLambdaRule(),
          new SpringBootDataFlowRule()
        ];
      
      case 'go':
        return [
          new GoGoroutineRule(),
          new GoInterfaceRule()
        ];
      
      case 'typescript':
      case 'javascript':
        // JavaScript/TypeScript get all modern features by default plus React data flow
        return [
          new AsyncPatternRule(),
          new DecoratorPatternRule(),
          new GenericPatternRule(),
          new FunctionalProgrammingRule(),
          new ReactDataFlowRule()
        ];
      
      case 'csharp':
        // C# gets similar features to TypeScript
        return [
          new AsyncPatternRule(),
          new GenericPatternRule()
        ];
      
      case 'cpp':
        // C++ gets template and functional programming rules
        return [
          new GenericPatternRule(),
          new FunctionalProgrammingRule()
        ];
      
      default:
        return [];
    }
  }

  /**
   * Creates rules focused on specific aspects of code analysis
   */
  static createFocusedRules(focus: 'performance' | 'architecture' | 'patterns' | 'concurrency'): SnippetExtractionRule[] {
    switch (focus) {
      case 'performance':
        return [
          new AsyncPatternRule(),
          new FunctionCallChainRule(),
          new ControlStructureRule()
        ];
      
      case 'architecture':
        return [
          new DecoratorPatternRule(),
          new GenericPatternRule(),
          new ErrorHandlingRule()
        ];
      
      case 'patterns':
        return [
          new FunctionalProgrammingRule(),
          new TemplateLiteralRule(),
          new DestructuringAssignmentRule()
        ];
      
      case 'concurrency':
        return [
          new AsyncPatternRule(),
          new GoGoroutineRule(),
          new JavaStreamRule()
        ];
      
      default:
        return this.createComprehensiveRules();
    }
  }

  /**
   * Creates rules with specific complexity thresholds
   */
  static createRulesForComplexity(minComplexity: number, maxComplexity: number): SnippetExtractionRule[] {
    const baseRules = this.createComprehensiveRules();
    
    // Apply complexity filtering by creating rules with custom configurations
    return baseRules.map(rule => {
      // This would require modifying the rules to accept complexity parameters
      // For now, we return the base rules and let the complexity validation happen during extraction
      return rule;
    }).filter(rule => {
      // Filter rules based on their typical complexity
      const ruleComplexity = this.estimateRuleComplexity(rule);
      return ruleComplexity >= minComplexity && ruleComplexity <= maxComplexity;
    });
  }

  /**
   * Estimates the typical complexity of snippets extracted by a rule
   */
  private static estimateRuleComplexity(rule: SnippetExtractionRule): number {
    const complexityMap: Record<string, number> = {
      'ControlStructureRule': 5,
      'FunctionCallChainRule': 4,
      'ErrorHandlingRule': 3,
      'AsyncPatternRule': 7,
      'DecoratorPatternRule': 6,
      'GenericPatternRule': 8,
      'FunctionalProgrammingRule': 7,
      'PythonComprehensionRule': 4,
      'JavaStreamRule': 6,
      'JavaLambdaRule': 5,
      'GoGoroutineRule': 8,
      'GoInterfaceRule': 4,
      'TemplateLiteralRule': 2,
      'DestructuringAssignmentRule': 3,
      'ObjectArrayLiteralRule': 2,
      'ArithmeticLogicalRule': 2,
      'LogicBlockRule': 3,
      'ExpressionSequenceRule': 3,
      'CommentMarkedRule': 2
    };

    return complexityMap[rule.name] || 5;
  }

  /**
   * Creates rules optimized for specific frameworks or libraries
   */
  static createFrameworkSpecificRules(framework: string): SnippetExtractionRule[] {
    const baseRules = this.createComprehensiveRules();
    
    switch (framework.toLowerCase()) {
      case 'react':
      case 'vue':
      case 'angular':
        // Frontend frameworks benefit from React data flow analysis
        return [
          ...baseRules,
          new ReactDataFlowRule(),
          new AsyncPatternRule(),
          new DecoratorPatternRule(),
          new FunctionalProgrammingRule()
        ];
      
      case 'express':
      case 'fastapi':
      case 'spring':
      case 'spring-boot':
        // Backend frameworks benefit from framework-specific data flow
        return [
          ...baseRules,
          new SpringBootDataFlowRule(),
          new AsyncPatternRule(),
          new ErrorHandlingRule(),
          new DecoratorPatternRule()
        ];
      
      case 'django':
      case 'flask':
        // Python web frameworks with Django-specific data flow
        return [
          ...baseRules,
          new DjangoDataFlowRule(),
          new PythonComprehensionRule(),
          new AsyncPatternRule()
        ];
      
      default:
        return baseRules;
    }
  }

  /**
   * Gets rule statistics and information
   */
  static getRuleStatistics(): {
    totalRules: number;
    categories: Record<string, string[]>;
    languageSupport: Record<string, string[]>;
  } {
    const allRules = this.createComprehensiveRules();
    
    const categories: Record<string, string[]> = {
      'Core': ['ControlStructureRule', 'FunctionCallChainRule', 'ErrorHandlingRule'],
      'Modern Features': ['AsyncPatternRule', 'DecoratorPatternRule', 'GenericPatternRule', 'FunctionalProgrammingRule'],
      'Language Patterns': ['TemplateLiteralRule', 'DestructuringAssignmentRule', 'ObjectArrayLiteralRule', 'ArithmeticLogicalRule'],
      'Specialized': ['LogicBlockRule', 'ExpressionSequenceRule', 'CommentMarkedRule'],
      'Data Flow': ['EnhancedDataFlowRule', 'ReactDataFlowRule', 'DjangoDataFlowRule', 'SpringBootDataFlowRule']
    };

    const languageSupport: Record<string, string[]> = {
      'JavaScript/TypeScript': ['AsyncPatternRule', 'DecoratorPatternRule', 'GenericPatternRule', 'FunctionalProgrammingRule', 'ReactDataFlowRule'],
      'Python': ['PythonComprehensionRule', 'AsyncPatternRule', 'DjangoDataFlowRule'],
      'Java': ['JavaStreamRule', 'JavaLambdaRule', 'GenericPatternRule', 'SpringBootDataFlowRule'],
      'Go': ['GoGoroutineRule', 'GoInterfaceRule'],
      'C#': ['AsyncPatternRule', 'GenericPatternRule'],
      'C++': ['GenericPatternRule', 'FunctionalProgrammingRule']
    };

    return {
      totalRules: allRules.length,
      categories,
      languageSupport
    };
  }
}

export default EnhancedRuleFactory;