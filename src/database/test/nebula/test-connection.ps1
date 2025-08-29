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
$nebulaHost = [Environment]::GetEnvironmentVariable("NEBULA_HOST")
$nebulaPort = [Environment]::GetEnvironmentVariable("NEBULA_PORT")
$username = [Environment]::GetEnvironmentVariable("NEBULA_USERNAME")
$password = [Environment]::GetEnvironmentVariable("NEBULA_PASSWORD")
$space = [Environment]::GetEnvironmentVariable("NEBULA_SPACE")

Write-Host "NebulaGraph Host: $nebulaHost"
Write-Host "NebulaGraph Port: $nebulaPort"
Write-Host "NebulaGraph Username: $username"
Write-Host "NebulaGraph Password: $password"
Write-Host "NebulaGraph Space: $space"
Write-Host "Note: If space '$space' doesn't exist, try using 'codegraph' instead"

# Validate configuration
if (-not $nebulaHost -or -not $nebulaPort -or -not $username -or -not $password) {
  Write-Host "Missing NebulaGraph configuration"
  exit 1
}

# Function to test NebulaGraph connection
function Test-NebulaConnection {
  param(
    [string]$NebulaHost,
    [string]$NebulaPort,
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
  // Create client with correct options based on NebulaConnectionManager implementation
  const client = createClient({
    servers: ['${NebulaHost}:${NebulaPort}'],
    userName: '${Username}',
    password: '${Password}',
    space: '${Space}',
    poolSize: 2,
    executeTimeout: 10000
  });
  
  try {
    // Connect to NebulaGraph using event listeners (no explicit connect method)
    await new Promise((resolve, reject) => {
      client.on('ready', () => resolve());
      client.on('error', (error) => reject(error));
      
      // Set timeout
      setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });
    
    console.log('Connected to NebulaGraph successfully');
    
    // Test basic query to verify connection
    try {
      const result = await client.execute('SHOW HOSTS', false);
      console.log('Basic query executed successfully');
      console.log('Basic query successful - received response with', result?.data?.length || 0, 'hosts');
      
      // Try to use the target space
      try {
        await client.execute('USE $Space', false);
        console.log('Space $Space is accessible');
        client.removeAllListeners();
        process.exit(0);
      } catch (spaceError) {
        console.log('Space $Space is not accessible or does not exist');
        console.log('Error:', spaceError.message);
        client.removeAllListeners();
        process.exit(1);
      }
    } catch (queryError) {
      console.log('Failed to execute basic query:', queryError.message);
      client.removeAllListeners();
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
$result = Test-NebulaConnection -NebulaHost $nebulaHost -NebulaPort $nebulaPort -Username $username -Password $password -Space $space

if ($result) {
  Write-Host "NebulaGraph connection test passed successfully!" -ForegroundColor Green
  exit 0
} else {
  Write-Host "NebulaGraph connection test failed!" -ForegroundColor Red
  exit 1
}