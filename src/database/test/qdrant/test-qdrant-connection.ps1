# Qdrant Connection Test Script

# Load environment variables from .env file
# Look for .env and .env.example files in the project root directory
$projectRoot = Resolve-Path "../../../../"
$envFile = Join-Path -Path $projectRoot -ChildPath ".env"
$envExampleFile = Join-Path -Path $projectRoot -ChildPath ".env.example"

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
$qdrantHost = [Environment]::GetEnvironmentVariable("QDRANT_HOST")
$port = [Environment]::GetEnvironmentVariable("QDRANT_PORT")
$apiKey = [Environment]::GetEnvironmentVariable("QDRANT_API_KEY")

Write-Host "Qdrant Host: $qdrantHost"
Write-Host "Qdrant Port: $port"
Write-Host "Qdrant API Key: $($apiKey -replace '.', '*')"

# Validate configuration
if (-not $qdrantHost -or -not $port) {
  Write-Host "Missing Qdrant configuration"
  Write-Host "Please ensure QDRANT_HOST and QDRANT_PORT are set in your .env file"
  exit 1
}

# Test connection to Qdrant using the Node.js script
Write-Host "Testing connection to Qdrant at ${qdrantHost}:${port}"
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
  
  # Check if the Node.js script exists
  $nodeScriptPath = Join-Path -Path $PSScriptRoot -ChildPath "test-qdrant-connection.js"
  if (-not (Test-Path $nodeScriptPath)) {
    Write-Host "Error: test-qdrant-connection.js not found at $nodeScriptPath"
    exit 1
  }
  
  # Run the Node.js script to test Qdrant connection
  Write-Host "Testing Qdrant database connection and authentication..."
  Write-Host "Executing: node test-qdrant-connection.js"
  $output = node test-qdrant-connection.js 2>&1
  
  # Capture the exit code
  $exitCode = $LASTEXITCODE
  
  # Display the output
  Write-Host "Node.js script output:"
  Write-Host $output
  
  if ($exitCode -eq 0) {
    Write-Host "Qdrant database connection and authentication successful"
    Write-Host "You can now run the Qdrant tests"
    exit 0
  } else {
    Write-Host "Qdrant database connection or authentication failed"
    Write-Host "Exit code: $exitCode"
    exit 1
  }
} catch {
  Write-Host "Error connecting to Qdrant at ${host}:${port}: $_"
  Write-Host "Exception type: $($_.Exception.GetType().FullName)"
  Write-Host "Stack trace: $($_.ScriptStackTrace)"
  exit 1
}