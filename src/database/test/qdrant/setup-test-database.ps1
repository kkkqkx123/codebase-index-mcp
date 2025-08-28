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

# Test connection to Qdrant
Write-Host "Testing connection to Qdrant at ${host}:${port}"

try {
  $tcpClient = New-Object System.Net.Sockets.TcpClient
  $tcpClient.Connect($host, $port)
  if ($tcpClient.Connected) {
    Write-Host "Successfully connected to Qdrant at ${host}:${port}"
    $tcpClient.Close()
    Write-Host "Qdrant test database setup completed successfully"
    exit 0
  } else {
    Write-Host "Failed to connect to Qdrant at ${host}:${port}"
    exit 1
  }
} catch {
  Write-Host "Error connecting to Qdrant at ${host}:${port}: $_"
  exit 1
}