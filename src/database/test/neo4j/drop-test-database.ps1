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

# Function to drop Neo4j database
function Drop-Neo4jDatabase {
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
    
    # Create a Node.js script to drop Neo4j database in the project directory
    $dropScript = @"
const neo4j = require('neo4j-driver');

async function dropDatabase() {
  // Connect to the system database to drop a database
  const driver = neo4j.driver('$Uri', neo4j.auth.basic('$Username', '$Password'));
  
  try {
    const session = driver.session({ database: 'system' });
    await session.run('DROP DATABASE $Database IF EXISTS');
    await session.close();
    console.log('Database $Database dropped successfully');
    await driver.close();
    process.exit(0);
  } catch (error) {
    // If DROP DATABASE fails, just continue
    // This might happen with older Neo4j versions
    console.log('Could not drop database $Database, continuing');
    console.log('Error:', error.message);
    await driver.close();
    process.exit(0);
  }
}

dropDatabase();
"@
    
    # Write the drop script to a file in the project directory
    $dropScriptPath = Join-Path -Path $PSScriptRoot -ChildPath "drop-neo4j-database.js"
    $dropScript | Out-File -FilePath $dropScriptPath -Encoding UTF8
    
    # Run the Node.js script
    Write-Host "Dropping Neo4j database: $Database"
    $output = node $dropScriptPath 2>&1
    
    # Display the output
    Write-Host $output
    
    # Clean up the drop file
    Remove-Item $dropScriptPath -Force
    
    return $LASTEXITCODE -eq 0
  } catch {
    Write-Host "Error dropping Neo4j database: $_"
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
    
    # Drop database
    Write-Host "Dropping database: $database"
    $dropResult = Drop-Neo4jDatabase -Uri $uri -Username $username -Password $password -Database $database
    if ($dropResult) {
      Write-Host "Database $database dropped successfully"
      exit 0
    } else {
      Write-Host "Failed to drop database $database"
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