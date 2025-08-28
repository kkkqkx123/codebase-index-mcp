# Setup Test Database Script

# Load environment variables from .env file
$envFile = '.env'
$envExampleFile = '.env.example'

# Function to load environment variables from file
function Load-EnvFile {
  param(
    [string]$FilePath
  )
  
  if (Test-Path $FilePath) {
    Write-Host "Loading environment variables from $FilePath"
    Get-Content $FilePath | ForEach-Object {
      # Skip comments and empty lines
      if ($_ -match "^\s*#" -or $_ -match "^\s*$") { return }
      
      # Parse key-value pairs
      $key, $value = $_ -split "=", 2
      if ($key -and $value) {
        # Remove quotes from value if present
        $value = $value -replace '^"(.*)"$', '$1'
        # Set environment variable
        [Environment]::SetEnvironmentVariable($key, $value)
        Write-Host "Set $key = $value"
        Write-Debug "Set $key = $value"
      }
    }
  }
}

# Try to load .env file first, fallback to .env.example if not found
if (Test-Path $envFile) {
  Load-EnvFile -FilePath $envFile
} elseif (Test-Path $envExampleFile) {
  Write-Host ".env file not found, using .env.example instead"
  Load-EnvFile -FilePath $envExampleFile
} else {
  Write-Host "Neither .env nor .env.example file found"
  exit 1
}

# Get Qdrant configuration from environment variables
$host = [Environment]::GetEnvironmentVariable("QDRANT_HOST")
$port = [Environment]::GetEnvironmentVariable("QDRANT_PORT")
$apiKey = [Environment]::GetEnvironmentVariable("QDRANT_API_KEY")

Write-Host "Qdrant Host: $host"
Write-Host "Qdrant Port: $port"
Write-Host "Qdrant API Key: $($apiKey -replace '.', '*')"

# Validate configuration
if (-not $host -or -not $port) {
  Write-Host "Missing Qdrant configuration"
  exit 1
}

# Test connection to Qdrant and create a test collection
Write-Host "Setting up Qdrant test database at ${host}:${port}"

try {
  # Check if @qdrant/js-client-rest is installed, if not install it
  Set-Location -Path $PSScriptRoot
  $npmList = npm list @qdrant/js-client-rest 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing @qdrant/js-client-rest..."
    npm install @qdrant/js-client-rest --no-save | Out-Null
  }
  
  Write-Host "Creating temporary test database setup script"
  # Create a Node.js script to set up test collections
  $setupScript = @"
const { QdrantClient } = require('@qdrant/js-client-rest');

async function setupTestDatabase() {
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
    // Test connection by getting collections
    const collections = await client.getCollections();
    console.log('Qdrant database connection successful');
    console.log('Available collections:', collections.collections.map(c => c.name));
    
    // Create a test collection for validation
    const testCollectionName = 'test-validation-collection';
    console.log(`Creating test collection: ${testCollectionName}`);
    
    // Check if collection already exists
    let collectionExists = false;
    for (const collection of collections.collections) {
      if (collection.name === testCollectionName) {
        collectionExists = true;
        break;
      }
    }
    
    if (collectionExists) {
      console.log(`Test collection ${testCollectionName} already exists, deleting it first`);
      await client.deleteCollection(testCollectionName);
    }
    
    // Create the test collection
    await client.createCollection(testCollectionName, {
      vectors: {
        size: 128,
        distance: 'Cosine'
      }
    });
    
    console.log(`Successfully created test collection: ${testCollectionName}`);
    
    // Verify the collection was created
    const collectionInfo = await client.getCollection(testCollectionName);
    console.log(`Collection info:`, JSON.stringify(collectionInfo, null, 2));
    
    // Clean up - delete the test collection
    await client.deleteCollection(testCollectionName);
    console.log(`Cleaned up test collection: ${testCollectionName}`);
    
    console.log('Qdrant test database setup completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error setting up Qdrant test database:', error.message);
    process.exit(1);
  }
}

setupTestDatabase();
"@
  
  # Write the setup script to a file
  $setupScriptPath = Join-Path -Path $PSScriptRoot -ChildPath "setup-test-collection.js"
  $setupScript | Out-File -FilePath $setupScriptPath -Encoding UTF8
  
  # Run the Node.js script to set up test database
  Write-Host "Setting up Qdrant test database..."
  $output = node $setupScriptPath 2>&1
  
  # Capture the exit code
  $exitCode = $LASTEXITCODE
  
  # Display the output
  Write-Host $output
  
  # Clean up the setup script file
  Remove-Item $setupScriptPath -Force
  
  Write-Host "Node.js script execution completed with exit code: $exitCode"
  if ($exitCode -eq 0) {
    Write-Host "Qdrant test database setup completed successfully"
    exit 0
  } else {
    Write-Host "Qdrant test database setup failed"
    Write-Host "Exit code: $exitCode"
    exit 1
  }
} catch {
  Write-Host "Error setting up Qdrant test database: $_"
  exit 1
}