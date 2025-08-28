import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const configSchema = Joi.object({
  nodeEnv: Joi.string().valid('development', 'production', 'test').default('development'),
  port: Joi.number().port().default(3000),
  
  qdrant: Joi.object({
    host: Joi.string().hostname().default('localhost'),
    port: Joi.number().port().default(6333),
    collection: Joi.string().default('code-snippets')
  }),
  
  neo4j: Joi.object({
    uri: Joi.string().uri().default('bolt://localhost:7687'),
    username: Joi.string().default('neo4j'),
    password: Joi.string().default('password'),
    database: Joi.string().default('codegraph')
  }),
  
  embedding: Joi.object({
    provider: Joi.string().valid('openai', 'ollama', 'gemini', 'mistral').default('openai'),
    openai: Joi.object({
      apiKey: Joi.string().required(),
      model: Joi.string().default('text-embedding-ada-002')
    }),
    ollama: Joi.object({
      baseUrl: Joi.string().uri().default('http://localhost:11434'),
      model: Joi.string().default('nomic-embed-text')
    }),
    gemini: Joi.object({
      apiKey: Joi.string().required(),
      model: Joi.string().default('embedding-001')
    }),
    mistral: Joi.object({
      apiKey: Joi.string().required(),
      model: Joi.string().default('mistral-embed')
    })
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
  neo4j: {
    uri: string;
    username: string;
    password: string;
    database: string;
  };
  embedding: {
    provider: string;
    openai: {
      apiKey: string;
      model: string;
    };
    ollama: {
      baseUrl: string;
      model: string;
    };
    gemini: {
      apiKey: string;
      model: string;
    };
    mistral: {
      apiKey: string;
      model: string;
    };
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
      neo4j: {
        uri: process.env.NEO4J_URI,
        username: process.env.NEO4J_USERNAME,
        password: process.env.NEO4J_PASSWORD,
        database: process.env.NEO4J_DATABASE
      },
      embedding: {
        provider: process.env.EMBEDDING_PROVIDER,
        openai: {
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL
        },
        ollama: {
          baseUrl: process.env.OLLAMA_BASE_URL,
          model: process.env.OLLAMA_MODEL
        },
        gemini: {
          apiKey: process.env.GEMINI_API_KEY,
          model: process.env.GEMINI_MODEL
        },
        mistral: {
          apiKey: process.env.MISTRAL_API_KEY,
          model: process.env.MISTRAL_MODEL
        }
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
      }
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