// Simple test script to verify base URL priority
const dotenv = require('dotenv');
const fs = require('fs');

// Load environment variables
dotenv.config();

console.log('Testing Base URL Priority');
console.log('========================');

// Test environment variables
console.log('Environment Variables:');
console.log('- OPENAI_BASE_URL:', process.env.OPENAI_BASE_URL || 'Not set');
console.log('- GEMINI_BASE_URL:', process.env.GEMINI_BASE_URL || 'Not set');
console.log('- MISTRAL_BASE_URL:', process.env.MISTRAL_BASE_URL || 'Not set');
console.log('- OLLAMA_BASE_URL:', process.env.OLLAMA_BASE_URL || 'Not set');

console.log('\nConfiguration Priority:');
console.log('1. Environment variables (from .env file)');
console.log('2. Default values (hardcoded in implementation)');

console.log('\nExpected Behavior:');
console.log('- If environment variables are set, they should be used');
console.log('- If not set, the system should fall back to default values');
console.log('- Environment variables take precedence over defaults');