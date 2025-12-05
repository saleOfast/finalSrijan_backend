# OTP Service Testing Guide

This guide explains how to test the OTP services in the application. There are two OTP services:

1. **Visit OTP Service (SMS-based)** - For CP Lead stage changes to VISIT
2. **Password Reset OTP Service (Email-based)** - For user password reset

---

## Prerequisites

### Environment Variables
Make sure these environment variables are set in your `.env` file:

```env
# For SMS OTP (Vox-CPaaS)
VOX_PROJECT_ID=your_project_id
VOX_AUTH_TOKEN=your_auth_token
VOX_FROM=SRIJNR (optional, defaults to 'SRIJNR')
VOX_TEMPLATE_ID=1107169322469473268 (optional)
VOX_TEMPLATE_BODY=Use One-Time Password {#var#} to submit your enquiry in Srijan Realty. Do not share the OTP with anyone. -Srijan Realty Pvt. Ltd. (optional)
```

**Note:** If `VOX_PROJECT_ID` or `VOX_AUTH_TOKEN` are not set, the SMS service will run in **mock mode** and log the OTP to the console instead of sending actual SMS.

### Base URL
```
http://localhost:3000/api/v1/db
```

---

## 1. Testing Visit OTP Service (SMS)

### Endpoint
```
POST /api/v1/db/channelPartnerLeads/sendVisitOTP
```

### Authentication
This endpoint requires:
- `resolver` middleware (database connection)
- `rolePermission` middleware (authentication token)

### Request Body
```json
{
  "db_name": "YOUR_DATABASE_NAME",
  "cpl_id": 123
}
```

### cURL Command

#### Windows PowerShell
```powershell
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer YOUR_AUTH_TOKEN"
}

$body = @{
    db_name = "YOUR_DATABASE_NAME"
    cpl_id = 123
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/v1/db/channelPartnerLeads/sendVisitOTP" -Method Post -Headers $headers -Body $body
```

#### Windows CMD / Git Bash
```bash
curl -X POST "http://localhost:3000/api/v1/db/channelPartnerLeads/sendVisitOTP" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" ^
  -d "{\"db_name\":\"YOUR_DATABASE_NAME\",\"cpl_id\":123}"
```

#### Linux/Mac
```bash
curl -X POST "http://localhost:3000/api/v1/db/channelPartnerLeads/sendVisitOTP" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{"db_name":"YOUR_DATABASE_NAME","cpl_id":123}'
```

### Expected Response (Success)
```json
{
  "status": 200,
  "message": "OTP sent successfully to the registered mobile number",
  "data": null
}
```

### Expected Response (Error - Missing Lead)
```json
{
  "status": 400,
  "message": "No Lead Found with the Provided CPL ID",
  "data": null
}
```

### Expected Response (Error - No Contact Number)
```json
{
  "status": 400,
  "message": "Lead does not have a valid contact number",
  "data": null
}
```

### How to Verify OTP is Working

#### Method 1: Check Console Logs
If SMS credentials are not configured, the OTP will be logged to the console:
```
[OTP DEBUG] { db_name: 'YOUR_DB', cpl_id: 123, otp: '123456' }
[SMS MOCK] To: 9876543210 | Message: Dear John Doe, your verification OTP is 123456. It is valid for 10 minutes.
```

#### Method 2: Check SMS Service Logs
If SMS credentials are configured, check for:
```
[SMS SUCCESS] To: +919876543210 | OTP: 123456
```

#### Method 3: Receive Actual SMS
If credentials are properly configured, you should receive an SMS on the lead's contact number.

### Testing OTP Verification
After generating OTP, test verification by updating the lead stage to VISIT:

```
POST /api/v1/db/channelPartnerLeads
```

Request Body:
```json
{
  "db_name": "YOUR_DATABASE_NAME",
  "cpl_id": 123,
  "stage": "VISIT",
  "otp": "123456"
}
```

---

## 2. Testing Password Reset OTP Service (Email)

### Endpoint
```
POST /api/v1/db/users/cp/send
```

### Authentication
This endpoint does NOT require authentication (public endpoint for password reset).

### Request Body
```json
{
  "email": "user@example.com",
  "db_name": "YOUR_DATABASE_NAME"
}
```

### cURL Command

#### Windows PowerShell
```powershell
$body = @{
    email = "user@example.com"
    db_name = "YOUR_DATABASE_NAME"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/v1/db/users/cp/send" -Method Post -Headers @{"Content-Type"="application/json"} -Body $body
```

#### Windows CMD / Git Bash
```bash
curl -X POST "http://localhost:3000/api/v1/db/users/cp/send" ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"user@example.com\",\"db_name\":\"YOUR_DATABASE_NAME\"}"
```

#### Linux/Mac
```bash
curl -X POST "http://localhost:3000/api/v1/db/users/cp/send" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","db_name":"YOUR_DATABASE_NAME"}'
```

### Expected Response (Success)
```json
{
  "status": 200,
  "message": "OTP sent successfully",
  "data": null
}
```

### Expected Response (Error - User Not Found)
```json
{
  "status": 404,
  "status": false,
  "message": "No user found with that email"
}
```

### Expected Response (Error - User Not Verified)
```json
{
  "status": 400,
  "message": "User Not Verified",
  "data": null
}
```

### How to Verify OTP is Working

#### Method 1: Check Email
The OTP will be sent to the user's email address. Check the inbox (and spam folder) for an email with subject: **"OTP verification for password reset"**.

#### Method 2: Check Database
Query the `clients` table to see if `user_verify_otp` field is updated:
```sql
SELECT email, user_verify_otp FROM clients WHERE email = 'user@example.com';
```

### Testing OTP Verification
After generating OTP, test verification:

```
POST /api/v1/db/users/cp/verify
```

Request Body:
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

---

## 3. Quick Test Checklist

### Visit OTP (SMS) Service
- [ ] Server is running on port 3000
- [ ] Valid authentication token is available
- [ ] Valid `db_name` exists
- [ ] Valid `cpl_id` exists in `db_channel_partner_leads` table
- [ ] Lead has a valid `contact` number
- [ ] Check console logs for `[OTP DEBUG]` message
- [ ] Check console logs for `[SMS MOCK]` or `[SMS SUCCESS]` message
- [ ] If credentials configured, verify SMS received on mobile

### Password Reset OTP (Email) Service
- [ ] Server is running on port 3000
- [ ] Valid `email` exists in `clients` table
- [ ] User's `doc_verification` status is `2` (verified)
- [ ] Email service is configured properly
- [ ] Check email inbox for OTP email
- [ ] Verify `user_verify_otp` is updated in database

---

## 4. Troubleshooting

### SMS OTP Not Working

1. **Check Environment Variables**
   ```bash
   echo $VOX_PROJECT_ID
   echo $VOX_AUTH_TOKEN
   ```
   Or check your `.env` file.

2. **Mock Mode**
   - If credentials are missing, service runs in mock mode
   - Check console logs for `[SMS MOCK]` messages
   - OTP will be logged but not sent via SMS

3. **Phone Number Format**
   - Service automatically formats phone numbers
   - Accepts: `9876543210`, `09876543210`, `919876543210`, `+919876543210`
   - All are converted to `+919876543210` format

4. **Check API Response**
   - Look for error messages in response
   - Check server logs for detailed error information

### Email OTP Not Working

1. **Check Email Configuration**
   - Verify email service is configured in `common/mailer.js`
   - Check SMTP settings

2. **Check User Status**
   - User must exist in `clients` table
   - `doc_verification` must be `2`

3. **Check Database**
   - Verify `user_verify_otp` field is being updated
   - Check if email template exists (template_id = 7)

4. **Check Email Inbox**
   - Check spam/junk folder
   - Verify email address is correct

---

## 5. Testing with Postman

### Visit OTP Service
1. Create new POST request
2. URL: `http://localhost:3000/api/v1/db/channelPartnerLeads/sendVisitOTP`
3. Headers:
   - `Content-Type: application/json`
   - `Authorization: Bearer YOUR_AUTH_TOKEN`
4. Body (raw JSON):
   ```json
   {
     "db_name": "YOUR_DATABASE_NAME",
     "cpl_id": 123
   }
   ```

### Password Reset OTP Service
1. Create new POST request
2. URL: `http://localhost:3000/api/v1/db/users/cp/send`
3. Headers:
   - `Content-Type: application/json`
4. Body (raw JSON):
   ```json
   {
     "email": "user@example.com",
     "db_name": "YOUR_DATABASE_NAME"
   }
   ```

---

## 6. Example Test Script

### Simple Node.js Test Script
```javascript
const axios = require('axios');

// Test Visit OTP
async function testVisitOTP() {
  try {
    const response = await axios.post(
      'http://localhost:3000/api/v1/db/channelPartnerLeads/sendVisitOTP',
      {
        db_name: 'YOUR_DATABASE_NAME',
        cpl_id: 123
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_AUTH_TOKEN'
        }
      }
    );
    console.log('Visit OTP Response:', response.data);
  } catch (error) {
    console.error('Visit OTP Error:', error.response?.data || error.message);
  }
}

// Test Password Reset OTP
async function testPasswordResetOTP() {
  try {
    const response = await axios.post(
      'http://localhost:3000/api/v1/db/users/cp/send',
      {
        email: 'user@example.com',
        db_name: 'YOUR_DATABASE_NAME'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Password Reset OTP Response:', response.data);
  } catch (error) {
    console.error('Password Reset OTP Error:', error.response?.data || error.message);
  }
}

// Run tests
testVisitOTP();
testPasswordResetOTP();
```

---

## Summary

- **Visit OTP**: SMS-based, requires authentication, used for CP Lead stage changes
- **Password Reset OTP**: Email-based, public endpoint, used for password reset
- Both services log OTP to console for debugging
- SMS service has mock mode if credentials are not configured
- Always check console logs and server responses for debugging

