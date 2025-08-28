# Drop Test Database Script

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
        Write-Debug "Set $key = $value"
      }
    }
  }
}

# Try to load .env file first, fallback to .env.example if not found
if (Test-Path $envFile) {
  Write-Host "Found .env file, loading configuration"
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
  Write-Host "Please ensure QDRANT_HOST and QDRANT_PORT are set in your .env file"
  exit 1
}

# Test connection to Qdrant using the Node.js script
Write-Host "Dropping test collections from Qdrant at ${host}:${port}"
Write-Host "Current working directory: $((Get-Location).Path)"

try {
  # Check if @qdrant/js-client-rest is installed, if not install it
  Set-Location -Path $PSScriptRoot
  Write-Host "Checking for @qdrant/js-client-rest package..."
  $npmList = npm list @qdrant/js-client-rest 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing @qdrant/js-client-rest..."
    npm install @qdrant/js-client-rest --no-save --loglevel verbose | Out-Null
    Write-Host "Package installation completed"
  } else {
    Write-Host "Package @qdrant/js-client-rest is already installed"
  }
  
  # Create a Node.js script to drop test collections
  $dropScript = @"
const { QdrantClient } = require('@qdrant/js-client-rest');

async function dropTestCollections() {
  // Get configuration from environment variables
  const host = process.env.QDRANT_HOST || 'localhost';
  const port = process.env.QDRANT_PORT || 6333;
  const apiKey = process.env.QDRANT_API_KEY;
  
  console.log(`Connecting to Qdrant at ${host}:${port}`);
  console.log(`API Key provided: ${!!apiKey}`);
  
  const client = new QdrantClient({
    host,
    port,
    ...(apiKey ? { apiKey } : {})
  });
  
  try {
    console.log('Attempting to connect to Qdrant...');
    // Get all collections
    const collections = await client.getCollections();
    console.log('Available collections:', collections.collections.map(c => c.name));
    
    // Delete test collections (those starting with 'test-' prefix)
    let deletedCount = 0;
    for (const collection of collections.collections) {
      if (collection.name.startsWith('test-')) {
        console.log(`Deleting collection: ${collection.name}`);
        await client.deleteCollection(collection.name);
        console.log(`Successfully deleted collection: ${collection.name}`);
        deletedCount++;
      }
    }
    
    console.log(`Deleted ${deletedCount} test collections`);
    console.log('Test database cleanup completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during test database cleanup:', error.message);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
}

dropTestCollections();
"@
  
  # Write the drop script to a file
  $dropScriptPath = Join-Path -Path $PSScriptRoot -ChildPath "drop-test-collections.js"
  $dropScript | Out-File -FilePath $dropScriptPath -Encoding UTF8
  
  # Check if the drop script file was created successfully
  if (-not (Test-Path $dropScriptPath)) {
    Write-Host "Error: Failed to create drop script file at $dropScriptPath"
    exit 1
  }
  
  # Run the Node.js script to drop test collections
  Write-Host "Dropping test collections..."
  Write-Host "Executing: node drop-test-collections.js"
  $output = node $dropScriptPath 2>&1
  
  # Capture the exit code
  $exitCode = $LASTEXITCODE
  
  # Display the output
  Write-Host "Node.js script output:"
  Write-Host $output
  
  # Clean up the drop script file
  Remove-Item $dropScriptPath -Force
  
  if ($exitCode -eq 0) {
    Write-Host "Test database cleanup completed successfully"
    exit 0
  } else {
    Write-Host "Test database cleanup failed"
    Write-Host "Exit code: $exitCode"
    exit 1
  }
} catch {
  Write-Host "Error during test database cleanup: $_"
  Write-Host "Exception type: $($_.Exception.GetType().FullName)"
  Write-Host "Stack trace: $($_.ScriptStackTrace)"
  exit 1
}