# Qdrant Connection Test Script

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

# Function to test Qdrant database connection
function Test-QdrantConnection {
  param(
    [string]$Host,
    [string]$Port,
    [string]$ApiKey
  )
  
  try {
    # Check if @qdrant/js-client-rest is installed, if not install it
    Set-Location -Path $PSScriptRoot
    $npmList = npm list @qdrant/js-client-rest 2>$null
    if ($LASTEXITCODE -ne 0) {
      Write-Host "Installing @qdrant/js-client-rest..."
      npm install @qdrant/js-client-rest --no-save | Out-Null
    }
    
    # Create a Node.js script to test Qdrant connection in the project directory
    $testScript = @"
const { QdrantClient } = require('@qdrant/js-client-rest');

async function testConnection() {
  const client = new QdrantClient({
    host: '$Host',
    port: $Port,
    apiKey: '$ApiKey'
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
"@
    
    # Write the test script to a file in the project directory
    $testScriptPath = Join-Path -Path $PSScriptRoot -ChildPath "test-qdrant-connection.js"
    $testScript | Out-File -FilePath $testScriptPath -Encoding UTF8
    
    # Run the Node.js script
    Write-Host "Testing Qdrant database connection..."
    $output = node $testScriptPath 2>&1
    
    # Capture the exit code
    $exitCode = $LASTEXITCODE
    
    # Display the output
    Write-Host $output
    
    # Clean up the test file
    Remove-Item $testScriptPath -Force
    
    return $exitCode -eq 0
  } catch {
    Write-Host "Error testing Qdrant connection: $_"
    return $false
  }
}

# Test connection to Qdrant
Write-Host "Testing connection to Qdrant at ${host}:${port}"

try {
  $tcpClient = New-Object System.Net.Sockets.TcpClient
  $tcpClient.Connect($host, $port)
  if ($tcpClient.Connected) {
    Write-Host "Successfully connected to Qdrant at ${host}:${port}"
    $tcpClient.Close()
    
    # Test database connection
    $dbTestResult = Test-QdrantConnection -Host $host -Port $port -ApiKey $apiKey
    
    if ($dbTestResult -eq $true) {
      Write-Host "Qdrant database connection successful"
      
      # Run the tests
      Write-Host "Running tests..."
      npm test -- src/database/test/qdrant/QdrantClientWrapper.test.ts
    } else {
      Write-Host "Qdrant database connection failed"
      exit 1
    }
  } else {
    Write-Host "Failed to connect to Qdrant at ${host}:${port}"
    exit 1
  }
} catch {
  Write-Host "Error connecting to Qdrant at ${host}:${port}: $_"
  exit 1
}