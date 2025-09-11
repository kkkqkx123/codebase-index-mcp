// Test script for static analysis functionality
const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1/analysis';

async function testStaticAnalysisAPI() {
  try {
    console.log('🧪 Testing Static Analysis API...\n');

    // Test 1: System status
    console.log('1. Testing system status...');
    const statusResponse = await axios.get(`${BASE_URL}/status`);
    console.log('✅ System status:', statusResponse.data);

    // Test 2: Available rules
    console.log('\n2. Testing available rules...');
    const rulesResponse = await axios.get(`${BASE_URL}/rules`);
    console.log(`✅ Found ${rulesResponse.data.rules.length} rules`);

    // Test 3: Scan a test project
    console.log('\n3. Testing project scan...');
    const scanResponse = await axios.post(`${BASE_URL}/scan`, {
      projectPath: './test/mock-folder/project1',
      options: {
        includeTests: false,
        severity: ['high', 'medium'],
        maxFindings: 100
      }
    });
    console.log('✅ Scan started:', scanResponse.data);

    // Test 4: Check scan status
    const scanId = scanResponse.data.scanId;
    console.log('\n4. Checking scan status...');
    let statusCheck = await axios.get(`${BASE_URL}/scan/${scanId}/status`);
    console.log('✅ Scan status:', statusCheck.data);

    // Wait for scan completion
    console.log('\n5. Waiting for scan completion...');
    let completed = false;
    while (!completed) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      statusCheck = await axios.get(`${BASE_URL}/scan/${scanId}/status`);
      console.log('⏳ Current status:', statusCheck.data.status);
      
      if (statusCheck.data.status === 'completed' || statusCheck.data.status === 'failed') {
        completed = true;
      }
    }

    // Test 5: Get scan results
    if (statusCheck.data.status === 'completed') {
      console.log('\n6. Fetching scan results...');
      const resultsResponse = await axios.get(`${BASE_URL}/scan/${scanId}/results`);
      console.log('✅ Scan results:', resultsResponse.data);

      // Test 6: Search findings
      console.log('\n7. Testing findings search...');
      const searchResponse = await axios.post(`${BASE_URL}/findings/search`, {
        query: 'security vulnerability',
        projectId: 'project1',
        severity: ['high', 'critical'],
        limit: 10
      });
      console.log(`✅ Found ${searchResponse.data.findings.length} matching findings`);
    }

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

async function testRuleValidation() {
  try {
    console.log('\n🔍 Testing rule validation...');

    const testRule = {
      id: 'test-rule-001',
      name: 'Test Security Rule',
      description: 'A test rule for validation',
      severity: 'medium',
      language: 'javascript',
      pattern: 'console.log(...)',
      metadata: {
        category: 'security',
        technology: ['javascript']
      }
    };

    const validationResponse = await axios.post(`${BASE_URL}/rules/validate`, {
      rule: testRule,
      testCode: 'console.log("test");'
    });

    console.log('✅ Rule validation:', validationResponse.data);
  } catch (error) {
    console.error('❌ Rule validation failed:', error.response?.data || error.message);
  }
}

// Run tests if called directly
if (require.main === module) {
  testStaticAnalysisAPI()
    .then(() => testRuleValidation())
    .catch(console.error);
}

module.exports = { testStaticAnalysisAPI, testRuleValidation };