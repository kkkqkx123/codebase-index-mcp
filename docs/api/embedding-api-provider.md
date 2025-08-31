  1. Embedder 读取的是 .env 还是 .env.example？

  读取的是 .env 文件。从 ConfigService.ts:308-447 可以看到：

  private constructor() {
    const rawConfig = {
      // ... 其他配置
      embedding: {
        provider: process.env.EMBEDDING_PROVIDER,  // 从 .env 读取
        openai: {
          apiKey: process.env.OPENAI_API_KEY,      // 从 .env 读取
          dimensions: parseInt(process.env.OPENAI_DIMENSIONS || '1536')  // 从 .env 读取
        }
        // ... 其他provider配置
      }
    };
  }

  dotenv.config() 在 ConfigService.ts:5 会自动加载 .env 文件到 process.env 中。

  2. 如何选择使用哪个 provider？

  通过 EMBEDDING_PROVIDER 环境变量选择：

  // ConfigService.ts:325
  provider: process.env.EMBEDDING_PROVIDER,

  选择流程：

  1. 环境变量设置：
  EMBEDDING_PROVIDER=openai  # 或 ollama, gemini, mistral, siliconflow
  2. EmbedderFactory 逻辑：
  // EmbedderFactory.ts:50-52
  async getEmbedder(provider?: string): Promise<Embedder> {
    const config = this.configService.get('embedding');
    const selectedProvider = provider || config.provider;  // 优先使用参数，其次使用配置
  }
  3. 自动选择逻辑：
  // EmbedderFactory.ts:107-124
  async autoSelectProvider(): Promise<string> {
    const available = await this.getAvailableProviders();
    const config = this.configService.get('embedding');
    const preferredProvider = config.provider;

    // 优先返回配置的首选provider
    if (available.includes(preferredProvider)) {
      return preferredProvider;
    }

    // 否则返回第一个可用的provider
    return available[0];
  }

  支持的 Provider：

  - openai
  - ollama
  - gemini
  - mistral
  - siliconflow (默认)
  - custom1
  - custom2
  - custom3

  总结：通过在 .env 中设置 EMBEDDING_PROVIDER=xxx 来选择provider，系统会检查该provider是否可用，如果不可用会自动选择其他可用的provider。