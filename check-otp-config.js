// Script to check OTP/SMS service configuration
require('dotenv').config();

console.log('\n========================================');
console.log('OTP/SMS Service Configuration Check');
console.log('========================================\n');

const projectId = process.env.VOX_PROJECT_ID;
const authToken = process.env.VOX_AUTH_TOKEN;
const from = process.env.VOX_FROM || 'SRIJNR';
const templateId = process.env.VOX_TEMPLATE_ID || '1107169322469473268';
const templateBody = process.env.VOX_TEMPLATE_BODY || 
  'Use One-Time Password {#var#} to submit your enquiry in Srijan Realty. Do not share the OTP with anyone. -Srijan Realty Pvt. Ltd.';

console.log('Environment Variables Status:');
console.log('----------------------------------------');
console.log(`VOX_PROJECT_ID: ${projectId ? '✅ SET (' + projectId.substring(0, 10) + '...)' : '❌ NOT SET'}`);
console.log(`VOX_AUTH_TOKEN: ${authToken ? '✅ SET (' + authToken.substring(0, 10) + '...)' : '❌ NOT SET'}`);
console.log(`VOX_FROM: ${from}`);
console.log(`VOX_TEMPLATE_ID: ${templateId}`);
console.log(`VOX_TEMPLATE_BODY: ${templateBody.substring(0, 50)}...`);

console.log('\nService Status:');
console.log('----------------------------------------');
if (projectId && authToken) {
  console.log('✅ SMS Service: ACTIVE (Using Vox-CPaaS)');
  console.log('   OTP will be sent via SMS to CP mobile numbers');
} else {
  console.log('⚠️  SMS Service: MOCK MODE');
  console.log('   OTP will be logged to console only');
  console.log('   No actual SMS will be sent');
}

console.log('\nAPI Endpoint:');
console.log('----------------------------------------');
console.log('https://api.vox-cpaas.in/sendsms');

console.log('\nTo Enable SMS Service:');
console.log('----------------------------------------');
console.log('1. Create a .env file in the project root');
console.log('2. Add the following variables:');
console.log('   VOX_PROJECT_ID=your_project_id');
console.log('   VOX_AUTH_TOKEN=your_auth_token');
console.log('   VOX_FROM=SRIJNR (optional)');
console.log('   VOX_TEMPLATE_ID=1107169322469473268 (optional)');
console.log('   VOX_TEMPLATE_BODY=Use One-Time Password {#var#}... (optional)');
console.log('3. Restart your server');

console.log('\n========================================\n');

