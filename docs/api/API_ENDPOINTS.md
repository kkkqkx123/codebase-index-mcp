# API Endpoints Documentation

This document provides a summary of all available API endpoints in the codebase index project, along with their functionalities and the files where they are defined.

## 1. Snippet Management API (`/api/v1/snippets`)

Defined in: `src/api/routes/SnippetRoutes.ts`

### Endpoints:

1. **GET /search**
   - Description: Search for snippets
   - Parameters: 
     - `query` (required): Search query
     - `projectId`: Project ID to search within
     - `limit`: Maximum number of results to return
     - `offset`: Offset for pagination

2. **GET /:snippetId**
   - Description: Get snippet by ID
   - Parameters:
     - `snippetId` (path, required): Snippet ID
     - `projectId` (query, required): Project ID

3. **GET /status/:projectId**
   - Description: Get snippet processing status
   - Parameters:
     - `projectId` (path, required): Project ID

4. **POST /check-duplicates**
   - Description: Check for duplicate snippets
   - Body:
     - `content` (required): Snippet content to check
     - `projectId` (required): Project ID

5. **GET /:snippetId/references/:projectId**
   - Description: Detect cross-references between snippets
   - Parameters:
     - `snippetId` (path, required): Snippet ID
     - `projectId` (path, required): Project ID

6. **GET /:snippetId/dependencies/:projectId**
   - Description: Analyze snippet dependencies
   - Parameters:
     - `snippetId` (path, required): Snippet ID
     - `projectId` (path, required): Project ID

7. **GET /:snippetId/overlaps/:projectId**
   - Description: Detect overlapping snippets
   - Parameters:
     - `snippetId` (path, required): Snippet ID
     - `projectId` (path, required): Project ID

8. **POST /**
   - Description: Index a new snippet
   - Body:
     - `snippet` (required): Snippet data to index

9. **PUT /:snippetId**
   - Description: Update an existing snippet
   - Parameters:
     - `snippetId` (path, required): Snippet ID
   - Body:
     - `snippet` (required): Updated snippet data

10. **DELETE /:snippetId**
    - Description: Delete a snippet
    - Parameters:
      - `snippetId` (path, required): Snippet ID

## 2. Static Analysis API (`/api/v1/analysis`)

Defined in: `src/api/routes/StaticAnalysisRoutes.ts`

### Endpoints:

1. **POST /scan/project**
   - Description: Scan a project for static analysis
   - Body:
     - `projectPath` (required): Path to the project to scan
     - `options`: Scan options

2. **GET /scan/status/:taskId**
   - Description: Get scan task status
   - Parameters:
     - `taskId` (path, required): Task ID

3. **GET /scan/history/:projectPath**
   - Description: Get project scan history
   - Parameters:
     - `projectPath` (path, required): Project path

4. **GET /rules**
   - Description: Get available rules for static analysis

5. **POST /rules/validate**
   - Description: Validate a rule
   - Body:
     - `rule` (required): Rule to validate

6. **POST /rules/custom**
   - Description: Add a custom rule
   - Body:
     - `rule` (required): Custom rule to add

7. **GET /rules/templates**
   - Description: Get rule templates

8. **GET /findings/:projectPath**
   - Description: Get findings for a project
   - Parameters:
     - `projectPath` (path, required): Project path
   - Query:
     - `severity`: Filter by severity
     - `ruleId`: Filter by rule ID
     - `file`: Filter by file

9. **GET /summary/:projectPath**
   - Description: Get project summary
   - Parameters:
     - `projectPath` (path, required): Project path

10. **GET /system/status**
    - Description: Get system status

11. **POST /system/cleanup**
    - Description: Cleanup old data
    - Body:
      - `retentionDays`: Number of days to retain data (default: 30)

## 3. Monitoring API (`/api/v1/monitoring`)

Defined in: `src/api/routes/MonitoringRoutes.ts`

*Note: These routes are currently disabled in the main HTTP server due to Prometheus dependencies.*

### Endpoints:

1. **GET /health**
   - Description: Get system health status

2. **GET /metrics**
   - Description: Get system metrics

3. **GET /performance**
   - Description: Get performance report
   - Query:
     - `start`: Start date (ISO format)
     - `end`: End date (ISO format)

4. **GET /bottlenecks**
   - Description: Get system bottlenecks

5. **GET /capacity**
   - Description: Get capacity plan

6. **GET /dependencies**
   - Description: Get system dependencies

7. **GET /benchmark**
   - Description: Get benchmark results

## 4. Root Endpoint

Defined in: `src/api/HttpServer.ts`

### Endpoint:

1. **GET /**
   - Description: Root endpoint providing API information
   - Response:
     - `message`: Service name
     - `version`: API version
     - `documentation`: Documentation path

## Error Handling

Defined in: `src/api/HttpServer.ts`

The API includes error handling middleware that:
- Handles 404 errors for undefined routes
- Provides global error handling with detailed logging
- Returns appropriate HTTP status codes and error messages