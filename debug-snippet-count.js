import { TreeSitterCoreService } from './src/services/parser/TreeSitterCoreService';
import { ControlStructureRule } from './src/services/parser/treesitter-rule/ControlStructureRule';
import { ErrorHandlingRule } from './src/services/parser/treesitter-rule/ErrorHandlingRule';
import { FunctionCallChainRule } from './src/services/parser/treesitter-rule/FunctionCallChainRule';
import { SnippetValidationService } from './src/services/parser/SnippetValidationService';

const complexCode = `
  class DataProcessor {
    constructor(data) {
      this.data = data;
    }
    
    async processData() {
      try {
        if (!Array.isArray(this.data)) {
          throw new Error('Invalid data format');
        }
        
        const processedData = this.data
          .filter(item => item && item.id)
          .map(item => ({
            ...item,
            processed: true,
            timestamp: Date.now()
          }))
          .sort((a, b) => b.id - a.id);
        
        return this.validateResults(processedData);
      } catch (error) {
        console.error('Processing failed:', error);
        throw new Error('Data processing failed');
      }
    }
    
    validateResults(results) {
      return results.every(result => 
        result.id && result.processed && result.timestamp
      );
    }
  }
`;

const typescriptCode = `
  interface User {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'user' | 'guest';
  }
  
  class UserService {
    private users: Map<string, User> = new Map();
    
    async createUser(userData: Omit<User, 'id'>): Promise<User> {
      try {
        const user: User = {
          id: this.generateId(),
          ...userData
        };
        
        if (await this.validateUser(user)) {
          this.users.set(user.id, user);
          return user;
        } else {
          throw new Error('Invalid user data');
        }
      } catch (error) {
        console.error('Failed to create user:', error);
        throw error;
      }
    }
    
    private async validateUser(user: User): Promise<boolean> {
      const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
      return emailRegex.test(user.email) && 
             user.name.length > 0 && 
             ['admin', 'user', 'guest'].includes(user.role);
    }
    
    private generateId(): string {
      return \`user_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
    }
  }
`;

const pythonCode = `
  import asyncio
  from typing import List, Dict, Optional
  from dataclasses import dataclass
  
  @dataclass
  class Item:
      id: int
      name: str
      value: float
      
  class ItemProcessor:
      def __init__(self):
          self.items: List[Item] = []
          
      async def add_item(self, item: Item) -> bool:
          try:
              if not self._validate_item(item):
                  raise ValueError("Invalid item")
              
              self.items.append(item)
              await self._save_item(item)
              return True
              
          except ValueError as e:
              print(f"Validation error: {e}")
              return False
          except Exception as e:
              print(f"Unexpected error: {e}")
              return False
              
      async def process_items(self) -> List[Dict]:
          if not self.items:
              return []
              
          try:
              results = []
              for item in self.items:
                  if item.value > 0:
                      processed = await self._process_single_item(item)
                      results.append(processized)
                      
              return sorted(results, key=lambda x: x['value'])
              
          except Exception as e:
              print(f"Processing failed: {e}")
              raise
              
      def _validate_item(self, item: Item) -> bool:
          return (
              isinstance(item, Item) and
              item.id > 0 and
              len(item.name) > 0 and
              item.value >= 0
          )
          
      async def _process_single_item(self, item: Item) -> Dict:
          return {
              'id': item.id,
              'name': item.name,
              'processed_value': item.value * 1.1,
              'timestamp': asyncio.get_event_loop().time()
          }
          
      async def _save_item(self, item: Item) -> None:
          # Simulate database save
          await asyncio.sleep(0.01)
          print(f"Saved item {item.id}")
`;

async function testSnippetCounts() {
  const treeSitterService = new TreeSitterCoreService();
  const controlStructureRule = new ControlStructureRule();
  const errorHandlingRule = new ErrorHandlingRule();
  const functionCallChainRule = new FunctionCallChainRule();

  console.log('Testing complex JavaScript code...');
  const jsResult = await treeSitterService.parseCode(complexCode, 'javascript');
  const jsControlSnippets = controlStructureRule.extract(jsResult.ast, complexCode);
  const jsErrorSnippets = errorHandlingRule.extract(jsResult.ast, complexCode);
  const jsFunctionSnippets = functionCallChainRule.extract(jsResult.ast, complexCode);
  
  console.log('JS Control Snippets:', jsControlSnippets.length);
  console.log('JS Error Snippets:', jsErrorSnippets.length);
  console.log('JS Function Snippets:', jsFunctionSnippets.length);
  
  const jsAllSnippets = [...jsControlSnippets, ...jsErrorSnippets, ...jsFunctionSnippets];
  const jsValidSnippets = jsAllSnippets.filter(snippet => 
    SnippetValidationService.enhancedIsValidSnippet(
      snippet.content, 
      snippet.snippetMetadata.snippetType, 
      'javascript'
    )
  );
  console.log('JS Valid Snippets:', jsValidSnippets.length);

  console.log('\nTesting TypeScript code...');
  const tsResult = await treeSitterService.parseCode(typescriptCode, 'typescript');
  const tsControlSnippets = controlStructureRule.extract(tsResult.ast, typescriptCode);
  const tsErrorSnippets = errorHandlingRule.extract(tsResult.ast, typescriptCode);
  const tsFunctionSnippets = functionCallChainRule.extract(tsResult.ast, typescriptCode);
  
  console.log('TS Control Snippets:', tsControlSnippets.length);
  console.log('TS Error Snippets:', tsErrorSnippets.length);
  console.log('TS Function Snippets:', tsFunctionSnippets.length);
  
  const tsAllSnippets = [...tsControlSnippets, ...tsErrorSnippets, ...tsFunctionSnippets];
  const tsValidSnippets = tsAllSnippets.filter(snippet => 
    SnippetValidationService.enhancedIsValidSnippet(
      snippet.content, 
      snippet.snippetMetadata.snippetType, 
      'typescript'
    )
  );
  console.log('TS Valid Snippets:', tsValidSnippets.length);

  console.log('\nTesting Python code...');
  const pyResult = await treeSitterService.parseCode(pythonCode, 'python');
  const pyControlSnippets = controlStructureRule.extract(pyResult.ast, pythonCode);
  const pyErrorSnippets = errorHandlingRule.extract(pyResult.ast, pythonCode);
  const pyFunctionSnippets = functionCallChainRule.extract(pyResult.ast, pythonCode);
  
  console.log('PY Control Snippets:', pyControlSnippets.length);
  console.log('PY Error Snippets:', pyErrorSnippets.length);
  console.log('PY Function Snippets:', pyFunctionSnippets.length);
  
  const pyAllSnippets = [...pyControlSnippets, ...pyErrorSnippets, ...pyFunctionSnippets];
  const pyValidSnippets = pyAllSnippets.filter(snippet => 
    SnippetValidationService.enhancedIsValidSnippet(
      snippet.content, 
      snippet.snippetMetadata.snippetType, 
      'python'
    )
  );
  console.log('PY Valid Snippets:', pyValidSnippets.length);
}

testSnippetCounts().catch(console.error);