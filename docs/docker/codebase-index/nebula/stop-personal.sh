#!/bin/bash

# NebulaGraph Personal Edition Stop Script for WSL/Linux

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
CLEAN=false
HELP=false
COMPOSE_FILE="docker-compose.personal.yml"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --clean)
            CLEAN=true
            shift
            ;;
        -h|--help)
            HELP=true
            shift
            ;;
        *)
            echo -e "${RED}Error: Unknown option $1${NC}"
            exit 1
            ;;
    esac
done

# Show help if requested
if [ "$HELP" = true ]; then
    cat << EOF
NebulaGraph Personal Edition Stop Script

Usage:
    ./stop-personal.sh           # Stop services only
    ./stop-personal.sh --clean   # Stop and clean data
    ./stop-personal.sh -h        # Show this help

Warning:
    --clean will delete ALL NebulaGraph data. Use with caution!

Data directories to be cleaned:
    - ./nebula-data
    - ./nebula-logs
EOF
    exit 0
fi

echo -e "${YELLOW}Stopping NebulaGraph Personal Edition...${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running.${NC}"
    exit 1
fi

# Check if compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}Error: $COMPOSE_FILE not found.${NC}"
    exit 1
fi

# Stop containers
echo -e "${BLUE}Stopping containers...${NC}"
docker-compose -f "$COMPOSE_FILE" down

# Clean data if requested
if [ "$CLEAN" = true ]; then
    echo -e "${RED}Cleaning data and logs...${NC}"
    
    # Ask for confirmation
    read -p "⚠️  This will DELETE ALL NebulaGraph data! Continue? (y/N): " confirm
    if [[ $confirm =~ ^[Yy]$ ]]; then
        directories=("nebula-data" "nebula-logs")
        
        for dir in "${directories[@]}"; do
            if [ -d "$dir" ]; then
                rm -rf "$dir"
                echo -e "  ✅ Cleaned: ${GREEN}$dir${NC}"
            else
                echo -e "  ℹ️  Directory not found: ${YELLOW}$dir${NC}"
            fi
        done
        
        echo -e "${GREEN}Data cleanup completed.${NC}"
    else
        echo -e "${YELLOW}Cleanup cancelled.${NC}"
    fi
else
    echo -e "${GREEN}Services stopped (data preserved).${NC}"
fi

# Show Docker disk usage
echo -e "\n${BLUE}Docker disk usage:${NC}"
if docker system df > /dev/null 2>&1; then
    docker system df --format "table {{.Type}}\t{{.TotalCount}}\t{{.Size}}" | while IFS=$'\t' read -r type count size; do
        if [ -n "$type" ]; then
            echo -e "  ${GRAY}$type: $count items, $size${NC}"
        fi
    done
else
    echo -e "  ${YELLOW}Unable to get Docker disk usage${NC}"
fi

# Final message
echo -e "\n${GREEN}NebulaGraph Personal Edition stopped successfully.${NC}"
echo -e "${BLUE}Next steps:${NC}"
echo -e "  - Start: ./start-personal.sh"
echo -e "  - Check status: ./status-personal.sh"
echo -e "  - Connect: docker exec -it nebula-personal nebula-console -u root -p nebula"