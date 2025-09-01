# Prometheus Web界面使用说明

本文档介绍如何使用Prometheus的Web界面进行监控和指标查询。

## 一、访问Prometheus Web界面

Prometheus服务配置在9090端口，您可以通过以下URL在浏览器中访问：
http://127.0.0.1:9090

## 二、Prometheus Web界面主要功能

### 1. 图形化指标查询 (Graph)

这是Prometheus最核心的功能，允许您查询和可视化指标数据：

1. 在查询框中输入PromQL查询语句
2. 点击"Execute"执行查询
3. 切换到"Graph"标签页查看图形化结果

### 2. 指标列表 (Targets)

在"Status" > "Targets"页面中，您可以查看所有配置的监控目标及其状态：

- UP: 目标正常运行，Prometheus可以成功抓取指标
- DOWN: 目标不可达或抓取失败

### 3. 服务发现 (Service Discovery)

在"Status" > "Service Discovery"页面中，您可以查看通过服务发现机制发现的目标。

### 4. 配置信息 (Configuration)

在"Status" > "Configuration"页面中，您可以查看当前加载的Prometheus配置文件内容。

### 5. 规则信息 (Rules)

在"Status" > "Rules"页面中，您可以查看配置的告警规则和记录规则。

## 三、常用PromQL查询示例

### 1. 基本指标查询

```
up
```
查询所有目标的在线状态。

### 2. 带条件的指标查询

```
up == 0
```
查询所有离线的目标。

### 3. 查询特定作业的指标

```
up{job="prometheus"}
```
查询作业名为"prometheus"的目标状态。

## 四、常见问题解决

### 1. 无法访问Web界面

- 检查Prometheus服务是否已启动：`docker-compose -f docker-compose.monitoring.yml ps`
- 检查端口占用情况：`netstat -tulpn | grep 9090`
- 检查防火墙设置是否阻止了9090端口访问

### 2. 查询结果为空

- 检查指标名称是否正确
- 检查标签过滤条件是否过于严格
- 检查目标是否正常运行

通过以上步骤，您可以有效地使用Prometheus Web界面进行监控和指标查询。