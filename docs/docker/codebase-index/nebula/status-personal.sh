#!/bin/bash

# NebulaGraph Personal Edition Status Check Script for WSL/Linux

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

echo -e "${BLUE}NebulaGraph Personal Edition Status Check${NC}"
echo "============================================"

# Check Docker status
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running.${NC}"
    exit 1
fi

# Check container status
echo -e "${GREEN}Container Status:${NC}"
containers=("nebula-personal" "nebula-stats-exporter-personal")

for container in "${containers[@]}"; do
    if docker ps --format "table {{.Names}}" | grep -q "^${container}$"; then
        status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null)
        if [ "$status" = "running" ]; then
            echo -e "  ✅ $container: ${GREEN}Running${NC}"
            
            # Get resource usage
            stats=$(docker stats --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}" "$container" 2>/dev/null)
            if [ -n "$stats" ]; then
                cpu=$(echo "$stats" | tail -n 1 | awk '{print $1}')
                mem=$(echo "$stats" | tail -n 1 | awk '{print $2" "$3}')
                echo -e "     CPU: ${GRAY}$cpu${NC} | Memory: ${GRAY}$mem${NC}"
            fi
        else
            echo -e "  ❌ $container: ${RED}$status${NC}"
        fi
    else
        echo -e "  ❌ $container: ${RED}Not found${NC}"
    fi
done

# Check port availability
echo -e "\n${GREEN}Port Status:${NC}"
ports=(
    "9669:Graph Service"
    "19669:HTTP Metrics"
    "9101:Metrics Exporter"
)

for port_info in "${ports[@]}"; do
    port=$(echo "$port_info" | cut -d':' -f1)
    service=$(echo "$port_info" | cut -d':' -f2)
    
    if command -v nc > /dev/null 2>&1; then
        if nc -z localhost "$port" 2>/dev/null; then
            echo -e "  ✅ Port $port ($service): ${GREEN}Open${NC}"
        else
            echo -e "  ❌ Port $port ($service): ${RED}Closed${NC}"
        fi
    elif command -v telnet > /dev/null 2>&1; then
        if timeout 1 telnet localhost "$port" 2>/dev/null; then
            echo -e "  ✅ Port $port ($service): ${GREEN}Open${NC}"
        else
            echo -e "  ❌ Port $port ($service): ${RED}Closed${NC}"
        fi
    else
        echo -e "  ❓ Port $port ($service): ${YELLOW}Cannot check${NC}"
    fi
done

# Check NebulaGraph service health
echo -e "\n${GREEN}Service Health:${NC}"
if docker ps --format "table {{.Names}}" | grep -q "^nebula-personal$"; then
    if docker exec nebula-personal nebula-console -u root -p nebula -e "SHOW HOSTS;" > /dev/null 2>&1; then
        echo -e "  ✅ NebulaGraph service: ${GREEN}Responsive${NC}"
        
        # Check active sessions
        sessions=$(docker exec nebula-personal nebula-console -u root -p nebula -e "SHOW SESSIONS;" 2>/dev/null)
        if [ -n "$sessions" ]; then
            session_count=$(echo "$sessions" | wc -l)
            active_sessions=$((session_count - 2))  # Subtract header lines
            if [ "$active_sessions" -gt 0 ]; then
                echo -e "  📊 Active sessions: ${YELLOW}$active_sessions${NC}"
            else
                echo -e "  📊 Active sessions: ${GREEN}0${NC}"
            fi
        fi
    else
        echo -e "  ❌ NebulaGraph service: ${RED}Not responding${NC}"
    fi
else
    echo -e "  ❌ NebulaGraph service: ${RED}Container not running${NC}"
fi

# Check disk usage
echo -e "\n${GREEN}Disk Usage:${NC}"
if command -v df > /dev/null 2>&1; then
    echo -e "  📊 Docker storage usage:"
    docker system df --format "table {{.Type}}\t{{.TotalCount}}\t{{.Size}}" 2>/dev/null | while IFS=$'\t' read -r type count size; do
        if [ -n "$type" ]; then
            echo -e "    ${GRAY}$type: $count items, $size${NC}"
        fi
    done
fi

# Check data directories
echo -e "\n${GREEN}Data Directories:${NC}"
directories=("nebula-data" "nebula-logs")
for dir in "${directories[@]}"; do
    if [ -d "$dir" ]; then
        size=$(du -sh "$dir" 2>/dev/null | cut -f1)
        echo -e "  📁 $dir: ${GREEN}Exists${NC} (${GRAY}$size${NC})"
    else
        echo -e "  📁 $dir: ${YELLOW}Not found${NC}"
    fi
done

# Display usage instructions
echo -e "\n${BLUE}Usage Instructions:${NC}"
echo -e "  Start: ./start-personal.sh"
echo -e "  Stop: ./stop-personal.sh"
echo -e "  Clean: ./stop-personal.sh --clean"
echo -e "  Connect: docker exec -it nebula-personal nebula-console -u root -p nebula"