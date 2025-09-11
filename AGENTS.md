# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Development
- `npm run build` - Compile TypeScript to dist/
- `npm run dev` - Run in development mode with ts-node
- `npm start` - Start the compiled application from dist/
- `npm run clean` - Clean dist and coverage directories

### Code Quality
- `npm run lint` - Run ESLint on all TypeScript files
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run typecheck` - Run TypeScript type checking without emitting files
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting with Prettier
- `semgrep --validate --config=<rule-path>` - Validate semgrep rule configuration
- `semgrep --config=<rule-path> <target-path>` - Run semgrep rules against target files

**Note**: When adding new semgrep rules, ensure to test the rules for effectiveness using the validation and testing commands provided above.

**Warning**: Semgrep may have issues with files containing non-ASCII characters on Windows systems. If you encounter encoding errors, ensure your rule files are saved in UTF-8 format and consider translating any non-English text in messege part to English.

### Testing
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `node test/enhanced-semgrep/rule-validation.js` - Validate enhanced semgrep rules

### Docker Operations
- `npm run docker:build` - Build Docker image
- `npm run docker:dev` - Start development environment with Docker Compose
- `npm run docker:prod` - Start production environment with Docker Compose

### Git Hooks
- Pre-commit: Runs lint-staged (ESLint + Prettier)
- Pre-push: Runs lint, typecheck, and tests

## Architecture Overview

This is an MCP (Model Context Protocol) service for intelligent codebase indexing and analysis. The system uses a dual-database architecture:

### Core Components

**Dependency Injection**: Uses InversifyJS with modular organization:
- Core module: Config, logging, error handling
- Database module: Qdrant (vector) + Neo4j (graph) connections
- Embedder module: Multi-provider embedding services
- Service module: Business logic services
- Sync module: Cross-database synchronization

**Key Services**:
- `IndexService` - Main indexing orchestrator (refactored to use IndexCoordinator)
- `IndexCoordinator` - Coordinates indexing operations across multiple services
- `GraphService` - Code relationship analysis
- `ParserService` - Tree-sitter based code parsing
- `EmbedderFactory` - Multi-provider embedding (OpenAI, Ollama, Gemini, Mistral)
- `VectorStorageService` - Qdrant operations with path segment indexing
- `GraphPersistenceService` - Neo4j operations

**Database Architecture**:
- **Qdrant**: Vector storage for semantic search with path segment indexing
- **NebulaGraph**: Graph database for code relationships and call analysis
- **Synchronization**: Entity ID management, transaction coordination, consistency checking

### MCP Protocol Integration

The service exposes MCP tools:
- `codebase.index.create` - Create new codebase index
- `codebase.index.search` - Search indexed codebase
- `codebase.graph.analyze` - Analyze code structure and relationships
- `codebase.status.get` - Get indexing status

The indexing functionality has been refactored to use a coordinator pattern:
- `IndexService` acts as the main interface for indexing operations
- `IndexCoordinator` handles the coordination of complex indexing workflows
- This separation of concerns improves maintainability and testability

### Code Parsing Strategy

Uses Tree-sitter for syntax-aware parsing with support for:
- TypeScript, JavaScript, Python, Java, Go, Rust, C/C++, Markdown
- Smart chunking based on AST structure
- Hash-based deduplication to avoid processing duplicate content
- Language-specific rule processing

### File Structure Conventions

- All services are singleton-scoped via DI container
- Services organized by domain in `src/services/`
- Database clients wrapped for connection management
- Embedders follow factory pattern for provider abstraction
- Types organized by domain in `src/models/`

## Environment Setup

### Prerequisites
- Node.js 18.0.0+
- Docker Desktop 4.0.0+ (for database services)
- 16GB RAM recommended for production workloads

### Development Setup
1. Start databases: `docker-compose up -d`
2. Install dependencies: `npm install`
3. Configure environment: Copy `.env.example` to `.env`
4. Run development: `npm run dev`

### Key Configuration
- Database connections (Qdrant: http://localhost:6333, Neo4j: bolt://localhost:7687)
- Embedding provider selection via `EMBEDDER_PROVIDER` environment variable
- MCP server configuration for protocol communication

## Code Style and Patterns

### TypeScript Configuration
- Strict mode enabled with comprehensive type checking
- ES2022 target with CommonJS modules
- Decorators enabled for dependency injection
- Source maps and declaration files generated

### ESLint Rules
- TypeScript-specific rules with type checking
- No explicit `any` types (warned)
- Explicit function return types encouraged
- No floating promises
- Prefer const over let

### Prettier Configuration
- Semi-colons, trailing commas (ES5)
- Single quotes, 100 character line width
- 2-space indentation, LF line endings

## Testing Strategy

### Test Structure
- Unit tests: `test/unit/`
- Integration tests: `test/integration/`
- E2E tests: `test/e2e/`
- Performance tests: `test/performance/`

### Jest Configuration
- ts-jest preset with Node.js environment
- Coverage collection from all src files (excluding main.ts)
- Setup files for test environment configuration

## Performance Considerations

### Indexing Performance
- Target: >500 files/minute processing speed
- Memory usage: <400MB baseline
- Hash-based deduplication to avoid reprocessing
- Path segment indexing for efficient filtering

### Search Performance
- Target: <200ms response time (P95)
- Multi-stage reranking: semantic → graph → code features
- Vector similarity combined with graph relationships
- Dynamic weight adjustment based on query context

### Database Optimization
- Connection pooling for both Qdrant and Neo4j
- Batch operations for vector storage and graph imports
- Smart caching strategies for repeated queries

## Error Handling Patterns

### Unified Error Handling
- Centralized error handling service
- Error categorization (network, database, API, etc.)
- Intelligent retry mechanisms with exponential backoff
- Comprehensive error context collection

### Monitoring and Health
- Prometheus metrics collection
- Health check endpoints for all components
- Structured logging with correlation IDs
- Alert system for critical failures

## Docker Deployment

### Development Environment
- Uses `docker-compose.dev.yml` for development databases
- Hot-reload capable with volume mounts
- Debug ports exposed for development tools

### Production Deployment
- Uses `docker-compose.yml` for production
- Optimized builds with multi-stage Dockerfiles
- Resource limits and health checks configured