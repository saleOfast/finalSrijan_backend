/**
 * OTP Service Test Script
 * 
 * This script helps you test both OTP services:
 * 1. Visit OTP (SMS-based)
 * 2. Password Reset OTP (Email-based)
 * 
 * Usage:
 *   node test-otp-service.js
 * 
 * Make sure to update the configuration variables below before running.
 */

const axios = require('axios');

// ==================== CONFIGURATION ====================
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1/db';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'YOUR_AUTH_TOKEN_HERE';

// For Visit OTP Test
const TEST_DB_NAME = 'YOUR_DATABASE_NAME';
const TEST_CPL_ID = 123; // Replace with actual CPL ID

// For Password Reset OTP Test
const TEST_EMAIL = 'agautam@gmail.com'; // Replace with actual user email
// =======================================================

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60) + '\n');
}

// Test Visit OTP Service
async function testVisitOTP() {
  logSection('Testing Visit OTP Service (SMS)');
  
  try {
    log('Sending request...', 'cyan');
    log(`URL: ${BASE_URL}/channelPartnerLeads/sendVisitOTP`, 'yellow');
    log(`DB Name: ${TEST_DB_NAME}`, 'yellow');
    log(`CPL ID: ${TEST_CPL_ID}`, 'yellow');
    
    const response = await axios.post(
      `${BASE_URL}/channelPartnerLeads/sendVisitOTP`,
      {
        db_name: TEST_DB_NAME,
        cpl_id: TEST_CPL_ID
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      }
    );
    
    log('\n✅ SUCCESS!', 'green');
    log('Response:', 'bright');
    console.log(JSON.stringify(response.data, null, 2));
    
    log('\n📱 Next Steps:', 'cyan');
    log('1. Check your server console for [OTP DEBUG] log', 'yellow');
    log('2. If SMS credentials are configured, check the mobile number', 'yellow');
    log('3. If in mock mode, OTP will be in console logs', 'yellow');
    
    return { success: true, data: response.data };
  } catch (error) {
    log('\n❌ ERROR!', 'red');
    if (error.response) {
      log('Status:', 'red');
      console.log(error.response.status);
      log('Response:', 'red');
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      log('Error Message:', 'red');
      console.log(error.message);
    }
    
    log('\n💡 Troubleshooting:', 'cyan');
    log('- Check if server is running', 'yellow');
    log('- Verify AUTH_TOKEN is correct', 'yellow');
    log('- Ensure db_name and cpl_id are valid', 'yellow');
    log('- Check if lead exists and has contact number', 'yellow');
    
    return { success: false, error: error.response?.data || error.message };
  }
}

// Test Password Reset OTP Service
async function testPasswordResetOTP() {
  logSection('Testing Password Reset OTP Service (Email)');
  
  try {
    log('Sending request...', 'cyan');
    log(`URL: ${BASE_URL}/users/cp/send`, 'yellow');
    log(`Email: ${TEST_EMAIL}`, 'yellow');
    log(`DB Name: ${TEST_DB_NAME}`, 'yellow');
    
    const response = await axios.post(
      `${BASE_URL}/users/cp/send`,
      {
        email: TEST_EMAIL,
        db_name: TEST_DB_NAME
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    log('\n✅ SUCCESS!', 'green');
    log('Response:', 'bright');
    console.log(JSON.stringify(response.data, null, 2));
    
    log('\n📧 Next Steps:', 'cyan');
    log('1. Check the email inbox for OTP email', 'yellow');
    log('2. Check spam/junk folder if not in inbox', 'yellow');
    log('3. Verify user_verify_otp is updated in database', 'yellow');
    
    return { success: true, data: response.data };
  } catch (error) {
    log('\n❌ ERROR!', 'red');
    if (error.response) {
      log('Status:', 'red');
      console.log(error.response.status);
      log('Response:', 'red');
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      log('Error Message:', 'red');
      console.log(error.message);
    }
    
    log('\n💡 Troubleshooting:', 'cyan');
    log('- Check if server is running', 'yellow');
    log('- Verify email exists in clients table', 'yellow');
    log('- Ensure user doc_verification status is 2', 'yellow');
    log('- Check email service configuration', 'yellow');
    
    return { success: false, error: error.response?.data || error.message };
  }
}

// Main function
async function runTests() {
  log('\n🚀 OTP Service Test Script', 'bright');
  log('='.repeat(60), 'bright');
  
  // Check configuration
  if (TEST_DB_NAME === 'YOUR_DATABASE_NAME' || AUTH_TOKEN === 'YOUR_AUTH_TOKEN_HERE') {
    log('\n⚠️  WARNING: Please update configuration variables in the script!', 'yellow');
    log('Edit test-otp-service.js and update:', 'yellow');
    log('- TEST_DB_NAME', 'yellow');
    log('- TEST_CPL_ID', 'yellow');
    log('- TEST_EMAIL', 'yellow');
    log('- AUTH_TOKEN (or set AUTH_TOKEN environment variable)', 'yellow');
    log('\nYou can also set environment variables:', 'cyan');
    log('  BASE_URL=http://localhost:3000/api/v1/db', 'yellow');
    log('  AUTH_TOKEN=your_token_here', 'yellow');
    log('\n');
  }
  
  // Run tests
  const results = {
    visitOTP: await testVisitOTP(),
    passwordResetOTP: await testPasswordResetOTP()
  };
  
  // Summary
  logSection('Test Summary');
  
  log('Visit OTP Test:', 'bright');
  if (results.visitOTP.success) {
    log('  ✅ PASSED', 'green');
  } else {
    log('  ❌ FAILED', 'red');
  }
  
  log('\nPassword Reset OTP Test:', 'bright');
  if (results.passwordResetOTP.success) {
    log('  ✅ PASSED', 'green');
  } else {
    log('  ❌ FAILED', 'red');
  }
  
  log('\n📝 Note: Check server console logs for OTP values', 'cyan');
  log('   Look for [OTP DEBUG] or [SMS MOCK] messages\n', 'cyan');
}

// Run the tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testVisitOTP, testPasswordResetOTP };

