# Campaign Email Notification - Postman cURL for Windows

This guide provides Windows-compatible cURL commands for testing in Postman.

---

## 🚀 Quick Start: Postman cURL Import

### Step 1: Copy cURL Command
Copy one of the cURL commands below.

### Step 2: Import into Postman
1. Open Postman
2. Click **Import** button (top left)
3. Select **Raw Text** tab
4. Paste the cURL command
5. Click **Continue** and **Import**

### Step 3: Update Variables
- Replace `YOUR_TOKEN_HERE` with your actual token
- Replace `your-email@example.com` with your email
- Replace `your-password` with your password
- Replace `localhost:3000` with your server URL if different

---

## 📋 cURL Commands for Postman (Windows Compatible)

### 1. Login Request (Get Token)

```bash
curl --location 'http://localhost:3000/api/v1/db/users/login' \
--header 'Content-Type: application/json' \
--data '{
    "email": "your-email@example.com",
    "password": "your-password"
}'
```

**Postman Import Format:**
```bash
curl --location --request POST 'http://localhost:3000/api/v1/db/users/login' \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "your-email@example.com",
    "password": "your-password"
}'
```

---

### 2. Create Campaign (Basic - No File Upload)

```bash
curl --location 'http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign' \
--header 'Authorization: Bearer YOUR_TOKEN_HERE' \
--header 'pass: pass' \
--form 'campaign_name="Test Campaign - Email Notification"' \
--form 'campaign_brand="Test Brand"' \
--form 'contact="1234567890"' \
--form 'campaign_start_date="2024-01-01"' \
--form 'campaign_end_date="2024-12-31"' \
--form 'campaign_duration="365"'
```

**Postman Import Format:**
```bash
curl --location --request POST 'http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign' \
--header 'Authorization: Bearer YOUR_TOKEN_HERE' \
--header 'pass: pass' \
--form 'campaign_name="Test Campaign - Email Notification"' \
--form 'campaign_brand="Test Brand"' \
--form 'contact="1234567890"' \
--form 'campaign_start_date="2024-01-01"' \
--form 'campaign_end_date="2024-12-31"' \
--form 'campaign_duration="365"'
```

---

### 3. Create Campaign (With File Upload)

```bash
curl --location 'http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign' \
--header 'Authorization: Bearer YOUR_TOKEN_HERE' \
--header 'pass: pass' \
--form 'campaign_name="Test Campaign with File Upload"' \
--form 'campaign_brand="Test Brand"' \
--form 'contact="1234567890"' \
--form 'campaign_start_date="2024-01-01"' \
--form 'campaign_end_date="2024-12-31"' \
--form 'campaign_duration="365"' \
--form 'proof_attachment=@"C:\path\to\your\file.pdf"'
```

**Note:** Replace `C:\path\to\your\file.pdf` with your actual file path.

---

### 4. Create Campaign (Minimal - Only Required Field)

```bash
curl --location 'http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign' \
--header 'Authorization: Bearer YOUR_TOKEN_HERE' \
--header 'pass: pass' \
--form 'campaign_name="Minimal Test Campaign"'
```

---

### 5. Create Campaign (With Menu ID - For Admin Users)

```bash
curl --location 'http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign' \
--header 'Authorization: Bearer YOUR_TOKEN_HERE' \
--header 'm_id: 123' \
--form 'campaign_name="Test Campaign - Email Notification"' \
--form 'campaign_brand="Test Brand"' \
--form 'contact="1234567890"'
```

**Note:** Replace `123` with your actual menu ID.

---

## 🎯 Complete Postman Collection (JSON)

You can import this complete collection into Postman:

```json
{
	"info": {
		"name": "Campaign Email Notification Test",
		"description": "Test campaign upload and email notifications",
		"schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
	},
	"item": [
		{
			"name": "1. Login - Get Token",
			"event": [
				{
					"listen": "test",
					"script": {
						"exec": [
							"if (pm.response.code === 200) {",
							"    var jsonData = pm.response.json();",
							"    if (jsonData.data && jsonData.data.token) {",
							"        pm.environment.set('token', jsonData.data.token);",
							"        console.log('Token saved:', jsonData.data.token);",
							"    }",
							"}"
						],
						"type": "text/javascript"
					}
				}
			],
			"request": {
				"method": "POST",
				"header": [
					{
						"key": "Content-Type",
						"value": "application/json"
					}
				],
				"body": {
					"mode": "raw",
					"raw": "{\n    \"email\": \"your-email@example.com\",\n    \"password\": \"your-password\"\n}"
				},
				"url": {
					"raw": "http://localhost:3000/api/v1/db/users/login",
					"protocol": "http",
					"host": ["localhost"],
					"port": "3000",
					"path": ["api", "v1", "db", "users", "login"]
				}
			}
		},
		{
			"name": "2. Create Campaign - Trigger Email Notification",
			"request": {
				"method": "POST",
				"header": [
					{
						"key": "Authorization",
						"value": "Bearer {{token}}",
						"type": "text"
					},
					{
						"key": "pass",
						"value": "pass",
						"type": "text"
					}
				],
				"body": {
					"mode": "formdata",
					"formdata": [
						{
							"key": "campaign_name",
							"value": "Test Campaign - Email Notification",
							"type": "text"
						},
						{
							"key": "campaign_brand",
							"value": "Test Brand",
							"type": "text"
						},
						{
							"key": "contact",
							"value": "1234567890",
							"type": "text"
						},
						{
							"key": "campaign_start_date",
							"value": "2024-01-01",
							"type": "text"
						},
						{
							"key": "campaign_end_date",
							"value": "2024-12-31",
							"type": "text"
						},
						{
							"key": "campaign_duration",
							"value": "365",
							"type": "text"
						},
						{
							"key": "proof_attachment",
							"type": "file",
							"src": []
						}
					]
				},
				"url": {
					"raw": "http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign",
					"protocol": "http",
					"host": ["localhost"],
					"port": "3000",
					"path": ["api", "v1", "db", "media", "campaign", "campaignManagement", "addCampaign"]
				}
			}
		}
	],
	"variable": [
		{
			"key": "base_url",
			"value": "http://localhost:3000",
			"type": "string"
		},
		{
			"key": "token",
			"value": "",
			"type": "string"
		}
	]
}
```

---

## 📝 Step-by-Step Postman Setup (Windows)

### Method 1: Import cURL Command

1. **Open Postman**
2. **Click Import** (top left corner)
3. **Select "Raw Text" tab**
4. **Paste this cURL command:**
```bash
curl --location --request POST 'http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign' \
--header 'Authorization: Bearer YOUR_TOKEN_HERE' \
--header 'pass: pass' \
--form 'campaign_name="Test Campaign - Email Notification"' \
--form 'campaign_brand="Test Brand"' \
--form 'contact="1234567890"' \
--form 'campaign_start_date="2024-01-01"' \
--form 'campaign_end_date="2024-12-31"' \
--form 'campaign_duration="365"'
```
5. **Click Continue** and **Import**
6. **Update the Authorization header** with your actual token
7. **Click Send**

### Method 2: Manual Setup in Postman

1. **Create New Request**
   - Click **New** → **HTTP Request**
   - Name it: "Create Campaign - Email Notification"

2. **Set Method and URL**
   - Method: **POST**
   - URL: `http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign`

3. **Add Headers**
   - Click **Headers** tab
   - Add:
     - Key: `Authorization`, Value: `Bearer YOUR_TOKEN_HERE`
     - Key: `pass`, Value: `pass`

4. **Add Body**
   - Click **Body** tab
   - Select **form-data**
   - Add fields:
     - `campaign_name`: `Test Campaign - Email Notification`
     - `campaign_brand`: `Test Brand`
     - `contact`: `1234567890`
     - `campaign_start_date`: `2024-01-01`
     - `campaign_end_date`: `2024-12-31`
     - `campaign_duration`: `365`

5. **Send Request**
   - Click **Send** button
   - Check response for success

### Method 3: Use Environment Variables

1. **Create Environment**
   - Click **Environments** (left sidebar)
   - Click **+** to create new environment
   - Add variables:
     - `base_url`: `http://localhost:3000`
     - `token`: (leave empty, will be set automatically)

2. **Update Request**
   - Use `{{base_url}}` in URL
   - Use `{{token}}` in Authorization header

3. **Auto-save Token from Login**
   - In Login request, add this to **Tests** tab:
   ```javascript
   if (pm.response.code === 200) {
       var jsonData = pm.response.json();
       if (jsonData.data && jsonData.data.token) {
           pm.environment.set('token', jsonData.data.token);
       }
   }
   ```

---

## 🔧 Windows-Specific cURL Commands

### Windows Command Prompt (cmd.exe)

```cmd
curl -X POST "http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign" ^
  -H "Authorization: Bearer YOUR_TOKEN_HERE" ^
  -H "pass: pass" ^
  -F "campaign_name=Test Campaign - Email Notification" ^
  -F "campaign_brand=Test Brand" ^
  -F "contact=1234567890" ^
  -F "campaign_start_date=2024-01-01" ^
  -F "campaign_end_date=2024-12-31" ^
  -F "campaign_duration=365"
```

**Note:** Use `^` for line continuation in Windows CMD.

### Windows PowerShell

```powershell
$headers = @{
    "Authorization" = "Bearer YOUR_TOKEN_HERE"
    "pass" = "pass"
}

$body = @{
    campaign_name = "Test Campaign - Email Notification"
    campaign_brand = "Test Brand"
    contact = "1234567890"
    campaign_start_date = "2024-01-01"
    campaign_end_date = "2024-12-31"
    campaign_duration = "365"
}

Invoke-RestMethod -Uri "http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign" -Method Post -Headers $headers -Form $body
```

### Windows PowerShell (with file upload)

```powershell
$headers = @{
    "Authorization" = "Bearer YOUR_TOKEN_HERE"
    "pass" = "pass"
}

$filePath = "C:\path\to\your\file.pdf"

$body = @{
    campaign_name = "Test Campaign with File"
    campaign_brand = "Test Brand"
    contact = "1234567890"
    proof_attachment = Get-Item -Path $filePath
}

Invoke-RestMethod -Uri "http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign" -Method Post -Headers $headers -Form $body
```

---

## 🎯 Postman Code Snippet (cURL)

Postman can generate cURL commands for you:

1. **Create and configure your request in Postman**
2. **Click "Code" button** (bottom right, under "Send")
3. **Select "cURL" from dropdown**
4. **Copy the generated cURL command**

Example generated cURL:
```bash
curl --location --request POST 'http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--header 'pass: pass' \
--form 'campaign_name="Test Campaign - Email Notification"' \
--form 'campaign_brand="Test Brand"' \
--form 'contact="1234567890"' \
--form 'campaign_start_date="2024-01-01"' \
--form 'campaign_end_date="2024-12-31"' \
--form 'campaign_duration="365"'
```

---

## ✅ Testing Checklist

- [ ] Server is running on `http://localhost:3000`
- [ ] Token obtained from login request
- [ ] Authorization header set with Bearer token
- [ ] `pass: pass` header added (or `m_id` header for admin)
- [ ] Campaign name provided
- [ ] Request sent successfully
- [ ] Response status is 200
- [ ] Server logs show email sending
- [ ] CP users received emails
- [ ] BST users received emails

---

## 📧 Verify Email Notifications

After sending the request:

1. **Check Server Console Logs:**
   ```
   Campaign notification email sent to cp-user@example.com
   Campaign notification email sent to bst-user@example.com
   Campaign notification emails sent to 5 users (3 CP users, 2 BST users)
   ```

2. **Check Email Inboxes:**
   - CP users (role_id = 1) should receive email
   - BST users (role_id = 2) should receive email
   - Subject: "New Campaign Uploaded"
   - Content includes campaign name and code

---

## 🐛 Troubleshooting

### Issue: "No token Found"
**Solution:** Make sure Authorization header is set:
```
Authorization: Bearer YOUR_TOKEN_HERE
```

### Issue: "not authorised"
**Solution:** Add `pass: pass` header or provide `m_id` header

### Issue: cURL not working in Windows CMD
**Solution:** 
- Use PowerShell instead
- Or install Git Bash for Windows
- Or use Postman directly

### Issue: File upload not working
**Solution:** 
- In Postman: Use form-data with type "File"
- In cURL: Use `@"C:\path\to\file.pdf"` format
- Check file path is correct

---

## 📋 Complete Test Flow in Postman

### Request 1: Login
```
POST http://localhost:3000/api/v1/db/users/login
Body (JSON):
{
    "email": "your-email@example.com",
    "password": "your-password"
}

Tests Tab (Auto-save token):
if (pm.response.code === 200) {
    var jsonData = pm.response.json();
    if (jsonData.data && jsonData.data.token) {
        pm.environment.set('token', jsonData.data.token);
    }
}
```

### Request 2: Create Campaign
```
POST http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign
Headers:
  Authorization: Bearer {{token}}
  pass: pass
Body (form-data):
  campaign_name: Test Campaign - Email Notification
  campaign_brand: Test Brand
  contact: 1234567890
  campaign_start_date: 2024-01-01
  campaign_end_date: 2024-12-31
  campaign_duration: 365
```

---

*Last Updated: Windows-compatible cURL commands for Postman*

