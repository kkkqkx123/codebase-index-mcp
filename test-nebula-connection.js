const { createClient } = require('@nebula-contrib/nebula-nodejs');

// Configuration without specifying space initially
const config = {
  servers: ['127.0.0.1:9669'],
  userName: 'root',
  password: 'nebula'
  // Note: Not specifying space initially
};

console.log('Testing NebulaGraph connection with config:', config);

let setupCompleted = false;

async function testConnection() {
  try {
    console.log('Creating NebulaGraph client without specifying space...');
    const client = createClient(config);
    
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
        
        // First, check if space exists
        console.log('Checking if space exists...');
        const spacesResult = await client.execute('SHOW SPACES');
        console.log('Existing spaces result:', JSON.stringify(spacesResult, null, 2));
        
        // Check if spacesResult.data exists and has the expected structure
        let spaceExists = false;
        if (spacesResult.data && typeof spacesResult.data === 'object') {
          // Handle different possible structures
          if (spacesResult.data.Name && Array.isArray(spacesResult.data.Name)) {
            spaceExists = spacesResult.data.Name.includes('codebase_index');
          }
        }
        
        console.log('Space exists:', spaceExists);
        
        if (!spaceExists) {
          console.log('Space does not exist, creating it...');
          // Create space with default parameters
          const createResult = await client.execute('CREATE SPACE IF NOT EXISTS codebase_index (partition_num = 10, replica_factor = 1, vid_type = FIXED_STRING(32))');
          console.log('Space creation result:', JSON.stringify(createResult, null, 2));
          
          // Wait longer for space to be ready
          console.log('Waiting for space to be created...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          console.log('Space already exists');
        }
        
        // Verify space exists now
        console.log('Verifying space exists...');
        const spacesResult2 = await client.execute('SHOW SPACES');
        console.log('Existing spaces after creation:', JSON.stringify(spacesResult2, null, 2));
        
        // Now switch to the space
        console.log('Switching to codebase_index space...');
        await client.execute('USE codebase_index');
        console.log('Switched to codebase_index space');
        
        // Test a simple query
        console.log('Executing SHOW HOSTS query...');
        const result = await client.execute('SHOW HOSTS');
        console.log('Query result:', JSON.stringify(result, null, 2));
        
        console.log('Connection test successful!');
        process.exit(0);
      } catch (error) {
        console.error('Error executing query:', error);
        process.exit(1);
      }
    });
    
    client.on('error', (error) => {
      console.error('NebulaGraph client error:', error);
      process.exit(1);
    });
    
    // Set a timeout
    setTimeout(() => {
      console.error('Connection timeout after 30 seconds');
      process.exit(1);
    }, 30000);
    
  } catch (error) {
    console.error('Failed to create NebulaGraph client:', error);
    process.exit(1);
  }
}

testConnection();