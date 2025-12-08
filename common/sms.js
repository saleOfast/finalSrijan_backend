// Vox-CPaaS SMS utility
// Usage: sendSMS(mobile, message)
// The message should contain the OTP, which will be extracted and used in the template

const axios = require('axios');

/**
 * Format phone number to include country code if not present
 * @param {string|number} mobile - Phone number
 * @returns {string} Formatted phone number with +91 prefix
 */
function formatPhoneNumber(mobile) {
  let phone = String(mobile).trim();
  // Remove any spaces or dashes
  phone = phone.replace(/[\s-]/g, '');
  
  // If already starts with +91, return as is
  if (phone.startsWith('+91')) {
    return phone;
  }
  
  // If starts with 91 (without +), add +
  if (phone.startsWith('91') && phone.length > 10) {
    return `+${phone}`;
  }
  
  // If starts with 0, remove it and add +91
  if (phone.startsWith('0')) {
    phone = phone.substring(1);
  }
  
  // Add +91 prefix
  return `+91${phone}`;
}

/**
 * Extract OTP from message
 * Looks for patterns like "OTP is 123456" or "your OTP is 123456"
 * @param {string} message - Message containing OTP
 * @returns {string|null} Extracted OTP or null if not found
 */
function extractOTP(message) {
  // Try to find OTP pattern: "OTP is 123456" or similar
  const otpPatterns = [
    /OTP is (\d{4,8})/i,
    /your OTP is (\d{4,8})/i,
    /verification OTP is (\d{4,8})/i,
    /code is (\d{4,8})/i,
    /(\d{4,8}) is your OTP/i,
  ];
  
  for (const pattern of otpPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // If no pattern found, try to find any 4-8 digit number
  const digitMatch = message.match(/\b(\d{4,8})\b/);
  if (digitMatch && digitMatch[1]) {
    return digitMatch[1];
  }
  
  return null;
}

async function sendSMS(mobile, message) {
  try {
    const projectId = process.env.VOX_PROJECT_ID;
    const authToken = process.env.VOX_AUTH_TOKEN;
    const from = process.env.VOX_FROM || 'SRIJNR';
    const templateId = process.env.VOX_TEMPLATE_ID || '1107169322469473268';
    const templateBody = process.env.VOX_TEMPLATE_BODY || 
      'Use One-Time Password {#var#} to submit your enquiry in Srijan Realty. Do not share the OTP with anyone. -Srijan Realty Pvt. Ltd.';
    
    // Check if credentials are configured
    if (!projectId || !authToken) {
      console.log(`[SMS MOCK] To: ${mobile} | Message: ${message}`);
      return { mocked: true, provider: 'mock', mobile, message };
    }
    
    // Format phone number
    const formattedPhone = formatPhoneNumber(mobile);
    
    // Extract OTP from message
    const otp = extractOTP(message);
    
    if (!otp) {
      console.warn('[SMS WARNING] Could not extract OTP from message. Using full message as body.');
      // If OTP extraction fails, use the original message (fallback)
      // But the API expects template format, so we'll still try with template
    }
    
    // Replace {#var#} with OTP in template body
    const body = otp ? templateBody.replace(/{#var#}/g, otp) : message;
    
    // Prepare request data
    const params = new URLSearchParams();
    params.append('projectid', projectId);
    params.append('authtoken', authToken);
    params.append('from', from);
    params.append('to', formattedPhone);
    params.append('template_id', templateId);
    params.append('body', body);
    
    // // Log the exact request being sent (for debugging)
    // console.log('[SMS REQUEST] Sending SMS request:', {
    //   url: 'https://api.vox-cpaas.in/sendsms',
    //   projectid: projectId.substring(0, 15) + '...',
    //   authtoken: authToken.substring(0, 15) + '...',
    //   from: from,
    //   to: formattedPhone,
    //   template_id: templateId,
    //   body: body.substring(0, 100) + (body.length > 100 ? '...' : ''),
    //   otp: otp || 'NOT EXTRACTED'
    // });
    
    // Send SMS via vox-cpaas.in API
    const response = await axios.post('https://api.vox-cpaas.in/sendsms', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    // // Check if the API response indicates success
    // const responseData = response.data;
    // console.log(`[SMS API Response]`, responseData);
    
    // // Check for error in response (some APIs return 200 but with error in body)
    // if (responseData && (responseData.error || responseData.status === 'error' || responseData.status === 'failed')) {
    //   const errorMsg = responseData.message || responseData.error || 'SMS API returned an error';
    //   console.error(`[SMS ERROR] API Error: ${errorMsg}`, responseData);
    //   return {
    //     success: false,
    //     provider: 'vox-cpaas',
    //     mobile: formattedPhone,
    //     error: errorMsg,
    //     response: responseData
    //   };
    // }
    
    console.log(`[SMS SUCCESS] To: ${formattedPhone} | OTP: ${otp || 'N/A'}`);
    return { 
      success: true, 
      provider: 'vox-cpaas', 
      mobile: formattedPhone,
      response: response.data 
    };
  } catch (err) {
    console.error('SMS send failed:', err.response?.data || err.message);
    throw err;
  }
}

module.exports = { sendSMS };
