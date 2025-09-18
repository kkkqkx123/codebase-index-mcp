const { createClient } = require('@nebula-contrib/nebula-nodejs');

// Configuration specifying the space
const config = {
  servers: ['127.0.0.1:9669'],
  userName: 'root',
  password: 'nebula',
  space: 'codebase_index'
};

console.log('Initializing NebulaGraph space with config:', config);

async function initializeSpace() {
  try {
    console.log('Creating NebulaGraph client with space specification...');
    const client = createClient(config);
    
    let setupCompleted = false;
    
    // Add event listeners
    client.on('ready', async () => {
      console.log('NebulaGraph client is ready!');
      
      // Only run setup once
      if (setupCompleted) {
        return;
      }
      
      try {
        setupCompleted = true;
        
        // Wait a moment for connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify we're in the correct space
        console.log('Verifying current space...');
        // Note: Nebula doesn't have a direct command to show current space, so we'll just proceed
        
        // Create graph schema (tags)
        console.log('Creating graph schema tags...');
        const tagQueries = [
          'CREATE TAG IF NOT EXISTS Project(id string, name string, createdAt string, updatedAt string)',
          'CREATE TAG IF NOT EXISTS File(id string, filepath string, relativePath string, name string, language string, size int, hash string, linesOfCode int, functions int, classes int, lastModified string, updatedAt string)',
          'CREATE TAG IF NOT EXISTS Function(id string, name string, content string, startLine int, endLine int, complexity int, parameters string, returnType string, language string, updatedAt string)',
          'CREATE TAG IF NOT EXISTS Class(id string, name string, content string, startLine int, endLine int, methods int, properties int, inheritance string, language string, updatedAt string)',
          'CREATE TAG IF NOT EXISTS Import(id string, module string, updatedAt string)',
          'CREATE TAG IF NOT EXISTS Node(id string, type string, name string, content string, filepath string, startLine int, endLine int, language string, metadata string, hash string, createdAt string, updatedAt string)'
        ];
        
        for (const query of tagQueries) {
          console.log('Executing:', query);
          await client.execute(query);
        }
        
        // Create edge types
        console.log('Creating edge types...');
        const edgeQueries = [
          'CREATE EDGE IF NOT EXISTS BELONGS_TO()',
          'CREATE EDGE IF NOT EXISTS CONTAINS()',
          'CREATE EDGE IF NOT EXISTS IMPORTS()',
          'CREATE EDGE IF NOT EXISTS CALLS()',
          'CREATE EDGE IF NOT EXISTS EXTENDS()',
          'CREATE EDGE IF NOT EXISTS IMPLEMENTS()',
          'CREATE EDGE IF NOT EXISTS REFERENCES()',
          'CREATE EDGE IF NOT EXISTS RELATED_TO(properties string)'
        ];
        
        for (const query of edgeQueries) {
          console.log('Executing:', query);
          await client.execute(query);
        }
        
        console.log('Graph schema created successfully');
        
        // Verify schema
        console.log('Verifying tags...');
        const tagsResult = await client.execute('SHOW TAGS');
        console.log('Tags:', tagsResult.data);
        
        console.log('Verifying edges...');
        const edgesResult = await client.execute('SHOW EDGES');
        console.log('Edges:', edgesResult.data);
        
        console.log('Space initialization completed successfully!');
        process.exit(0);
      } catch (error) {
        console.error('Error during space initialization:', error);
        process.exit(1);
      }
    });
    
    client.on('error', (error) => {
      console.error('NebulaGraph client error:', error);
      process.exit(1);
    });
    
    // Set a timeout
    setTimeout(() => {
      console.error('Initialization timeout after 30 seconds');
      process.exit(1);
    }, 30000);
    
  } catch (error) {
    console.error('Failed to create NebulaGraph client:', error);
    process.exit(1);
  }
}

initializeSpace();