# Neo4j Connection Test Script

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

# Get Neo4j configuration from environment variables
$uri = [Environment]::GetEnvironmentVariable("NEO4J_URI")
$username = [Environment]::GetEnvironmentVariable("NEO4J_USERNAME")
$password = [Environment]::GetEnvironmentVariable("NEO4J_PASSWORD")
$database = [Environment]::GetEnvironmentVariable("NEO4J_DATABASE")

Write-Host "Neo4j URI: $uri"
Write-Host "Neo4j Username: $username"
Write-Host "Neo4j Password: $password"
Write-Host "Neo4j Database: $database"

# Validate configuration
if (-not $uri -or -not $username -or -not $password) {
  Write-Host "Missing Neo4j configuration"
  exit 1
}

# Parse URI to get host and port
if ($uri -match "^\w+://([\w\.-]+):(\d+)(/.*)?$") {
  $hostname = $matches[1]
  $port = $matches[2]
  Write-Host "Parsed hostname: $hostname and port: $port from URI: $uri"
} else {
  Write-Host "Invalid Neo4j URI format"
  exit 1
}

# Test connection to Neo4j
Write-Host "Testing connection to Neo4j at ${hostname}:${port}"

try {
  $tcpClient = New-Object System.Net.Sockets.TcpClient
  $tcpClient.Connect($hostname, $port)
  if ($tcpClient.Connected) {
    Write-Host "Successfully connected to Neo4j at ${hostname}:${port}"
    $tcpClient.Close()
    
    # Run the tests
    Write-Host "Running tests..."
    npm test -- src/database/test/Neo4jConnectionManager.test.ts
  } else {
    Write-Host "Failed to connect to Neo4j at ${hostname}:${port}"
    exit 1
  }
} catch {
  Write-Host "Error connecting to Neo4j at ${hostname}:${port}: $_"
  exit 1
}