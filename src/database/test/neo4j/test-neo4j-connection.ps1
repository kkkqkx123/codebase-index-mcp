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

# Function to test Neo4j database connection and user authentication
function Test-Neo4jConnection {
  param(
    [string]$Uri,
    [string]$Username,
    [string]$Password,
    [string]$Database
  )
  
  try {
    # Check if neo4j-driver is installed, if not install it
    Set-Location -Path $PSScriptRoot
    $npmList = npm list neo4j-driver 2>$null
    if ($LASTEXITCODE -ne 0) {
      Write-Host "Installing neo4j-driver..."
      npm install neo4j-driver --no-save | Out-Null
    }
    
    # Create a Node.js script to test Neo4j connection in the project directory
    $testScript = @"
const neo4j = require('neo4j-driver');

async function testConnection() {
  const driver = neo4j.driver('$Uri', neo4j.auth.basic('$Username', '$Password'));
  
  try {
    // Attempt to connect and run a simple query
    const session = driver.session({ database: '$Database' });
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
"@
    
    # Write the test script to a file in the project directory
    $testScriptPath = Join-Path -Path $PSScriptRoot -ChildPath "test-neo4j-connection.js"
    $testScript | Out-File -FilePath $testScriptPath -Encoding UTF8
    
    # Run the Node.js script
    Write-Host "Testing Neo4j database connection and user authentication..."
    $output = node $testScriptPath 2>&1
    
    # Capture the exit code
    $exitCode = $LASTEXITCODE
    
    # Display the output
    Write-Host $output
    
    # Check if the output contains database not found error
    if ($output -like "*Graph not found*" -or $output -like "*Database does not exist*") {
      Write-Host "The specified database does not exist. You may need to create it first."
      Write-Host "Please ensure that the database '$Database' exists in your Neo4j instance."
      Write-Host "You can create it by connecting to Neo4j with the Neo4j Browser or Cypher Shell and running:"
      Write-Host "CREATE DATABASE $Database"
      # Return a specific value for database not found error
      return 2
    }
    
    # Clean up the test file
    Remove-Item $testScriptPath -Force
    
    return $exitCode -eq 0
  } catch {
    Write-Host "Error testing Neo4j connection: $_"
    # Check if the error is related to database not found
    if ($_ -like "*Graph not found*" -or $_ -like "*Database does not exist*") {
      Write-Host "The specified database does not exist. You may need to create it first."
    }
    return $false
  }
}

# Test connection to Neo4j
Write-Host "Testing connection to Neo4j at ${hostname}:${port}"

try {
  $tcpClient = New-Object System.Net.Sockets.TcpClient
  $tcpClient.Connect($hostname, $port)
  if ($tcpClient.Connected) {
    Write-Host "Successfully connected to Neo4j at ${hostname}:${port}"
    $tcpClient.Close()
    
    # Test database connection and user authentication
    $dbTestResult = Test-Neo4jConnection -Uri $uri -Username $username -Password $password -Database $database
    
    if ($dbTestResult -eq $true) {
      Write-Host "Database exists and user authentication successful"
      
      # Run the tests
      Write-Host "Running tests..."
      npm test -- src/database/test/Neo4jConnectionManager.test.ts
    } elseif ($dbTestResult -eq 2) {
      # Database not found error
      Write-Host "Database connection failed due to database not found"
      exit 2
    } else {
      Write-Host "Database connection or user authentication failed"
      exit 1
    }
  } else {
    Write-Host "Failed to connect to Neo4j at ${hostname}:${port}"
    exit 1
  }
} catch {
  Write-Host "Error connecting to Neo4j at ${hostname}:${port}: $_"
  exit 1
}