# Setup Test Database Script for NebulaGraph

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

# Function to create NebulaGraph space
function Create-NebulaSpace {
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
    
    # Create a Node.js script to create NebulaGraph space in the project directory
    $createScript = @"
const { createClient, execute } = require('@nebula-contrib/nebula-nodejs');

async function createSpace() {
  // Create client
  const client = createClient({
    addresses: ['$Host:9669'],
    username: '$Username',
    password: '$Password'
  });
  
  try {
    // Connect to NebulaGraph
    await client.connect();
    
    // Try to use the target space
    try {
      await client.execute('USE $Space');
      console.log('Space $Space already exists');
      await client.close();
      process.exit(0);
    } catch (error) {
      // If we can't use the space, it might not exist
      console.log('Space $Space does not exist or is not accessible');
      console.log('Error:', error.message);
      
      // Try to create it
      try {
        await client.execute('CREATE SPACE IF NOT EXISTS $Space (partition_num = 1, replica_factor = 1, vid_type = INT64)');
        console.log('Space $Space created successfully');
        
        // Wait a moment for the space to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Use the space
        await client.execute('USE $Space');
        
        // Create default schema
        await client.execute('CREATE TAG IF NOT EXISTS node (name string, type string)');
        await client.execute('CREATE EDGE IF NOT EXISTS relationship (type string)');
        console.log('Default schema created successfully');
        
        await client.close();
        process.exit(0);
      } catch (createError) {
        console.error('Failed to create space:', createError.message);
        await client.close();
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('Failed to connect to NebulaGraph:', error.message);
    process.exit(1);
  }
}

createSpace();
"@
    
    # Write the create script to a file in the project directory
    $createScriptPath = Join-Path -Path $PSScriptRoot -ChildPath "create-nebula-space.js"
    $createScript | Out-File -FilePath $createScriptPath -Encoding UTF8
    
    # Run the Node.js script
    Write-Host "Creating NebulaGraph space: $Space"
    $output = node $createScriptPath 2>&1
    
    # Display the output
    Write-Host $output
    
    # Clean up the create file
    if (Test-Path $createScriptPath) {
      Remove-Item $createScriptPath -Force
    }
    
    return $LASTEXITCODE -eq 0
  } catch {
    Write-Host "Error creating NebulaGraph space: $_"
    return $false
  }
}

# Create the space
Create-NebulaSpace -Host $host -Username $username -Password $password -Space $space