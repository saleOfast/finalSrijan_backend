# Campaign Email Notification - cURL Commands

This guide provides cURL commands to test the campaign upload email notification feature.

---

## 🔑 Step 1: Login and Get Authentication Token

### Login Request
```bash
curl -X POST http://localhost:3000/api/v1/db/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'
```

### Save Token to Variable (Linux/Mac)
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/db/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }' | jq -r '.data.token')

echo "Token: $TOKEN"
```

### Save Token to Variable (Windows PowerShell)
```powershell
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/db/users/login" -Method Post -ContentType "application/json" -Body '{"email":"your-email@example.com","password":"your-password"}'
$token = $response.data.token
Write-Host "Token: $token"
```

---

## 🎯 Step 2: Create Campaign (Triggers Email Notification)

### Option 1: Basic Campaign (No File Upload)

#### Linux/Mac
```bash
curl -X POST http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign \
  -H "Authorization: Bearer $TOKEN" \
  -H "m_id: 123" \
  -F "campaign_name=Test Campaign - Email Notification" \
  -F "campaign_brand=Test Brand" \
  -F "contact=1234567890" \
  -F "campaign_start_date=2024-01-01" \
  -F "campaign_end_date=2024-12-31" \
  -F "campaign_duration=365" \
  -F "acc_id=1" \
  -F "cmpn_s_id=1" \
  -F "cmpn_p_id=1" \
  -F "cmpn_b_t_id=1"
```

#### Windows Command Prompt
```cmd
curl -X POST http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE" ^
  -H "m_id: 123" ^
  -F "campaign_name=Test Campaign - Email Notification" ^
  -F "campaign_brand=Test Brand" ^
  -F "contact=1234567890" ^
  -F "campaign_start_date=2024-01-01" ^
  -F "campaign_end_date=2024-12-31" ^
  -F "campaign_duration=365"
```

#### Windows PowerShell
```powershell
curl -X POST http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign `
  -H "Authorization: Bearer $token" `
  -H "m_id: 123" `
  -F "campaign_name=Test Campaign - Email Notification" `
  -F "campaign_brand=Test Brand" `
  -F "contact=1234567890" `
  -F "campaign_start_date=2024-01-01" `
  -F "campaign_end_date=2024-12-31" `
  -F "campaign_duration=365"
```

#### Bypass Permission Check (For Testing)
```bash
curl -X POST http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign \
  -H "Authorization: Bearer $TOKEN" \
  -H "pass: pass" \
  -F "campaign_name=Test Campaign - Email Notification" \
  -F "campaign_brand=Test Brand" \
  -F "contact=1234567890"
```

---

### Option 2: Campaign with File Upload

#### Linux/Mac
```bash
curl -X POST http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign \
  -H "Authorization: Bearer $TOKEN" \
  -H "m_id: 123" \
  -F "campaign_name=Test Campaign with File Upload" \
  -F "campaign_brand=Test Brand" \
  -F "contact=1234567890" \
  -F "campaign_start_date=2024-01-01" \
  -F "campaign_end_date=2024-12-31" \
  -F "campaign_duration=365" \
  -F "proof_attachment=@/path/to/your/file.pdf"
```

#### Windows Command Prompt
```cmd
curl -X POST http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE" ^
  -H "m_id: 123" ^
  -F "campaign_name=Test Campaign with File Upload" ^
  -F "campaign_brand=Test Brand" ^
  -F "contact=1234567890" ^
  -F "proof_attachment=@C:\path\to\your\file.pdf"
```

#### Windows PowerShell
```powershell
curl -X POST http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign `
  -H "Authorization: Bearer $token" `
  -H "m_id: 123" `
  -F "campaign_name=Test Campaign with File Upload" `
  -F "campaign_brand=Test Brand" `
  -F "contact=1234567890" `
  -F "proof_attachment=@C:\path\to\your\file.pdf"
```

---

### Option 3: Minimal Campaign (Only Required Fields)
```bash
curl -X POST http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign \
  -H "Authorization: Bearer $TOKEN" \
  -H "pass: pass" \
  -F "campaign_name=Minimal Test Campaign"
```

---

## 📋 Complete Example (Login + Create Campaign)

### Linux/Mac (Bash Script)
```bash
#!/bin/bash

# Server URL
SERVER_URL="http://localhost:3000"

# Login credentials
EMAIL="your-email@example.com"
PASSWORD="your-password"

# Login and get token
echo "Logging in..."
TOKEN=$(curl -s -X POST "$SERVER_URL/api/v1/db/users/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }" | jq -r '.data.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "Login failed!"
  exit 1
fi

echo "Token obtained: ${TOKEN:0:50}..."

# Create campaign
echo "Creating campaign..."
RESPONSE=$(curl -s -X POST "$SERVER_URL/api/v1/db/media/campaign/campaignManagement/addCampaign" \
  -H "Authorization: Bearer $TOKEN" \
  -H "pass: pass" \
  -F "campaign_name=Test Campaign - Email Notification $(date +%s)" \
  -F "campaign_brand=Test Brand" \
  -F "contact=1234567890" \
  -F "campaign_start_date=2024-01-01" \
  -F "campaign_end_date=2024-12-31" \
  -F "campaign_duration=365")

echo "Response:"
echo "$RESPONSE" | jq '.'

# Check if campaign was created
if echo "$RESPONSE" | jq -e '.status == 200' > /dev/null; then
  echo "✅ Campaign created successfully!"
  echo "📧 Email notifications should be sent to CP and BST users"
else
  echo "❌ Campaign creation failed!"
  echo "$RESPONSE" | jq '.'
fi
```

### Windows PowerShell Script
```powershell
# Server URL
$serverUrl = "http://localhost:3000"

# Login credentials
$email = "your-email@example.com"
$password = "your-password"

# Login and get token
Write-Host "Logging in..."
$loginBody = @{
    email = $email
    password = $password
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "$serverUrl/api/v1/db/users/login" `
    -Method Post `
    -ContentType "application/json" `
    -Body $loginBody

$token = $loginResponse.data.token

if (-not $token) {
    Write-Host "Login failed!"
    exit 1
}

Write-Host "Token obtained: $($token.Substring(0, 50))..."

# Create campaign
Write-Host "Creating campaign..."
$boundary = [System.Guid]::NewGuid().ToString()
$filePath = "C:\path\to\your\file.pdf" # Optional file path

$bodyLines = @(
    "--$boundary",
    "Content-Disposition: form-data; name=`"campaign_name`"",
    "",
    "Test Campaign - Email Notification $(Get-Date -Format 'yyyyMMddHHmmss')",
    "--$boundary",
    "Content-Disposition: form-data; name=`"campaign_brand`"",
    "",
    "Test Brand",
    "--$boundary",
    "Content-Disposition: form-data; name=`"contact`"",
    "",
    "1234567890",
    "--$boundary",
    "Content-Disposition: form-data; name=`"campaign_start_date`"",
    "",
    "2024-01-01",
    "--$boundary",
    "Content-Disposition: form-data; name=`"campaign_end_date`"",
    "",
    "2024-12-31",
    "--$boundary",
    "Content-Disposition: form-data; name=`"campaign_duration`"",
    "",
    "365",
    "--$boundary--"
)

$body = $bodyLines -join "`r`n"
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)

$headers = @{
    "Authorization" = "Bearer $token"
    "pass" = "pass"
    "Content-Type" = "multipart/form-data; boundary=$boundary"
}

try {
    $response = Invoke-RestMethod -Uri "$serverUrl/api/v1/db/media/campaign/campaignManagement/addCampaign" `
        -Method Post `
        -Headers $headers `
        -Body $bodyBytes

    Write-Host "✅ Campaign created successfully!"
    Write-Host "📧 Email notifications should be sent to CP and BST users"
    Write-Host "Response:"
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "❌ Campaign creation failed!"
    Write-Host $_.Exception.Message
}
```

---

## 🔍 Step 3: Verify Response

### Expected Success Response
```json
{
  "status": 200,
  "message": "Campaign Added Succesfully",
  "data": {
    "campaign_id": 1,
    "campaign_name": "Test Campaign - Email Notification",
    "campaign_code": "CAMP00001",
    "campaign_brand": "Test Brand",
    "contact": "1234567890",
    "campaign_start_date": "2024-01-01T00:00:00.000Z",
    "campaign_end_date": "2024-12-31T00:00:00.000Z",
    "campaign_duration": 365,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Check Server Logs
After running the curl command, check your server console for:
```
Campaign notification email sent to cp-user@example.com
Campaign notification email sent to bst-user@example.com
Campaign notification emails sent to 5 users (3 CP users, 2 BST users)
```

---

## 📧 Step 4: Verify Email Notifications

### Check Email Inboxes
1. **CP Users**: Check emails of all active Channel Partners (role_id = 1)
2. **BST Users**: Check emails of all active Business Sales Team members (role_id = 2)
3. **Email Subject**: "New Campaign Uploaded"
4. **Email Content**: Should include campaign name and campaign code

---

## 🧪 Quick Test Commands

### One-Liner Test (Linux/Mac)
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/db/users/login -H "Content-Type: application/json" -d '{"email":"your-email@example.com","password":"your-password"}' | jq -r '.data.token') && curl -X POST http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign -H "Authorization: Bearer $TOKEN" -H "pass: pass" -F "campaign_name=Quick Test Campaign" && echo "✅ Campaign created! Check server logs for email notifications."
```

### Test with Verbose Output
```bash
curl -v -X POST http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign \
  -H "Authorization: Bearer $TOKEN" \
  -H "pass: pass" \
  -F "campaign_name=Verbose Test Campaign" \
  -F "campaign_brand=Test Brand"
```

### Test with Response Formatting (jq)
```bash
curl -s -X POST http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign \
  -H "Authorization: Bearer $TOKEN" \
  -H "pass: pass" \
  -F "campaign_name=Formatted Test Campaign" \
  -F "campaign_brand=Test Brand" | jq '.'
```

---

## 🔧 Troubleshooting

### Issue: "No token Found"
```bash
# Make sure you're including the Authorization header
-H "Authorization: Bearer $TOKEN"
```

### Issue: "not authorised"
```bash
# Use pass header to bypass permission check (for testing)
-H "pass: pass"

# OR provide m_id header
-H "m_id: 123"
```

### Issue: "Connection refused"
```bash
# Check if server is running on the correct port
# Default: http://localhost:3000
# Change port if your server uses different port
```

### Issue: File upload not working
```bash
# Make sure file path is correct and file exists
# Use @ symbol before file path
-F "proof_attachment=@/path/to/file.pdf"

# Check file permissions
ls -l /path/to/file.pdf
```

---

## 📝 Available Campaign Fields

### Required Fields
- `campaign_name` (string) - Campaign name

### Optional Fields
- `acc_id` (integer) - Account ID
- `cmpn_s_id` (integer) - Campaign Status ID
- `cmpn_p_id` (integer) - Campaign Proof ID
- `cmpn_b_t_id` (integer) - Campaign Business Type ID
- `campaign_brand` (string) - Campaign brand name
- `contact` (string) - Contact number
- `campaign_start_date` (date) - Campaign start date (YYYY-MM-DD)
- `campaign_end_date` (date) - Campaign end date (YYYY-MM-DD)
- `campaign_duration` (integer) - Campaign duration in days
- `proof_attachment` (file) - Proof attachment file
- `created_by` (integer) - Created by user ID (auto-set)
- `last_updated_by` (integer) - Last updated by user ID (auto-set)

---

## 🎯 Example: Complete Test Flow

```bash
#!/bin/bash

# Configuration
SERVER="http://localhost:3000"
EMAIL="admin@example.com"
PASSWORD="admin123"

echo "=== Campaign Email Notification Test ==="
echo ""

# Step 1: Login
echo "1. Logging in..."
TOKEN=$(curl -s -X POST "$SERVER/api/v1/db/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | jq -r '.data.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  exit 1
fi
echo "✅ Login successful"
echo ""

# Step 2: Create Campaign
echo "2. Creating campaign..."
CAMPAIGN_NAME="Test Campaign - $(date +%Y%m%d-%H%M%S)"
RESPONSE=$(curl -s -X POST "$SERVER/api/v1/db/media/campaign/campaignManagement/addCampaign" \
  -H "Authorization: Bearer $TOKEN" \
  -H "pass: pass" \
  -F "campaign_name=$CAMPAIGN_NAME" \
  -F "campaign_brand=Test Brand" \
  -F "contact=1234567890" \
  -F "campaign_start_date=2024-01-01" \
  -F "campaign_end_date=2024-12-31" \
  -F "campaign_duration=365")

STATUS=$(echo "$RESPONSE" | jq -r '.status')
MESSAGE=$(echo "$RESPONSE" | jq -r '.message')

if [ "$STATUS" == "200" ]; then
  echo "✅ Campaign created successfully!"
  echo "   Campaign Name: $CAMPAIGN_NAME"
  echo "   Message: $MESSAGE"
  echo ""
  echo "📧 Email notifications should be sent to:"
  echo "   - All active CP users (role_id = 1)"
  echo "   - All active BST users (role_id = 2)"
  echo ""
  echo "📋 Check server logs for email sending status"
  echo "📬 Check user email inboxes for notifications"
else
  echo "❌ Campaign creation failed!"
  echo "$RESPONSE" | jq '.'
  exit 1
fi

echo ""
echo "=== Test Complete ==="
```

---

## 🔗 Related Endpoints

### Get Campaign
```bash
curl -X GET "http://localhost:3000/api/v1/db/media/campaign/campaignManagement/getCampaign?campaign_id=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "pass: pass"
```

### Update Campaign
```bash
curl -X PUT http://localhost:3000/api/v1/db/media/campaign/campaignManagement/updateCampaign \
  -H "Authorization: Bearer $TOKEN" \
  -H "pass: pass" \
  -F "campaign_id=1" \
  -F "campaign_name=Updated Campaign Name"
```

### Delete Campaign
```bash
curl -X DELETE "http://localhost:3000/api/v1/db/media/campaign/campaignManagement/deleteCampaign?campaign_id=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "pass: pass"
```

---

*Last Updated: Based on current implementation*

