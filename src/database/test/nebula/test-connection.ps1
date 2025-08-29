# Test Connection Script for NebulaGraph

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

# Get NebulaGraph configuration from environment variables
$host = [Environment]::GetEnvironmentVariable("NEBULA_HOST")
$username = [Environment]::GetEnvironmentVariable("NEBULA_USERNAME")
$password = [Environment]::GetEnvironmentVariable("NEBULA_PASSWORD")
$space = [Environment]::GetEnvironmentVariable("NEBULA_SPACE")

Write-Host "NebulaGraph Host: $host"
Write-Host "NebulaGraph Username: $username"
Write-Host "NebulaGraph Password: $password"
Write-Host "NebulaGraph Space: $space"

# Validate configuration
if (-not $host -or -not $username -or -not $password) {
  Write-Host "Missing NebulaGraph configuration"
  exit 1
}

# Function to test NebulaGraph connection
function Test-NebulaConnection {
  param(
    [string]$Host,
    [string]$Username,
    [string]$Password,
    [string]$Space
  )
  
  try {
    # Check if @nebula-contrib/nebula-nodejs is installed, if not install it
    Set-Location -Path $PSScriptRoot
    $npmList = npm list @nebula-contrib/nebula-nodejs 2>$null
    if ($LASTEXITCODE -ne 0) {
      Write-Host "Installing @nebula-contrib/nebula-nodejs..."
      npm install @nebula-contrib/nebula-nodejs --no-save | Out-Null
    }
    
    # Create a Node.js script to test NebulaGraph connection in the project directory
    $testScript = @"
const { createClient } = require('@nebula-contrib/nebula-nodejs');

async function testConnection() {
  // Create client
  const client = createClient({
    addresses: ['$Host:9669'],
    username: '$Username',
    password: '$Password'
  });
  
  try {
    // Connect to NebulaGraph
    await client.connect();
    console.log('Connected to NebulaGraph successfully');
    
    // Try to use the target space
    try {
      await client.execute('USE $Space');
      console.log('Space $Space is accessible');
      await client.close();
      process.exit(0);
    } catch (error) {
      console.log('Space $Space is not accessible or does not exist');
      console.log('Error:', error.message);
      await client.close();
      process.exit(1);
    }
  } catch (error) {
    console.error('Failed to connect to NebulaGraph:', error.message);
    process.exit(1);
  }
}

testConnection();
"@
    
    # Write the test script to a file in the project directory
    $testScriptPath = Join-Path -Path $PSScriptRoot -ChildPath "test-nebula-connection.js"
    $testScript | Out-File -FilePath $testScriptPath -Encoding UTF8
    
    # Run the Node.js script
    Write-Host "Testing NebulaGraph connection..."
    $output = node $testScriptPath 2>&1
    
    # Display the output
    Write-Host $output
    
    # Clean up the test file
    if (Test-Path $testScriptPath) {
      Remove-Item $testScriptPath -Force
    }
    
    return $LASTEXITCODE -eq 0
  } catch {
    Write-Host "Error testing NebulaGraph connection: $_"
    return $false
  }
}

# Test the connection
$result = Test-NebulaConnection -Host $host -Username $username -Password $password -Space $space

if ($result) {
  Write-Host "NebulaGraph connection test passed successfully!" -ForegroundColor Green
  exit 0
} else {
  Write-Host "NebulaGraph connection test failed!" -ForegroundColor Red
  exit 1
}