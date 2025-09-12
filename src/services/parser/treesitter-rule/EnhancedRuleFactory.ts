import { SnippetExtractionRule } from './SnippetExtractionRule';
import { ControlStructureRule } from './ControlStructureRule';
import { ErrorHandlingRule } from './ErrorHandlingRule';
import { FunctionCallChainRule } from './FunctionCallChainRule';
import { CommentMarkedRule } from './CommentMarkedRule';
import { LogicBlockRule } from './LogicBlockRule';
import { ExpressionSequenceRule } from './ExpressionSequenceRule';
import { ObjectArrayLiteralRule } from './ObjectArrayLiteralRule';
import { ArithmeticLogicalRule } from './ArithmeticLogicalRule';
import { TemplateLiteralRule } from './TemplateLiteralRule';
import { DestructuringAssignmentRule } from './DestructuringAssignmentRule';

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

// Framework rules
import { ReactRule } from './languages/ts/frameworks/ReactRule';
import { DjangoRule } from './languages/python/frameworks/DjangoRule';
import { SpringBootRule } from './languages/java/frameworks/SpringBootRule';
import { PyTorchRule } from './languages/python/frameworks/PyTorchRule';

/**
 * Enhanced Rule Factory - Creates and manages snippet extraction rules
 * Provides different rule sets for various use cases
 */
export class EnhancedRuleFactory {
  /**
   * Create all available rules
   */
  static createAllRules(): SnippetExtractionRule[] {
    return [
      // Core language rules
      new ControlStructureRule(),
      new ErrorHandlingRule(),
      new FunctionCallChainRule(),
      new CommentMarkedRule(),
      new LogicBlockRule(),
      new ExpressionSequenceRule(),
      new ObjectArrayLiteralRule(),
      new ArithmeticLogicalRule(),
      new TemplateLiteralRule(),
      new DestructuringAssignmentRule(),

      // Modern features rules
      new AsyncPatternRule(),
      new DecoratorPatternRule(),
      new GenericPatternRule(),
      new FunctionalProgrammingRule(),

      // Language-specific rules
      new PythonComprehensionRule(),
      new JavaStreamRule(),
      new JavaLambdaRule(),
      new GoGoroutineRule(),
      new GoInterfaceRule(),

      // Framework rules
      new ReactRule(),
      new DjangoRule(),
      new SpringBootRule(),
      new PyTorchRule()
    ];
  }

  /**
   * Create comprehensive rules for detailed analysis
   */
  static createComprehensiveRules(): SnippetExtractionRule[] {
    return this.createAllRules();
  }

  /**
   * Create language-specific rules
   */
  static createLanguageSpecificRules(language: string): SnippetExtractionRule[] {
    const baseRules = [
      new ControlStructureRule(),
      new ErrorHandlingRule(),
      new FunctionCallChainRule(),
      new CommentMarkedRule(),
      new LogicBlockRule(),
      new ExpressionSequenceRule(),
      new ObjectArrayLiteralRule(),
      new ArithmeticLogicalRule(),
      new TemplateLiteralRule(),
      new DestructuringAssignmentRule()
    ];

    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        return [
          ...baseRules,
          new AsyncPatternRule(),
          new DecoratorPatternRule(),
          new GenericPatternRule(),
          new FunctionalProgrammingRule(),
          new ReactRule()
        ];

      case 'python':
        return [
          ...baseRules,
          new PythonComprehensionRule(),
          new DjangoRule(),
          new PyTorchRule()
        ];

      case 'java':
        return [
          ...baseRules,
          new JavaStreamRule(),
          new JavaLambdaRule(),
          new SpringBootRule()
        ];

      case 'go':
        return [
          ...baseRules,
          new GoGoroutineRule(),
          new GoInterfaceRule()
        ];

      default:
        return baseRules;
    }
  }

  /**
   * Create rules focused on specific aspects
   */
  static createFocusedRules(focus: 'performance' | 'architecture' | 'security' | 'testing'): SnippetExtractionRule[] {
    const baseRules = [
      new ControlStructureRule(),
      new ErrorHandlingRule(),
      new FunctionCallChainRule()
    ];

    switch (focus) {
      case 'performance':
        return [
          ...baseRules,
          new FunctionCallChainRule(),
          new AsyncPatternRule(),
          new JavaStreamRule(),
          new PythonComprehensionRule(),
          new ReactRule(),
          new PyTorchRule()
        ];

      case 'architecture':
        return [
          ...baseRules,
          new DecoratorPatternRule(),
          new GenericPatternRule(),
          new FunctionalProgrammingRule(),
          new GoInterfaceRule(),
          new SpringBootRule(),
          new DjangoRule()
        ];

      case 'security':
        return [
          ...baseRules,
          new ErrorHandlingRule(),
          new FunctionCallChainRule(),
          new TemplateLiteralRule()
        ];

      case 'testing':
        return [
          ...baseRules,
          new CommentMarkedRule(),
          new ErrorHandlingRule(),
          new FunctionCallChainRule()
        ];

      default:
        return baseRules;
    }
  }

  /**
   * Create framework-specific rules
   */
  static createFrameworkRules(framework: string): SnippetExtractionRule[] {
    switch (framework.toLowerCase()) {
      case 'react':
        return [new ReactRule()];
      case 'django':
        return [new DjangoRule()];
      case 'spring':
      case 'springboot':
        return [new SpringBootRule()];
      case 'pytorch':
        return [new PyTorchRule()];
      default:
        return [];
    }
  }

  /**
   * Create minimal rules for quick analysis
   */
  static createMinimalRules(): SnippetExtractionRule[] {
    return [
      new ControlStructureRule(),
      new FunctionCallChainRule(),
      new ErrorHandlingRule()
    ];
  }

  /**
   * Create modern JavaScript/TypeScript rules
   */
  static createModernJSTSRules(): SnippetExtractionRule[] {
    return [
      new AsyncPatternRule(),
      new DecoratorPatternRule(),
      new GenericPatternRule(),
      new FunctionalProgrammingRule(),
      new ReactRule()
    ];
  }

  /**
   * Create data science and ML rules
   */
  static createDataScienceRules(): SnippetExtractionRule[] {
    return [
      new PythonComprehensionRule(),
      new DjangoRule(),
      new PyTorchRule()
    ];
  }

  /**
   * Create enterprise Java rules
   */
  static createEnterpriseJavaRules(): SnippetExtractionRule[] {
    return [
      new JavaStreamRule(),
      new JavaLambdaRule(),
      new SpringBootRule()
    ];
  }

  /**
   * Create concurrent programming rules
   */
  static createConcurrentRules(): SnippetExtractionRule[] {
    return [
      new AsyncPatternRule(),
      new GoGoroutineRule(),
      new JavaStreamRule()
    ];
  }

  /**
   * Get rule by name
   */
  static getRuleByName(name: string): SnippetExtractionRule | undefined {
    const allRules = this.createAllRules();
    return allRules.find(rule => rule.name === name);
  }

  /**
   * Get rules by type
   */
  static getRulesByType(type: string): SnippetExtractionRule[] {
    const allRules = this.createAllRules();
    return allRules.filter(rule => {
      if ('snippetType' in rule) {
        return (rule as any).snippetType === type;
      }
      return false;
    });
  }

  /**
   * Create custom rule set
   */
  static createCustomRuleSet(ruleNames: string[]): SnippetExtractionRule[] {
    const allRules = this.createAllRules();
    return ruleNames
      .map(name => this.getRuleByName(name))
      .filter(rule => rule !== undefined) as SnippetExtractionRule[];
  }
}

export default EnhancedRuleFactory;