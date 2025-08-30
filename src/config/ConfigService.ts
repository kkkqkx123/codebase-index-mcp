import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const configSchema = Joi.object({
  nodeEnv: Joi.string().trim().valid('development', 'production', 'test').default('development'),
  port: Joi.number().port().default(3000),
  
  qdrant: Joi.object({
    host: Joi.string().hostname().default('localhost'),
    port: Joi.number().port().default(6333),
    collection: Joi.string().default('code-snippets')
  }),
  
  nebula: Joi.object({
    host: Joi.string().hostname().default('localhost'),
    port: Joi.number().port().default(9669),
    username: Joi.string().default('root'),
    password: Joi.string().default('nebula'),
    space: Joi.string().default('codegraph')
  }),
  
  embedding: Joi.object({
    provider: Joi.string().valid('openai', 'ollama', 'gemini', 'mistral', 'siliconflow', 'custom1', 'custom2', 'custom3').default('openai'),
    openai: Joi.object({
      apiKey: Joi.string().required(),
      baseUrl: Joi.string().uri().optional(),
      model: Joi.string().default('text-embedding-ada-002')
    }),
    ollama: Joi.object({
      baseUrl: Joi.string().uri().default('http://localhost:11434'),
      model: Joi.string().default('nomic-embed-text')
    }),
    gemini: Joi.object({
      apiKey: Joi.string().required(),
      baseUrl: Joi.string().uri().optional(),
      model: Joi.string().default('embedding-001')
    }),
    mistral: Joi.object({
      apiKey: Joi.string().required(),
      baseUrl: Joi.string().uri().optional(),
      model: Joi.string().default('mistral-embed')
    }),
    siliconflow: Joi.object({
      apiKey: Joi.string().required(),
      baseUrl: Joi.string().uri().optional(),
      model: Joi.string().default('BAAI/bge-large-en-v1.5')
    }),
    custom: Joi.object({
      custom1: Joi.object({
        apiKey: Joi.string().optional(),
        baseUrl: Joi.string().uri().optional(),
        model: Joi.string().optional()
      }),
      custom2: Joi.object({
        apiKey: Joi.string().optional(),
        baseUrl: Joi.string().uri().optional(),
        model: Joi.string().optional()
      }),
      custom3: Joi.object({
        apiKey: Joi.string().optional(),
        baseUrl: Joi.string().uri().optional(),
        model: Joi.string().optional()
      })
    }).optional(),
    dimensionRules: Joi.object().pattern(Joi.string(), Joi.number()).optional(),
    qualityWeight: Joi.number().min(0).max(1).default(0.7),
    performanceWeight: Joi.number().min(0).max(1).default(0.3)
  }),
  
  logging: Joi.object({
    level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
    format: Joi.string().valid('json', 'text').default('json')
  }),
  
  monitoring: Joi.object({
    enabled: Joi.boolean().default(true),
    port: Joi.number().port().default(9090)
  }),
  
  fileProcessing: Joi.object({
    maxFileSize: Joi.number().positive().default(10485760),
    supportedExtensions: Joi.string().default('.ts,.js,.py,.java,.go,.rs,.cpp,.c,.h'),
    indexBatchSize: Joi.number().positive().default(100),
    chunkSize: Joi.number().positive().default(1000),
    overlapSize: Joi.number().positive().default(200)
  }),
  
  batchProcessing: Joi.object({
    enabled: Joi.boolean().default(true),
    maxConcurrentOperations: Joi.number().positive().default(5),
    defaultBatchSize: Joi.number().positive().default(50),
    maxBatchSize: Joi.number().positive().default(500),
    memoryThreshold: Joi.number().positive().default(80), // percentage
    processingTimeout: Joi.number().positive().default(300000), // 5 minutes
    retryAttempts: Joi.number().positive().default(3),
    retryDelay: Joi.number().positive().default(1000), // 1 second
    continueOnError: Joi.boolean().default(true),
    adaptiveBatching: Joi.object({
      enabled: Joi.boolean().default(true),
      minBatchSize: Joi.number().positive().default(10),
      maxBatchSize: Joi.number().positive().default(200),
      performanceThreshold: Joi.number().positive().default(1000), // ms
      adjustmentFactor: Joi.number().positive().default(1.2)
    }),
    monitoring: Joi.object({
      enabled: Joi.boolean().default(true),
      metricsInterval: Joi.number().positive().default(60000), // 1 minute
      alertThresholds: Joi.object({
        highLatency: Joi.number().positive().default(5000), // ms
        lowThroughput: Joi.number().positive().default(10), // operations/sec
        highErrorRate: Joi.number().positive().default(0.1), // 10%
        highMemoryUsage: Joi.number().positive().default(80), // percentage
        criticalMemoryUsage: Joi.number().positive().default(90), // percentage
        highCpuUsage: Joi.number().positive().default(70), // percentage
        criticalCpuUsage: Joi.number().positive().default(85) // percentage
      })
    })
  }),
  mlReranking: Joi.object({
    modelPath: Joi.string().optional(),
    modelType: Joi.string().valid('linear', 'neural', 'ensemble').default('linear'),
    features: Joi.array().items(Joi.string()).default([
      'semanticScore',
      'graphScore',
      'contextualScore',
      'recencyScore',
      'popularityScore',
      'originalScore'
    ]),
    trainingEnabled: Joi.boolean().default(true)
  }).optional(),
  
  caching: Joi.object({
    defaultTTL: Joi.number().positive().default(300), // 5 minutes
    maxSize: Joi.number().positive().default(1000)
  }).optional(),
  
  indexing: Joi.object({
    batchSize: Joi.number().positive().default(50),
    maxConcurrency: Joi.number().positive().default(3)
  })
});

export interface Config {
  nodeEnv: string;
  port: number;
  qdrant: {
    host: string;
    port: number;
    collection: string;
  };
  nebula: {
    host: string;
    port: number;
    username: string;
    password: string;
    space: string;
  };
  embedding: {
    provider: string;
    openai: {
      apiKey: string;
      baseUrl?: string;
      model: string;
    };
    ollama: {
      baseUrl: string;
      model: string;
    };
    gemini: {
      apiKey: string;
      baseUrl?: string;
      model: string;
    };
    mistral: {
      apiKey: string;
      baseUrl?: string;
      model: string;
    };
    siliconflow: {
      apiKey: string;
      baseUrl?: string;
      model: string;
    };
    custom?: {
      custom1?: {
        apiKey?: string;
        baseUrl?: string;
        model?: string;
      };
      custom2?: {
        apiKey?: string;
        baseUrl?: string;
        model?: string;
      };
      custom3?: {
        apiKey?: string;
        baseUrl?: string;
        model?: string;
      };
    };
    dimensionRules?: { [key: string]: number };
    qualityWeight?: number;
    performanceWeight?: number;
  };
  logging: {
    level: string;
    format: string;
  };
  monitoring: {
    enabled: boolean;
    port: number;
  };
  fileProcessing: {
    maxFileSize: number;
    supportedExtensions: string;
    indexBatchSize: number;
    chunkSize: number;
    overlapSize: number;
  };
  batchProcessing: {
    enabled: boolean;
    maxConcurrentOperations: number;
    defaultBatchSize: number;
    maxBatchSize: number;
    memoryThreshold: number;
    processingTimeout: number;
    retryAttempts: number;
    retryDelay: number;
    continueOnError: boolean;
    adaptiveBatching: {
      enabled: boolean;
      minBatchSize: number;
      maxBatchSize: number;
      performanceThreshold: number;
      adjustmentFactor: number;
    };
    monitoring: {
      enabled: boolean;
      metricsInterval: number;
      alertThresholds: {
        highLatency: number;
        lowThroughput: number;
        highErrorRate: number;
        highMemoryUsage: number;
        criticalMemoryUsage: number;
        highCpuUsage: number;
        criticalCpuUsage: number;
      };
    };
  };
  mlReranking?: {
    modelPath?: string;
    modelType: 'linear' | 'neural' | 'ensemble';
    features: string[];
    trainingEnabled: boolean;
  };
  caching: {
    defaultTTL: number;
    maxSize: number;
  };
  indexing: {
    batchSize: number;
    maxConcurrency: number;
  };
  performance?: {
    cleanupInterval?: number;
    retentionPeriod?: number;
  };
  cache?: {
    ttl?: number;
    maxEntries?: number;
    cleanupInterval?: number;
  };
  fusion?: {
    vectorWeight?: number;
    graphWeight?: number;
    contextualWeight?: number;
    recencyWeight?: number;
    popularityWeight?: number;
  };
}

export class ConfigService {
  private static instance: ConfigService;
  private config: Config;

  private constructor() {
    const rawConfig = {
      nodeEnv: process.env.NODE_ENV,
      port: parseInt(process.env.PORT || '3000'),
      qdrant: {
        host: process.env.QDRANT_HOST,
        port: parseInt(process.env.QDRANT_PORT || '6333'),
        collection: process.env.QDRANT_COLLECTION
      },
      nebula: {
        host: process.env.NEBULA_HOST,
        port: parseInt(process.env.NEBULA_PORT || '9669'),
        username: process.env.NEBULA_USERNAME,
        password: process.env.NEBULA_PASSWORD,
        space: process.env.NEBULA_SPACE
      },
      embedding: {
        provider: process.env.EMBEDDING_PROVIDER,
        openai: {
          apiKey: process.env.OPENAI_API_KEY,
          baseUrl: process.env.OPENAI_BASE_URL,
          model: process.env.OPENAI_MODEL
        },
        ollama: {
          baseUrl: process.env.OLLAMA_BASE_URL,
          model: process.env.OLLAMA_MODEL
        },
        gemini: {
          apiKey: process.env.GEMINI_API_KEY,
          baseUrl: process.env.GEMINI_BASE_URL,
          model: process.env.GEMINI_MODEL
        },
        mistral: {
          apiKey: process.env.MISTRAL_API_KEY,
          baseUrl: process.env.MISTRAL_BASE_URL,
          model: process.env.MISTRAL_MODEL
        },
        siliconflow: {
          apiKey: process.env.SILICONFLOW_API_KEY,
          baseUrl: process.env.SILICONFLOW_BASE_URL,
          model: process.env.SILICONFLOW_MODEL
        },
        custom: {
          custom1: {
            apiKey: process.env.CUSTOM_CUSTOM1_API_KEY,
            baseUrl: process.env.CUSTOM_CUSTOM1_BASE_URL,
            model: process.env.CUSTOM_CUSTOM1_MODEL
          },
          custom2: {
            apiKey: process.env.CUSTOM_CUSTOM2_API_KEY,
            baseUrl: process.env.CUSTOM_CUSTOM2_BASE_URL,
            model: process.env.CUSTOM_CUSTOM2_MODEL
          },
          custom3: {
            apiKey: process.env.CUSTOM_CUSTOM3_API_KEY,
            baseUrl: process.env.CUSTOM_CUSTOM3_BASE_URL,
            model: process.env.CUSTOM_CUSTOM3_MODEL
          }
        },
        qualityWeight: process.env.QUALITY_WEIGHT ? parseFloat(process.env.QUALITY_WEIGHT) : undefined,
        performanceWeight: process.env.PERFORMANCE_WEIGHT ? parseFloat(process.env.PERFORMANCE_WEIGHT) : undefined
      },
      logging: {
        level: process.env.LOG_LEVEL,
        format: process.env.LOG_FORMAT
      },
      monitoring: {
        enabled: process.env.ENABLE_METRICS === 'true',
        port: parseInt(process.env.METRICS_PORT || '9090')
      },
      fileProcessing: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'),
        supportedExtensions: process.env.SUPPORTED_EXTENSIONS,
        indexBatchSize: parseInt(process.env.INDEX_BATCH_SIZE || '100'),
        chunkSize: parseInt(process.env.CHUNK_SIZE || '1000'),
        overlapSize: parseInt(process.env.OVERLAP_SIZE || '200')
      },
      batchProcessing: {
        enabled: process.env.BATCH_PROCESSING_ENABLED !== 'false',
        maxConcurrentOperations: parseInt(process.env.MAX_CONCURRENT_OPERATIONS || '5'),
        defaultBatchSize: parseInt(process.env.DEFAULT_BATCH_SIZE || '50'),
        maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || '500'),
        memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD || '80'),
        processingTimeout: parseInt(process.env.PROCESSING_TIMEOUT || '300000'),
        retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
        retryDelay: parseInt(process.env.RETRY_DELAY || '1000'),
        continueOnError: process.env.CONTINUE_ON_ERROR !== 'false',
        adaptiveBatching: {
          enabled: process.env.ADAPTIVE_BATCHING_ENABLED !== 'false',
          minBatchSize: parseInt(process.env.MIN_BATCH_SIZE || '10'),
          maxBatchSize: parseInt(process.env.ADAPTIVE_MAX_BATCH_SIZE || '200'),
          performanceThreshold: parseInt(process.env.PERFORMANCE_THRESHOLD || '1000'),
          adjustmentFactor: parseFloat(process.env.ADJUSTMENT_FACTOR || '1.2')
        },
        monitoring: {
          enabled: process.env.BATCH_MONITORING_ENABLED !== 'false',
          metricsInterval: parseInt(process.env.METRICS_INTERVAL || '60000'),
          alertThresholds: {
            highLatency: parseInt(process.env.HIGH_LATENCY_THRESHOLD || '5000'),
            lowThroughput: parseInt(process.env.LOW_THROUGHPUT_THRESHOLD || '10'),
            highErrorRate: parseFloat(process.env.HIGH_ERROR_RATE_THRESHOLD || '0.1'),
            highMemoryUsage: parseInt(process.env.HIGH_MEMORY_USAGE_THRESHOLD || '80'),
            criticalMemoryUsage: parseInt(process.env.CRITICAL_MEMORY_USAGE_THRESHOLD || '90'),
            highCpuUsage: parseInt(process.env.HIGH_CPU_USAGE_THRESHOLD || '70'),
            criticalCpuUsage: parseInt(process.env.CRITICAL_CPU_USAGE_THRESHOLD || '85')
          }
        }
      },
      caching: process.env.CACHE_DEFAULT_TTL || process.env.CACHE_MAX_SIZE ? {
        defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '300'),
        maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000')
      } : undefined,
      indexing: {
        batchSize: parseInt(process.env.INDEXING_BATCH_SIZE || '50'),
        maxConcurrency: parseInt(process.env.INDEXING_MAX_CONCURRENCY || '3')
      },
      mlReranking: process.env.ML_RERANKING_MODEL_PATH || process.env.ML_RERANKING_MODEL_TYPE || process.env.ML_RERANKING_FEATURES || process.env.ML_RERANKING_TRAINING_ENABLED ? {
      modelPath: process.env.ML_RERANKING_MODEL_PATH || undefined,
      modelType: (process.env.ML_RERANKING_MODEL_TYPE as 'linear' | 'neural' | 'ensemble') || 'linear',
      features: process.env.ML_RERANKING_FEATURES ? process.env.ML_RERANKING_FEATURES.split(',') : [
        'semanticScore',
        'graphScore',
        'contextualScore',
        'recencyScore',
        'popularityScore',
        'originalScore'
      ],
      trainingEnabled: process.env.ML_RERANKING_TRAINING_ENABLED !== 'false'
    } : undefined
    };

    const { error, value } = configSchema.validate(rawConfig, { allowUnknown: false });
    
    if (error) {
      throw new Error(`Configuration validation error: ${error.message}`);
    }

    this.config = value;
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  getAll(): Config {
    return { ...this.config };
  }
}