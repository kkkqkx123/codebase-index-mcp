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

## 4. Codebase Indexing API (`/api/v1/indexing`)

Defined in: `src/api/routes/IndexingRoutes.ts`

### Endpoints:

1. **POST /create**
   - Description: Create new codebase index
   - Body:
     - `projectPath` (required): Path to the project to index
     - `options` (optional): Indexing options including recursive, includePatterns, excludePatterns, maxFileSize, chunkSize, overlapSize

2. **POST /:projectId**
   - Description: Index specific project
   - Parameters:
     - `projectId` (path, required): Project ID
   - Body:
     - Indexing options

3. **GET /status/:projectId**
   - Description: Get indexing status
   - Parameters:
     - `projectId` (path, required): Project ID

4. **GET /projects**
   - Description: List all indexed projects

5. **DELETE /:projectId**
   - Description: Remove project index
   - Parameters:
     - `projectId` (path, required): Project ID

6. **POST /search**
   - Description: Search indexed codebase
   - Body:
     - `query` (required): Search query
     - `projectId` (required): Project ID
     - `limit` (optional): Result limit
     - `threshold` (optional): Similarity threshold
     - `filters` (optional): Search filters
     - `searchType` (optional): 'semantic' | 'keyword' | 'hybrid' | 'snippet'

## 5. Search API (`/api/v1/search`)

Defined in: `src/api/routes/SearchRoutes.ts`

### Endpoints:

1. **POST /hybrid**
   - Description: Hybrid semantic + keyword search
   - Body:
     - `query` (required): Search query
     - `projectId` (required): Project ID
     - `limit` (optional): Result limit
     - `threshold` (optional): Similarity threshold
     - `filters` (optional): Search filters
     - `weights` (optional): Search strategy weights
     - `searchStrategies` (optional): Search strategies to use

2. **POST /semantic**
   - Description: Pure semantic search
   - Body:
     - `query` (required): Search query
     - `projectId` (required): Project ID
     - `limit` (optional): Result limit
     - `threshold` (optional): Similarity threshold
     - `filters` (optional): Search filters

3. **POST /keyword**
   - Description: Keyword-based search
   - Body:
     - `query` (required): Search query
     - `projectId` (required): Project ID
     - `limit` (optional): Result limit
     - `threshold` (optional): Similarity threshold
     - `filters` (optional): Search filters
     - `fuzzy` (optional): Enable fuzzy matching

4. **GET /suggest**
   - Description: Search suggestions
   - Query:
     - `query` (required): Search query
     - `projectId` (required): Project ID
     - `limit` (optional): Suggestion limit
     - `filters` (optional): Suggestion filters

5. **GET /history**
   - Description: Search history
   - Query:
     - `projectId` (required): Project ID
     - `limit` (optional): History limit

6. **POST /advanced**
   - Description: Advanced search with multiple strategies
   - Body:
     - Advanced search parameters

## 7. Graph Analysis API (`/api/v1/graph`)

Defined in: `src/api/routes/GraphAnalysisRoutes.ts`

### Endpoints:

1. **POST /analyze**
   - Description: Analyze codebase structure and relationships
   - Body:
     - `projectId` (required): Project ID to analyze
     - `options` (optional): Analysis options including depth, focus, includeExternal

2. **POST /query**
   - Description: Execute custom graph queries
   - Body:
     - `query` (required): Graph query string
     - `projectId` (required): Project ID

3. **POST /dependencies**
   - Description: Find dependencies for a specific file
   - Body:
     - `filePath` (required): Path to the file
     - `projectId` (required): Project ID
     - `includeTransitive` (optional, default: true): Include transitive dependencies
     - `includeCircular` (optional, default: true): Include circular dependencies

4. **POST /callgraph**
   - Description: Get call graph for a function
   - Body:
     - `functionName` (required): Function name to analyze
     - `projectId` (required): Project ID
     - `depth` (optional, default: 3): Analysis depth

5. **GET /overview/:projectId**
   - Description: Get project graph overview
   - Parameters:
     - `projectId` (path, required): Project ID

6. **GET /circular/:projectId**
   - Description: Find circular dependencies in project
   - Parameters:
     - `projectId` (path, required): Project ID

7. **GET /metrics/:projectId**
   - Description: Get graph metrics for project
   - Parameters:
     - `projectId` (path, required): Project ID

8. **POST /impact**
   - Description: Find nodes impacted by changes to specified nodes
   - Body:
     - `nodeIds` (required): Array of node IDs to analyze
     - `projectId` (required): Project ID
     - `depth` (optional, default: 2): Impact analysis depth

## 8. File System API (`/api/v1/filesystem`)

Defined in: `src/api/routes/FileSystemRoutes.ts`

### Endpoints:

1. **POST /traverse**
   - Description: Traverse directory and collect file information
   - Body:
     - `rootPath` (required): Root directory path to traverse
     - `options` (optional): Traversal options including patterns, maxFileSize, etc.

2. **POST /content**
   - Description: Get file content
   - Body:
     - `filePath` (required): Path to the file
     - `projectId` (optional): Project ID
     - `encoding` (optional, default: utf8): File encoding

3. **POST /watch/start**
   - Description: Start file watcher for project paths
   - Body:
     - `projectId` (required): Project ID
     - `paths` (required): Array of paths to watch
     - `options` (optional): Watcher options

4. **POST /watch/stop**
   - Description: Stop file watcher for project
   - Body:
     - `projectId` (required): Project ID

5. **GET /watch/status/:projectId**
   - Description: Get file watcher status
   - Parameters:
     - `projectId` (path, required): Project ID

6. **POST /search**
   - Description: Search files by pattern
   - Body:
     - `rootPath` (required): Root directory to search in
     - `pattern` (required): Search pattern
     - `options` (optional): Search options including caseSensitive, maxResults, etc.

7. **POST /analyze**
   - Description: Analyze directory structure and statistics
   - Body:
     - `rootPath` (required): Root directory to analyze
     - `options` (optional): Analysis options including includeStats, includeStructure, etc.

8. **GET /info/:filePath(*)**
   - Description: Get file information
   - Parameters:
     - `filePath` (path, required): File path

9. **GET /list/:dirPath(*)**
   - Description: List directory contents
   - Parameters:
     - `dirPath` (path, required): Directory path

10. **GET /exists/:path(*)**
    - Description: Check if path exists
    - Parameters:
      - `path` (path, required): Path to check

## 9. Root Endpoint

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