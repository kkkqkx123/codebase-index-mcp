#!/usr/bin/env pwsh
<#
.SYNOPSIS
    启动Redis服务的PowerShell脚本
.DESCRIPTION
    该脚本用于启动和管理Redis服务，专为代码库索引项目设计
.EXAMPLE
    .\scripts\start-redis.ps1
.EXAMPLE
    .\scripts\start-redis.ps1 -Stop
.EXAMPLE
    .\scripts\start-redis.ps1 -Restart
#>

param(
    [switch]$Stop,
    [switch]$Restart,
    [switch]$Status,
    [switch]$Logs
)

$ErrorActionPreference = "Stop"

# 颜色定义
$Green = "`e[32m"
$Yellow = "`e[33m"
$Red = "`e[31m"
$Reset = "`e[0m"

function Write-Status {
    param($Message, $Color = $Green)
    Write-Host "${Color}${Message}${Reset}"
}

function Test-RedisConnection {
    try {
        $result = docker exec codebase-index-redis redis-cli ping 2>$null
        return $result -eq "PONG"
    } catch {
        return $false
    }
}

function Start-RedisService {
    Write-Status "正在启动Redis服务..." $Yellow
    
    # 检查Docker是否运行
    try {
        $dockerStatus = docker info 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Status "Docker未运行，请先启动Docker Desktop" $Red
            return
        }
    } catch {
        Write-Status "Docker未安装或未运行" $Red
        return
    }

    # 启动Redis容器
    docker-compose -f docker-compose.redis.yml up -d
    
    if ($LASTEXITCODE -eq 0) {
        Write-Status "Redis容器启动成功" $Green
        
        # 等待Redis启动
        Write-Status "等待Redis服务就绪..." $Yellow
        $attempts = 0
        $maxAttempts = 10
        
        while ($attempts -lt $maxAttempts) {
            if (Test-RedisConnection) {
                Write-Status "Redis服务已就绪 ✓" $Green
                
                # 显示Redis信息
                $info = docker exec codebase-index-redis redis-cli info server 2>$null
                if ($info) {
                    $version = ($info | Select-String "redis_version:(.+)").Matches.Groups[1].Value.Trim()
                    Write-Status "Redis版本: $version" $Green
                }
                
                # 显示内存配置
                $memory = docker exec codebase-index-redis redis-cli config get maxmemory 2>$null
                if ($memory) {
                    $maxMemory = ($memory -split "`n")[1]
                    Write-Status "最大内存限制: $maxMemory" $Green
                }
                
                return
            }
            
            $attempts++
            Start-Sleep -Seconds 2
        }
        
        Write-Status "Redis服务启动超时" $Red
    } else {
        Write-Status "Redis容器启动失败" $Red
    }
}

function Stop-RedisService {
    Write-Status "正在停止Redis服务..." $Yellow
    docker-compose -f docker-compose.redis.yml down
    
    if ($LASTEXITCODE -eq 0) {
        Write-Status "Redis服务已停止 ✓" $Green
    } else {
        Write-Status "停止Redis服务失败" $Red
    }
}

function Show-RedisStatus {
    $running = docker ps --filter "name=codebase-index-redis" --format "table {{.Names}}\t{{.Status}}" 2>$null
    if ($running) {
        Write-Status "Redis容器状态:" $Green
        Write-Host $running
        
        if (Test-RedisConnection) {
            Write-Status "Redis连接正常 ✓" $Green
            
            # 显示内存使用
            $memory = docker exec codebase-index-redis redis-cli info memory 2>$null
            if ($memory) {
                $used = ($memory | Select-String "used_memory_human:(.+)").Matches.Groups[1].Value.Trim()
                $peak = ($memory | Select-String "used_memory_peak_human:(.+)").Matches.Groups[1].Value.Trim()
                Write-Status "内存使用: $used (峰值: $peak)" $Green
            }
            
            # 显示键数量
            $keys = docker exec codebase-index-redis redis-cli dbsize 2>$null
            if ($keys) {
                Write-Status "键数量: $keys" $Green
            }
        } else {
            Write-Status "Redis连接失败 ✗" $Red
        }
    } else {
        Write-Status "Redis容器未运行" $Yellow
    }
}

function Show-RedisLogs {
    Write-Status "Redis日志:" $Yellow
    docker-compose -f docker-compose.redis.yml logs --tail=50
}

# 主逻辑
if ($Stop) {
    Stop-RedisService
} elseif ($Restart) {
    Stop-RedisService
    Start-Sleep -Seconds 2
    Start-RedisService
} elseif ($Status) {
    Show-RedisStatus
} elseif ($Logs) {
    Show-RedisLogs
} else {
    Start-RedisService
    Show-RedisStatus
}

Write-Status "操作完成" $Green