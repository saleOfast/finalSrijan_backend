// Twilio-based SMS utility
// Usage: sendSMS(mobile, message)

let twilioClient = null;
function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  if (!twilioClient) {
    // Lazy import to avoid dependency errors if not installed yet
    // eslint-disable-next-line global-require
    const twilio = require('twilio');
    twilioClient = twilio(sid, token);
  }
  return twilioClient;
}

async function sendSMS(mobile, message) {
  try {
    const client = getTwilioClient();
    const from = process.env.TWILIO_FROM_NUMBER; // e.g., '+12025550123'
    if (client && from) {
      const resp = await client.messages.create({
        from,
        to: String(mobile).startsWith('+') ? String(mobile) : `+${String(mobile)}`,
        body: message,
      });
      return { sid: resp.sid };
    }
    // No provider configured: mock-send
    console.log(`[SMS MOCK] To: ${mobile} | Message: ${message}`);
    return { mocked: true, provider: 'mock', mobile, message };
  } catch (err) {
    console.error('SMS send failed:', err);
    throw err;
  }
}

module.exports = { sendSMS };
