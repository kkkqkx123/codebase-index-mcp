#!/bin/bash

# NebulaGraph Personal Edition Start Script for WSL/Linux

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
DETACH=false
HELP=false
COMPOSE_FILE="docker-compose.personal.yml"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--detach)
            DETACH=true
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
NebulaGraph Personal Edition Start Script

Usage:
    ./start-personal.sh           # Start in foreground
    ./start-personal.sh -d        # Start in background (detached)
    ./start-personal.sh -h        # Show this help

Options:
    -d, --detach    Run containers in background
    -h, --help      Show this help message

Prerequisites:
    - Docker and Docker Compose must be installed
    - WSL2 with Docker Desktop integration

Data directories:
    - ./nebula-data      NebulaGraph data storage
    - ./nebula-logs      NebulaGraph logs
EOF
    exit 0
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running. Please start Docker Desktop.${NC}"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: docker-compose is not installed.${NC}"
    exit 1
fi

# Check if compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}Error: $COMPOSE_FILE not found in current directory.${NC}"
    exit 1
fi

# Create data directories if they don't exist
mkdir -p nebula-data nebula-logs

# Check if required configuration files exist
if [ ! -f "personal-nebula.conf" ]; then
    echo -e "${RED}Error: personal-nebula.conf not found.${NC}"
    exit 1
fi

if [ ! -f "nebula-stats-exporter-personal.yaml" ]; then
    echo -e "${RED}Error: nebula-stats-exporter-personal.yaml not found.${NC}"
    exit 1
fi

# Check if containers are already running
if docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
    echo -e "${YELLOW}Warning: NebulaGraph containers are already running.${NC}"
    echo -e "${YELLOW}Use './status-personal.sh' to check status or './stop-personal.sh' to stop.${NC}"
    exit 0
fi

echo -e "${BLUE}Starting NebulaGraph Personal Edition...${NC}"

# Build and start containers
if [ "$DETACH" = true ]; then
    echo -e "${GREEN}Starting in background (detached mode)...${NC}"
    docker-compose -f "$COMPOSE_FILE" up -d --build
else
    echo -e "${GREEN}Starting in foreground mode...${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop.${NC}"
    docker-compose -f "$COMPOSE_FILE" up --build
fi

# Wait for services to be ready
if [ "$DETACH" = true ]; then
    echo -e "${BLUE}Waiting for services to be ready...${NC}"
    
    # Wait for nebula-personal container
    for i in {1..30}; do
        if docker-compose -f "$COMPOSE_FILE" exec nebula-personal nebula-console -u root -p nebula -e "SHOW HOSTS;" > /dev/null 2>&1; then
            echo -e "${GREEN}NebulaGraph is ready!${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}Timeout waiting for NebulaGraph to start.${NC}"
            exit 1
        fi
        echo -n "."
        sleep 2
    done
    
    echo -e "${GREEN}Services started successfully!${NC}"
    echo -e "${BLUE}Access URLs:${NC}"
    echo -e "  Graph Service: http://localhost:9669"
    echo -e "  HTTP Metrics:  http://localhost:19669"
    echo -e "  Prometheus:    http://localhost:9101"
fi