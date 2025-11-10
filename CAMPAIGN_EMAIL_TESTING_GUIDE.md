# Campaign Email Notification - Postman Testing Guide

This guide will help you test the campaign upload email notification feature using Postman.

---

## 📋 Prerequisites

1. **Server Running**: Ensure your Node.js server is running
2. **Database Setup**: Ensure you have CP and BST users in the database with valid email addresses
3. **Authentication Token**: You need a valid JWT token for authentication
4. **Email Configuration**: Ensure email configuration is set up in `db_email_config` table (optional, will use defaults if not set)

---

## 🔑 Step 1: Get Authentication Token

### Login Endpoint
**Method**: `POST`  
**URL**: `http://localhost:3000/api/v1/db/users/login` (or your server URL)

**Headers**:
```
Content-Type: application/json
```

**Body** (JSON):
```json
{
  "email": "your-email@example.com",
  "password": "your-password"
}
```

**Response**: Copy the `token` from the response
```json
{
  "status": 200,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { ... }
  }
}
```

---

## 🎯 Step 2: Create Campaign (Test Email Notification)

### Endpoint Details
**Method**: `POST`  
**URL**: `http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign`

### Headers
```
Authorization: Bearer <your-token-here>
Content-Type: multipart/form-data
m_id: <menu-id-for-campaign-management> (Required if user is admin)
```

**Note**: 
- Replace `<your-token-here>` with the token from Step 1
- If you're an admin user, you need to provide `m_id` header (menu ID for campaign management)
- If `pass: pass` header is set, permission check is bypassed (for testing)

### Request Body (Form Data)

#### Option 1: Basic Campaign (No File Upload)
```
campaign_name: Test Campaign - Email Notification
acc_id: 1 (Optional - Account ID)
cmpn_s_id: 1 (Optional - Campaign Status ID)
cmpn_p_id: 1 (Optional - Campaign Proof ID)
cmpn_b_t_id: 1 (Optional - Campaign Business Type ID)
campaign_brand: Test Brand
contact: 1234567890
campaign_start_date: 2024-01-01
campaign_end_date: 2024-12-31
campaign_duration: 365
```

#### Option 2: Campaign with File Upload
Add the file field:
```
proof_attachment: [Select File] (Optional - Proof attachment file)
```

### Postman Setup

1. **Method**: Select `POST`
2. **URL**: Enter the endpoint URL
3. **Headers Tab**:
   - Add `Authorization`: `Bearer <your-token>`
   - Add `m_id`: `<menu-id>` (if admin user)
   - Or add `pass`: `pass` (to bypass permission check)
4. **Body Tab**:
   - Select `form-data`
   - Add the fields mentioned above
   - For file upload, change the field type to `File` and select your file

### Example Request (Postman)

```
POST http://localhost:3000/api/v1/db/media/campaign/campaignManagement/addCampaign

Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  m_id: 123 (or pass: pass)

Body (form-data):
  campaign_name: Summer Marketing Campaign 2024
  acc_id: 1
  campaign_brand: Brand XYZ
  contact: 9876543210
  campaign_start_date: 2024-06-01
  campaign_end_date: 2024-08-31
  campaign_duration: 92
```

---

## ✅ Step 3: Expected Response

### Success Response
```json
{
  "status": 200,
  "message": "Campaign Added Succesfully",
  "data": {
    "campaign_id": 1,
    "campaign_name": "Summer Marketing Campaign 2024",
    "campaign_code": "CAMP00001",
    ...
  }
}
```

### Error Responses

#### Authentication Error
```json
{
  "status": 400,
  "message": "No token Found"
}
```

#### Permission Error
```json
{
  "status": 400,
  "message": "not authorised"
}
```

---

## 📧 Step 4: Verify Email Notifications

### Check Server Logs
After creating a campaign, check your server console logs. You should see:
```
Campaign notification email sent to cp-user@example.com
Campaign notification email sent to bst-user@example.com
Campaign notification emails sent to 5 users (3 CP users, 2 BST users)
```

### Check Email Inboxes
1. **CP Users**: All active Channel Partners (role_id = 1) should receive email
2. **BST Users**: All active Business Sales Team members (role_id = 2) should receive email
3. **Email Subject**: "New Campaign Uploaded"
4. **Email Content**: Should include campaign name and campaign code

### Expected Email Content
```
Subject: New Campaign Uploaded

Dear [User Name],

A new campaign has been uploaded with campaign name Summer Marketing Campaign 2024 and campaign code CAMP00001.

Please review the campaign details in your dashboard.

Sincerely,
[Company Name] Team
```

---

## 🧪 Step 5: Test Scenarios

### Scenario 1: Basic Campaign Creation
**Test**: Create campaign with minimal data
```json
{
  "campaign_name": "Test Campaign"
}
```
**Expected**: Campaign created, emails sent to all CP and BST users

### Scenario 2: Campaign with File Upload
**Test**: Create campaign with proof attachment
**Expected**: Campaign created with file, emails sent to all CP and BST users

### Scenario 3: No CP/BST Users
**Test**: Create campaign when no CP or BST users exist
**Expected**: Campaign created successfully, no emails sent (logged in console)

### Scenario 4: Users Without Email
**Test**: Create campaign when some users don't have email addresses
**Expected**: Campaign created, emails sent only to users with valid emails

### Scenario 5: Email Configuration Missing
**Test**: Create campaign when email configuration is not set
**Expected**: Campaign created, emails sent using default SMTP configuration

### Scenario 6: Email Sending Failure
**Test**: Create campaign when email service is down
**Expected**: Campaign created successfully, email errors logged but don't fail campaign creation

---

## 🔍 Step 6: Debugging

### Check Database
Verify CP and BST users exist:
```sql
-- Check CP users
SELECT user_id, user, email, role_id, user_status 
FROM db_users 
WHERE role_id = 1 AND user_status = true AND deletedAt IS NULL;

-- Check BST users
SELECT user_id, user, email, role_id, user_status 
FROM db_users 
WHERE role_id = 2 AND user_status = true AND deletedAt IS NULL;
```

### Check Email Configuration
```sql
SELECT * FROM db_email_config;
```

### Check Email Templates
```sql
SELECT * FROM db_email_templates WHERE template_id = 18;
```

### Check Campaign Created
```sql
SELECT * FROM db_media_campaigns ORDER BY campaign_id DESC LIMIT 1;
```

---

## 📝 Postman Collection JSON

You can import this into Postman:

```json
{
  "info": {
    "name": "Campaign Email Notification Test",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Login",
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
          "raw": "{\n  \"email\": \"your-email@example.com\",\n  \"password\": \"your-password\"\n}"
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
      "name": "Create Campaign",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}",
            "type": "text"
          },
          {
            "key": "m_id",
            "value": "{{menu_id}}",
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
      "key": "token",
      "value": "",
      "type": "string"
    },
    {
      "key": "menu_id",
      "value": "",
      "type": "string"
    }
  ]
}
```

---

## 🎯 Quick Test Checklist

- [ ] Server is running
- [ ] Authentication token obtained
- [ ] CP users exist in database with emails
- [ ] BST users exist in database with emails
- [ ] Email configuration set up (optional)
- [ ] Campaign created successfully
- [ ] Server logs show email sending
- [ ] CP users received emails
- [ ] BST users received emails
- [ ] Email content is correct

---

## 🐛 Troubleshooting

### Issue: "No token Found"
**Solution**: Add `Authorization: Bearer <token>` header

### Issue: "not authorised"
**Solution**: Add `m_id` header or `pass: pass` header (for testing)

### Issue: Emails not sending
**Solution**: 
1. Check server logs for errors
2. Verify CP/BST users exist with emails
3. Check email configuration
4. Verify SMTP settings

### Issue: Campaign created but no emails
**Solution**:
1. Check if CP/BST users exist: `role_id = 1` (CP) or `role_id = 2` (BST)
2. Verify users have `user_status = true`
3. Verify users have `deletedAt IS NULL`
4. Check users have valid email addresses
5. Check server console logs for email sending status

### Issue: Email template not found
**Solution**: 
- The system will use file template as fallback
- Check if `mail/cp/campaignCreation.html` exists
- System will use simple fallback template if file not found

---

## 📞 Support

If you encounter issues:
1. Check server console logs
2. Verify database setup
3. Check email configuration
4. Verify user roles and emails
5. Check network connectivity for email service

---

*Last Updated: Based on current implementation*

