# Grafana 控制台使用说明

本文档介绍如何按照 `/d:/ide与cli/tool/codebase-index/docs/docker/codebase-index/` 中的配置打开和使用 Grafana 控制台。

## 一、打开 Grafana 控制台

根据 `docker-compose.monitoring.yml` 配置文件中的设置，Grafana 服务通过以下方式访问：

### 1. 确保监控服务已启动

在访问 Grafana 控制台之前，需要确保监控服务已经成功启动。按照项目部署文档，在 WSL 控制台中执行以下命令启动服务：

```bash
# 在 WSL 控制台中执行
cd /home/docker-compose/codebase-index/monitoring
docker-compose -f docker-compose.monitoring.yml up -d
```

### 2. 访问 Grafana 控制台

Grafana 服务配置在 3000 端口，您可以通过以下 URL 在浏览器中访问：
http://127.0.0.1:3000

## 二、登录 Grafana 控制台

根据配置文件中的设置，Grafana 的默认登录凭据为：

- **用户名**: admin
- **密码**: admin

首次登录后，系统会提示您修改默认密码以提高安全性。

## 三、Grafana 控制台基本功能

### 1. 主页概览

登录成功后，您将看到 Grafana 的主页，显示已配置的仪表盘概览、最近查看的内容和快速链接。

### 2. 导航菜单

左侧导航菜单包含以下主要功能区：

- **Dashboards**: 查看和管理仪表盘
- **Explore**: 数据探索功能
- **Alerting**: 告警管理
- **Configuration**: 系统配置（数据源、插件、用户等）

## 四、配置数据源

根据项目配置，Grafana 已经通过文件挂载方式预配置了 Prometheus 数据源：

```yaml
volumes:
  - ./grafana/provisioning:/etc/grafana/provisioning
  - ./grafana/dashboards:/etc/grafana/dashboards
```

如果需要手动添加或修改数据源，请按照以下步骤操作：

1. 点击左侧导航栏的 **Configuration** > **Data Sources**
2. 点击 **Add data source** 按钮
3. 选择 **Prometheus**
4. 在 URL 字段中输入 `http://prometheus:9090`
5. 点击 **Save & Test** 按钮验证连接

## 五、查看监控仪表盘

项目中已经预配置了监控仪表盘，您可以按照以下步骤查看：

1. 点击左侧导航栏的 **Dashboards** > **Browse**
2. 在仪表盘列表中找到并选择 `codebase-index-dashboard`
3. 您将看到系统的监控指标，包括：
   - Prometheus 监控数据
   - 系统资源使用情况
   - 应用程序性能指标

## 六、创建自定义仪表盘

如果需要创建自定义仪表盘，请按照以下步骤操作：

1. 点击左侧导航栏的 **+** 按钮 > **Dashboard**
2. 点击 **Add new panel** 添加图表
3. 选择数据源并配置查询语句
4. 调整图表样式和显示选项
5. 点击 **Save** 按钮保存仪表盘

## 七、管理用户和权限

Grafana 提供了完善的用户和权限管理功能：

1. 点击左侧导航栏的 **Server Admin** > **Users** 管理用户
2. 点击左侧导航栏的 **Configuration** > **Teams** 管理团队
3. 点击左侧导航栏的 **Configuration** > **Roles** 管理角色和权限

根据项目配置，新用户注册功能已被禁用：

```yaml
environment:
  - GF_USERS_ALLOW_SIGN_UP=false
```

## 八、Grafana 对 Qdrant 和 Nebula 的支持

根据项目文档，Grafana 对 Qdrant 和 Nebula 提供了以下支持：

### Qdrant 支持

- 存在 Grafana 插件，允许在配置用户界面中配置 Qdrant API 密钥
- 提供专门用于 Qdrant Cloud 的 Grafana 仪表板，用于可视化 Qdrant 数据库集群的性能和状态
- Qdrant 可以通过 Prometheus 和 Grafana 轻松配置集成以进行监控

### Nebula 支持

- GitHub 上存在名为 "nebula-dds-grafana-plugin" 的数据源插件
- 允许在 Grafana 中可视化发布在数据分发服务（DDS）数据总线上的数据
- 存在名为 "nebula-datasource" 的插件

## 九、常见问题解决

### 1. 无法访问 Grafana 控制台

- 检查监控服务是否已启动：`docker-compose -f docker-compose.monitoring.yml ps`
- 检查端口占用情况：`netstat -tulpn | grep 3000`
- 检查防火墙设置是否阻止了 3000 端口访问

### 2. 登录凭据无效

- 默认凭据为用户名 `admin` 和密码 `admin`
- 如果已修改密码，请使用修改后的凭据登录
- 如果忘记密码，可以通过以下命令重置：
  ```bash
docker exec -it grafana grafana-cli admin reset-admin-password 新密码
  ```

### 3. 无法查看监控数据

- 检查 Prometheus 服务是否正常运行：`docker-compose -f docker-compose.monitoring.yml logs prometheus`
- 检查数据源配置是否正确
- 检查查询语句是否正确

## 十、安全注意事项

1. 首次登录后请立即修改默认密码
2. 根据实际需求调整用户权限
3. 定期备份 Grafana 数据和配置
4. 考虑启用 HTTPS 以加密传输

通过以上步骤，您可以成功打开并使用 Grafana 控制台，监控和可视化 codebase-index 项目的各项指标。