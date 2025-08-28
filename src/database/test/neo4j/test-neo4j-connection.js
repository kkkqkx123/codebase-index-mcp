const neo4j = require('neo4j-driver');

async function testConnection() {
  const driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', '1234567kk'));
  
  try {
    // Attempt to connect and run a simple query
    const session = driver.session({ database: 'codegraph_test' });
    await session.run('RETURN 1 AS number');
    await session.close();
    console.log('Database connection and user authentication successful');
    await driver.close();
    process.exit(0);
  } catch (error) {
    console.error('Database connection or authentication failed:', error.message);
    await driver.close();
    process.exit(1);
  }
}

testConnection();
