const neo4j = require('neo4j-driver');

async function createDatabase() {
  // First try to connect to the database directly
  const driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', '1234567kk'));
  
  try {
    // Try to connect to the target database
    const session = driver.session({ database: 'codegraph_test' });
    await session.run('RETURN 1');
    await session.close();
    console.log('Database codegraph_test already exists');
    await driver.close();
    process.exit(0);
  } catch (error) {
    // If we can't connect to the database, it might not exist
    console.log('Database codegraph_test does not exist or is not accessible');
    await driver.close();
    
    // Try to create it using system database
    try {
      const systemDriver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', '1234567kk'));
      const systemSession = systemDriver.session({ database: 'system' });
      await systemSession.run('CREATE DATABASE codegraph_test');
      await systemSession.close();
      console.log('Database codegraph_test created successfully');
      await systemDriver.close();
      process.exit(0);
    } catch (createError) {
      // If CREATE DATABASE fails, just continue with tests
      // This might happen with older Neo4j versions
      console.log('Could not create database codegraph_test, continuing with tests');
      console.log('Error:', createError.message);
      process.exit(0);
    }
  }
}

createDatabase();
