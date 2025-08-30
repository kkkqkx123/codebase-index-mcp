import { ConfigService } from '../config/ConfigService';
import { OpenAIEmbedder } from './OpenAIEmbedder';
import { GeminiEmbedder } from './GeminiEmbedder';
import { MistralEmbedder } from './MistralEmbedder';
import { OllamaEmbedder } from './OllamaEmbedder';

// This is a simple test to verify that environment variables take precedence over defaults
// In a real application, this would be part of a proper test suite

function testBaseUrlPriority() {
  console.log('Testing base URL priority...\n');
  
  // Initialize config service
  const configService = ConfigService.getInstance();
  
  // Test OpenAI base URL
  const openAIConfig = configService.get('embedding').openai;
  console.log('OpenAI Configuration:');
  console.log('- API Key:', openAIConfig.apiKey ? '[SET]' : '[NOT SET]');
  console.log('- Base URL:', openAIConfig.baseUrl || 'Not set (using default)');
  console.log('- Model:', openAIConfig.model);
  console.log('');
  
  // Test Gemini base URL
  const geminiConfig = configService.get('embedding').gemini;
  console.log('Gemini Configuration:');
  console.log('- API Key:', geminiConfig.apiKey ? '[SET]' : '[NOT SET]');
  console.log('- Base URL:', geminiConfig.baseUrl || 'Not set (using default)');
  console.log('- Model:', geminiConfig.model);
  console.log('');
  
  // Test Mistral base URL
  const mistralConfig = configService.get('embedding').mistral;
  console.log('Mistral Configuration:');
  console.log('- API Key:', mistralConfig.apiKey ? '[SET]' : '[NOT SET]');
  console.log('- Base URL:', mistralConfig.baseUrl || 'Not set (using default)');
  console.log('- Model:', mistralConfig.model);
  console.log('');
  
  // Test Ollama base URL
  const ollamaConfig = configService.get('embedding').ollama;
  console.log('Ollama Configuration:');
  console.log('- Base URL:', ollamaConfig.baseUrl);
  console.log('- Model:', ollamaConfig.model);
  console.log('');
  
  console.log('If environment variables are set, they should appear above.');
  console.log('If not set, default values are used.');
}

// Run the test
testBaseUrlPriority();