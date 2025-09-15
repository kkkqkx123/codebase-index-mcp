import { AsyncPatternRule } from '../modern-features/AsyncPatternRule';
import { DecoratorPatternRule } from '../modern-features/DecoratorPatternRule';
import { GenericPatternRule } from '../modern-features/GenericPatternRule';
import { FunctionalProgrammingRule } from '../modern-features/FunctionalProgrammingRule';
import { PythonComprehensionRule } from '../languages/python/PythonComprehensionRule';
import { JavaStreamRule } from '../languages/java/JavaStreamRule';
import { GoGoroutineRule } from '../languages/go/GoGoroutineRule';
import { JavaLambdaRule } from '../languages/java/JavaLambdaRule';
import { GoInterfaceRule } from '../languages/go/GoInterfaceRule';
import { EnhancedRuleFactory } from '../EnhancedRuleFactory';

import Parser from 'tree-sitter';
const createMockNode = (
  type: string,
  text: string,
  startIndex = 0,
  endIndex = text.length,
  children: Parser.SyntaxNode[] = []
): Parser.SyntaxNode => {
  const mockNode: any = {
    type,
    text,
    startPosition: { row: 1, column: 0 },
    endPosition: { row: 1, column: text.length },
    startIndex,
    endIndex,
    children,
    parent: null,
    namedChildren: children,
    childForFieldName: (fieldName: string) => null,
    fieldNameForChild: (childIndex: number) => null,
    namedChild: (index: number) => children[index] || null,
    firstChild: children[0] || null,
    lastChild: children[children.length - 1] || null,
    nextSibling: null,
    previousSibling: null,
    hasChanges: false,
    hasError: () => false,
    isMissing: () => false,
    toString: () => text,
    walk: () => ({ current: mockNode }),
  };

  children.forEach(child => {
    if (child) child.parent = mockNode;
  });

  return mockNode as Parser.SyntaxNode;
};

describe('Enhanced Rules - AsyncPatternRule', () => {
  let rule: AsyncPatternRule;

  beforeEach(() => {
    rule = new AsyncPatternRule();
  });

  test('should extract async function declarations', () => {
    const sourceCode = `
      async function fetchData() {
        const data = await fetch('/api/data');
        return await data.json();
      }
    `;
    const node = createMockNode('async_function_declaration', sourceCode);
    const result = rule.extract(node, sourceCode);

    expect(result).toHaveLength(1);
    expect(result[0].snippetMetadata.snippetType).toBe('async_pattern');
    expect(result[0].snippetMetadata.asyncPattern).toBeDefined();
  });

  test('should extract Promise chains', () => {
    const sourceCode = `
      fetch('/api/data')
        .then(response => response.json())
        .then(data => console.log(data))
        .catch(error => console.error(error));
    `;
    const node = createMockNode('call_expression', sourceCode);
    const result = rule.extract(node, sourceCode);

    expect(result).toHaveLength(1);
    expect(result[0].snippetMetadata.languageFeatures?.usesAsync).toBe(true);
  });

  test('should extract concurrent execution patterns', () => {
    const sourceCode = `
      const results = await Promise.all([
        fetch('/api/users'),
        fetch('/api/posts'),
        fetch('/api/comments')
      ]);
    `;
    const node = createMockNode('await_expression', sourceCode);
    const result = rule.extract(node, sourceCode);

    expect(result).toHaveLength(1);
    expect(result[0].snippetMetadata.asyncPattern).toBe('concurrent_execution');
  });

  test('should filter simple async patterns', () => {
    const sourceCode = 'const data = await value;';
    const node = createMockNode('await_expression', sourceCode);
    const result = rule.extract(node, sourceCode);

    // Simple single await should be filtered out
    expect(result).toHaveLength(0);
  });
});

describe('Enhanced Rules - DecoratorPatternRule', () => {
  let rule: DecoratorPatternRule;

  beforeEach(() => {
    rule = new DecoratorPatternRule();
  });

  test('should extract TypeScript decorators', () => {
    const sourceCode = `
      @Component({
        selector: 'app-root',
        templateUrl: './app.component.html'
      })
      export class AppComponent {
        @Input() title: string;
        
        @Get('/users')
        getUsers() {
          return this.userService.getUsers();
        }
      }
    `;
    const node = createMockNode('class_declaration', sourceCode);
    const result = rule.extract(node, sourceCode);

    expect(result).toHaveLength(1);
    expect(result[0].snippetMetadata.decoratorInfo).toBeDefined();
    expect(result[0].snippetMetadata.decoratorInfo?.decorators).toContain('Component');
  });

  test('should extract Python decorators', () => {
    const sourceCode = `
      @property
      def name(self):
          return self._name
      
      @name.setter
      def name(self, value):
          self._name = value
      
      @staticmethod
      def create_instance():
          return MyClass()
    `;
    const node = createMockNode('function_definition', sourceCode);
    const result = rule.extract(node, sourceCode);

    expect(result).toHaveLength(1);
    // Check if decorators contain Python-specific patterns
    expect(
      result[0].snippetMetadata.decoratorInfo?.decorators.some(
        d => d.includes('property') || d.includes('staticmethod')
      )
    ).toBe(true);
  });

  test('should extract Java annotations', () => {
    const sourceCode = `
      @RestController
      @RequestMapping("/api")
      public class ApiController {
          
          @GetMapping("/users")
          public List<User> getUsers() {
              return userService.findAll();
          }
          
          @Autowired
          private UserService userService;
      }
    `;
    const node = createMockNode('class_declaration', sourceCode);
    const result = rule.extract(node, sourceCode);

    expect(result).toHaveLength(1);
    // Check if decorators contain Java-specific patterns
    expect(
      result[0].snippetMetadata.decoratorInfo?.decorators.some(
        d => d.includes('RestController') || d.includes('RequestMapping')
      )
    ).toBe(true);
  });

  test('should identify decorator purpose', () => {
    const sourceCode = `
      @Injectable()
      export class UserService {
        constructor(private http: HttpClient) {}
      }
    `;
    const node = createMockNode('class_declaration', sourceCode);
    const result = rule.extract(node, sourceCode);

    expect(result).toHaveLength(1);
    expect(result[0].snippetMetadata.decoratorInfo?.decoratorPurpose).toBe('dependency_injection');
  });
});

describe('Enhanced Rules - GenericPatternRule', () => {
  let rule: GenericPatternRule;

  beforeEach(() => {
    rule = new GenericPatternRule();
  });

  test('should extract TypeScript generics', () => {
    const sourceCode = `
      interface Repository<T> {
        findById(id: number): Promise<T>;
        save(entity: T): Promise<T>;
      }
      
      class UserService implements Repository<User> {
        async findById(id: number): Promise<User> {
          return await this.userRepository.findById(id);
        }
      }
    `;
    const node = createMockNode('interface_declaration', sourceCode);
    const result = rule.extract(node, sourceCode);

    expect(result).toHaveLength(1);
    expect(result[0].snippetMetadata.genericInfo).toBeDefined();
    expect(result[0].snippetMetadata.genericInfo?.typeParameters).toContain('T');
  });

  test('should extract Java generics', () => {
    const sourceCode = `
      public class GenericRepository<T> implements Repository<T> {
        private List<T> entities;
        
        public List<T> findAll() {
          return entities;
        }
        
        public void save(T entity) {
          entities.add(entity);
        }
      }
    `;
    const node = createMockNode('class_declaration', sourceCode);
    const result = rule.extract(node, sourceCode);

    expect(result).toHaveLength(1);
    // Check generic purpose through type parameters
    expect(result[0].snippetMetadata.genericInfo?.typeParameters).toContain('T');
  });

  test('should extract complex generic patterns', () => {
    const sourceCode = `
      function processMap<K, V>(map: Map<K, V>): Promise<Map<K, V>> {
        return new Promise((resolve) => {
          setTimeout(() => resolve(map), 1000);
        });
      }
    `;
    const node = createMockNode('function_declaration', sourceCode);
    const result = rule.extract(node, sourceCode);

    expect(result).toHaveLength(1);
    expect(result[0].snippetMetadata.genericInfo?.nestingLevel).toBeGreaterThan(0);
  });

  test('should identify generic purpose', () => {
    const sourceCode = `
      class DataTransformer<T, R> {
        transform(data: T): R {
          return this.mapper.map(data);
        }
      }
    `;
    const node = createMockNode('class_declaration', sourceCode);
    const result = rule.extract(node, sourceCode);

    expect(result).toHaveLength(1);
    expect(result[0].snippetMetadata.genericInfo?.genericPurpose).toBe('generic_transformation');
  });
});

describe('Enhanced Rules - FunctionalProgrammingRule', () => {
  let rule: FunctionalProgrammingRule;

  beforeEach(() => {
    rule = new FunctionalProgrammingRule();
  });

  test('should extract functional chaining patterns', () => {
    const sourceCode = `
      const result = users
        .filter(user => user.age >= 18)
        .map(user => user.name)
        .sort()
        .reduce((acc, name) => acc + ', ' + name, '');
    `;
    const node = createMockNode('call_expression', sourceCode);
    const result = rule.extract(node, sourceCode);

    expect(result).toHaveLength(1);
    expect(result[0].snippetMetadata.functionalInfo).toBeDefined();
    // Check functional complexity for chaining depth indication
    expect(result[0].snippetMetadata.functionalInfo?.complexity).toBeGreaterThan(1);
  });

  test('should extract function composition', () => {
    const sourceCode = `
      const processUser = compose(
        validateUser,
        normalizeUserData,
        saveUser
      );
      
      const result = processUser(userData);
    `;
    const node = createMockNode('variable_declaration', sourceCode);
    const result = rule.extract(node, sourceCode);

    expect(result).toHaveLength(1);
    expect(result[0].snippetMetadata.functionalInfo?.usesFunctionComposition).toBe(true);
  });

  test('should extract pure functions', () => {
    const sourceCode = `
      const add = (a: number, b: number): number => a + b;
      const multiply = (x: number, y: number) => x * y;
      
      const calculate = (n: number) => 
        pipe(
          add(5),
          multiply(2),
          Math.sqrt
        )(n);
    `;
    const node = createMockNode('variable_declaration', sourceCode);
    const result = rule.extract(node, sourceCode);

    expect(result).toHaveLength(1);
    // Check purity through immutability and side effects
    expect(result[0].snippetMetadata.functionalInfo?.usesImmutability).toBe(true);
  });

  test('should identify functional style', () => {
    const sourceCode = `
      const activeUsers = users
        .filter(user => user.isActive)
        .map(user => ({...user, lastSeen: new Date()}));
    `;
    const node = createMockNode('variable_declaration', sourceCode);
    const result = rule.extract(node, sourceCode);

    expect(result).toHaveLength(1);
    // Check functional style through higher-order functions
    expect(result[0].snippetMetadata.functionalInfo?.usesHigherOrderFunctions).toBe(true);
  });
});

describe('Language-Specific Rules', () => {
  test('PythonComprehensionRule should extract list comprehensions', () => {
    const rule = new PythonComprehensionRule();
    const sourceCode = `
      squares = [x**2 for x in range(10) if x % 2 == 0]
      names = [user.name for user in users if user.age >= 18]
    `;
    const node = createMockNode('list_comprehension', sourceCode);
    const result = rule.extract(node, sourceCode);

    expect(result).toHaveLength(1);
    expect(result[0].snippetMetadata.snippetType).toBe('python_comprehension');
  });

  test('JavaStreamRule should extract stream operations', () => {
    const rule = new JavaStreamRule();
    const sourceCode = `
      List<String> names = users.stream()
        .filter(user -> user.getAge() >= 18)
        .map(User::getName)
        .sorted()
        .collect(Collectors.toList());
    `;
    const node = createMockNode('method_call', sourceCode);
    const result = rule.extract(node, sourceCode);

    expect(result).toHaveLength(1);
    expect(result[0].snippetMetadata.snippetType).toBe('java_stream');
    // Check stream operations through operations array
    expect(
      result[0].snippetMetadata.javaStreamInfo?.operations.some(op => op.includes('stream'))
    ).toBe(true);
  });

  test('GoGoroutineRule should extract concurrency patterns', () => {
    const rule = new GoGoroutineRule();
    const sourceCode = `
      func processJobs(jobs <-chan Job) {
        for job := range jobs {
            go func(j Job) {
                defer wg.Done()
                processJob(j)
            }(job)
        }
      }
    `;
    const node = createMockNode('function_definition', sourceCode);
    const result = rule.extract(node, sourceCode);

    expect(result).toHaveLength(1);
    expect(result[0].snippetMetadata.snippetType).toBe('go_goroutine');
    // Check goroutines through goroutines count
    expect(result[0].snippetMetadata.goConcurrencyInfo?.goroutines).toBeGreaterThan(0);
  });
});

describe('EnhancedRuleFactory', () => {
  test('should create comprehensive rules', () => {
    const rules = EnhancedRuleFactory.createComprehensiveRules();

    expect(rules.length).toBeGreaterThan(10);
    expect(rules.some((rule: { name: string }) => rule.name === 'AsyncPatternRule')).toBe(true);
    expect(rules.some((rule: { name: string }) => rule.name === 'DecoratorPatternRule')).toBe(true);
  });

  test('should create language-specific rules', () => {
    const pythonRules = EnhancedRuleFactory.createLanguageSpecificRules('python');
    const javaRules = EnhancedRuleFactory.createLanguageSpecificRules('java');

    expect(pythonRules.length).toBeGreaterThan(0);
    expect(javaRules.length).toBeGreaterThan(0);
  });

  test('should create focused rules', () => {
    const performanceRules = EnhancedRuleFactory.createFocusedRules('performance');
    const architectureRules = EnhancedRuleFactory.createFocusedRules('architecture');

    expect(performanceRules.length).toBeGreaterThan(0);
    expect(architectureRules.length).toBeGreaterThan(0);
  });

  test('should provide rule statistics', () => {
    const stats = EnhancedRuleFactory.getRuleStatistics();

    expect(stats.totalRules).toBeGreaterThan(0);
    expect(stats.categories).toBeDefined();
    expect(stats.languageSupport).toBeDefined();
  });
});
