# Embedding API Suffix Filling Logic

This document explains how the embedding models construct their API endpoints and the logic behind filling API suffixes.

## Overview

The embedding service supports multiple providers (OpenAI, Ollama, Gemini, Mistral) and allows customization of the base URLs through environment variables. The system follows a priority order where environment variables take precedence over hardcoded defaults.

## API Endpoint Construction

Each embedding provider constructs its API endpoints using the following logic:

### 1. Base URL Priority Order

1. **Environment Variable**: If defined in `.env` file (e.g., `OPENAI_BASE_URL`, `GEMINI_BASE_URL`, etc.)
2. **Default Value**: Hardcoded fallback values in the embedder implementations

### 2. Endpoint Construction

Each provider appends specific paths to their base URL:

#### OpenAI
- **Default Base URL**: `https://api.openai.com`
- **Embeddings Endpoint**: `{baseURL}/v1/embeddings`
- **Models Endpoint**: `{baseURL}/v1/models`

#### Ollama
- **Default Base URL**: `http://localhost:11434`
- **Embeddings Endpoint**: `{baseURL}/api/embeddings`

#### Gemini
- **Default Base URL**: `https://generativelanguage.googleapis.com`
- **Embeddings Endpoint**: `{baseURL}/v1beta/models/{model}:embedContent?key={apiKey}`
- **Models Endpoint**: `{baseURL}/v1beta/models?key={apiKey}`

#### Mistral
- **Default Base URL**: `https://api.mistral.ai`
- **Embeddings Endpoint**: `{baseURL}/v1/embeddings`
- **Models Endpoint**: `{baseURL}/v1/models`

## Environment Variables

The following environment variables can be set in the `.env` file to customize the base URLs:

```env
# OpenAI
OPENAI_BASE_URL=https://api.openai.com

# Ollama
OLLAMA_BASE_URL=http://localhost:11434

# Gemini
GEMINI_BASE_URL=https://generativelanguage.googleapis.com

# Mistral
MISTRAL_BASE_URL=https://api.mistral.ai
```

## Implementation Details

The base URL resolution is implemented in each embedder class through a `getBaseUrl()` method that:

1. Retrieves the configuration from `ConfigService`
2. Checks for the provider-specific base URL in the configuration
3. Returns the environment variable value if set
4. Falls back to the hardcoded default if no environment variable is set

### Example Implementation (OpenAI)

```typescript
private getBaseUrl(): string {
  const config = this.configService.get('embedding');
  return config.openai.baseUrl || 'https://api.openai.com';
}
```

## Usage Examples

### Using Custom OpenAI Endpoint

To use a custom OpenAI-compatible endpoint:

```env
OPENAI_BASE_URL=https://your-custom-openai-endpoint.com
OPENAI_API_KEY=your-api-key
```

### Using Ollama with Custom Port

To use Ollama running on a different port:

```env
OLLAMA_BASE_URL=http://localhost:11435
```

### Using Gemini with Custom Endpoint

To use a custom Gemini-compatible endpoint:

```env
GEMINI_BASE_URL=https://your-custom-gemini-endpoint.com
GEMINI_API_KEY=your-api-key
```

## Priority Verification

The system ensures that environment variables take precedence over hardcoded defaults:

1. Application starts and loads `.env` file
2. `ConfigService` reads environment variables
3. Each embedder retrieves its base URL through the configuration
4. If environment variable is set, it's used; otherwise, the default is used

This approach allows for flexible deployment configurations while maintaining sensible defaults.