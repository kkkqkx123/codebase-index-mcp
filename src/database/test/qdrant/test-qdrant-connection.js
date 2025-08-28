const { QdrantClient } = require('@qdrant/js-client-rest');

async function testConnection() {
  // Get configuration from environment variables
  const host = process.env.QDRANT_HOST || 'localhost';
  const port = process.env.QDRANT_PORT || 6333;
  const apiKey = process.env.QDRANT_API_KEY;
  
  const client = new QdrantClient({
    host,
    port,
    ...(apiKey ? { apiKey } : {})
  });
  
  try {
    // Attempt to connect and get collections
    const collections = await client.getCollections();
    console.log('Qdrant database connection successful');
    console.log('Available collections:', collections.collections.map(c => c.name));
    process.exit(0);
  } catch (error) {
    console.error('Qdrant database connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();