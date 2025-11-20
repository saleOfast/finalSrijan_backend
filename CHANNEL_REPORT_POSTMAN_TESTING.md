# Channel Report API - Postman Testing Guide

## Base URL
```
http://localhost:3000/api/v1/db/channel/report
```
*(Replace `localhost:3000` with your actual server URL and port)*

## Authentication
All endpoints require a **Bearer Token** in the Authorization header.

**Header:**
```
Authorization: Bearer <your_jwt_token>
```

## Query Parameters
All report endpoints support the following query parameters:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `startDate` | String | Yes | Start date in YYYY-MM-DD format | `2024-01-01` |
| `endDate` | String | Yes | End date in YYYY-MM-DD format | `2024-12-31` |
| `type` | String | No | Set to `'all'` for all-time data | `all` |

---

## 1. Leads Generated Report

### Get Leads Generated Report
**Method:** `GET`  
**URL:** 
```
http://localhost:3000/api/v1/db/channel/report/leads-generated?startDate=2024-01-01&endDate=2024-12-31
```

**Example with all-time data:**
```
http://localhost:3000/api/v1/db/channel/report/leads-generated?startDate=2024-01-01&endDate=2024-12-31&type=all
```

**Headers:**
```
Authorization: Bearer <your_token>
Content-Type: application/json
```

**Expected Response:**
```json
{
  "status": 200,
  "message": "Leads Generated Report",
  "data": [
    {
      "lead_id": 1,
      "lead_name": "John Doe",
      "email_id": "john@example.com",
      "p_contact_no": "1234567890",
      "address": "123 Main St",
      "pincode": "12345",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "db_user": {
        "user_id": 1,
        "user": "Sales Person Name"
      },
      "projectData": {
        "project_id": 1,
        "project_name": "Project Name"
      }
    }
  ]
}
```

### Download Leads Generated Excel
**Method:** `GET`  
**URL:**
```
http://localhost:3000/api/v1/db/channel/report/leads-generated/download?startDate=2024-01-01&endDate=2024-12-31
```

**Headers:**
```
Authorization: Bearer <your_token>
```

**Expected Response:** Excel file download (`leads_generated_report.xlsx`)

---

## 2. Visits Created Report

### Get Visits Created Report
**Method:** `GET`  
**URL:**
```
http://localhost:3000/api/v1/db/channel/report/visits-created?startDate=2024-01-01&endDate=2024-12-31
```

**Headers:**
```
Authorization: Bearer <your_token>
Content-Type: application/json
```

**Expected Response:**
```json
{
  "status": 200,
  "message": "Visits Created Report",
  "data": [
    {
      "visit_id": 1,
      "visit_code": "VIS001",
      "status": "Requested",
      "p_visit_date": "2024-01-20",
      "p_visit_time": "10:00:00",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "leadData": {
        "lead_id": 1,
        "lead_name": "John Doe",
        "email_id": "john@example.com",
        "p_contact_no": "1234567890",
        "db_user": {
          "user_id": 1,
          "user": "Sales Person Name"
        },
        "projectData": {
          "project_id": 1,
          "project_name": "Project Name"
        }
      }
    }
  ]
}
```

### Download Visits Created Excel
**Method:** `GET`  
**URL:**
```
http://localhost:3000/api/v1/db/channel/report/visits-created/download?startDate=2024-01-01&endDate=2024-12-31
```

**Expected Response:** Excel file download (`visits_created_report.xlsx`)

---

## 3. Visits Completed Report

### Get Visits Completed Report
**Method:** `GET`  
**URL:**
```
http://localhost:3000/api/v1/db/channel/report/visits-completed?startDate=2024-01-01&endDate=2024-12-31
```

**Headers:**
```
Authorization: Bearer <your_token>
Content-Type: application/json
```

**Expected Response:**
```json
{
  "status": 200,
  "message": "Visits Completed Report",
  "data": [
    {
      "visit_id": 1,
      "visit_code": "VIS001",
      "status": "Completed",
      "p_visit_date": "2024-01-20",
      "p_visit_time": "10:00:00",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "leadData": {
        "lead_id": 1,
        "lead_name": "John Doe",
        "email_id": "john@example.com",
        "p_contact_no": "1234567890",
        "db_user": {
          "user_id": 1,
          "user": "Sales Person Name"
        },
        "projectData": {
          "project_id": 1,
          "project_name": "Project Name"
        }
      }
    }
  ]
}
```

### Download Visits Completed Excel
**Method:** `GET`  
**URL:**
```
http://localhost:3000/api/v1/db/channel/report/visits-completed/download?startDate=2024-01-01&endDate=2024-12-31
```

**Expected Response:** Excel file download (`visits_completed_report.xlsx`)

---

## 4. Bookings Completed Report

### Get Bookings Completed Report
**Method:** `GET`  
**URL:**
```
http://localhost:3000/api/v1/db/channel/report/bookings-completed?startDate=2024-01-01&endDate=2024-12-31
```

**Headers:**
```
Authorization: Bearer <your_token>
Content-Type: application/json
```

**Expected Response:**
```json
{
  "status": 200,
  "message": "Bookings Completed Report",
  "data": [
    {
      "booking_id": 1,
      "booking_code": "BK001",
      "booking_name": "John Doe",
      "email": "john@example.com",
      "contact_no": "1234567890",
      "Location": "123 Main St",
      "pincode": "12345",
      "visit_done_date": "2024-01-20",
      "visit_done_time": "10:00:00",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "BookingleadData": {
        "lead_id": 1,
        "lead_name": "John Doe",
        "email_id": "john@example.com",
        "p_contact_no": "1234567890",
        "db_user": {
          "user_id": 1,
          "user": "Sales Person Name"
        },
        "projectData": {
          "project_id": 1,
          "project_name": "Project Name"
        }
      },
      "BookingprojectData": {
        "project_id": 1,
        "project_name": "Project Name"
      }
    }
  ]
}
```

### Download Bookings Completed Excel
**Method:** `GET`  
**URL:**
```
http://localhost:3000/api/v1/db/channel/report/bookings-completed/download?startDate=2024-01-01&endDate=2024-12-31
```

**Expected Response:** Excel file download (`bookings_completed_report.xlsx`)

---

## Postman Collection Setup

### Step 1: Create a New Collection
1. Open Postman
2. Click "New" → "Collection"
3. Name it "Channel Reports"

### Step 2: Set Collection Variables
Go to the Collection → Variables tab and add:

| Variable | Initial Value | Current Value |
|----------|---------------|----------------|
| `base_url` | `http://localhost:3000` | `http://localhost:3000` |
| `token` | `your_jwt_token_here` | `your_jwt_token_here` |
| `startDate` | `2024-01-01` | `2024-01-01` |
| `endDate` | `2024-12-31` | `2024-12-31` |

### Step 3: Set Collection Authorization
1. Go to Collection → Authorization tab
2. Type: **Bearer Token**
3. Token: `{{token}}`

### Step 4: Create Requests

#### Request 1: Get Leads Generated Report
- **Method:** GET
- **URL:** `{{base_url}}/api/v1/db/channel/report/leads-generated?startDate={{startDate}}&endDate={{endDate}}`
- **Authorization:** Inherit from parent (Collection)

#### Request 2: Download Leads Generated Excel
- **Method:** GET
- **URL:** `{{base_url}}/api/v1/db/channel/report/leads-generated/download?startDate={{startDate}}&endDate={{endDate}}`
- **Authorization:** Inherit from parent

#### Request 3: Get Visits Created Report
- **Method:** GET
- **URL:** `{{base_url}}/api/v1/db/channel/report/visits-created?startDate={{startDate}}&endDate={{endDate}}`
- **Authorization:** Inherit from parent

#### Request 4: Download Visits Created Excel
- **Method:** GET
- **URL:** `{{base_url}}/api/v1/db/channel/report/visits-created/download?startDate={{startDate}}&endDate={{endDate}}`
- **Authorization:** Inherit from parent

#### Request 5: Get Visits Completed Report
- **Method:** GET
- **URL:** `{{base_url}}/api/v1/db/channel/report/visits-completed?startDate={{startDate}}&endDate={{endDate}}`
- **Authorization:** Inherit from parent

#### Request 6: Download Visits Completed Excel
- **Method:** GET
- **URL:** `{{base_url}}/api/v1/db/channel/report/visits-completed/download?startDate={{startDate}}&endDate={{endDate}}`
- **Authorization:** Inherit from parent

#### Request 7: Get Bookings Completed Report
- **Method:** GET
- **URL:** `{{base_url}}/api/v1/db/channel/report/bookings-completed?startDate={{startDate}}&endDate={{endDate}}`
- **Authorization:** Inherit from parent

#### Request 8: Download Bookings Completed Excel
- **Method:** GET
- **URL:** `{{base_url}}/api/v1/db/channel/report/bookings-completed/download?startDate={{startDate}}&endDate={{endDate}}`
- **Authorization:** Inherit from parent

---

## Quick Test Examples

### Test 1: Get Leads for Current Month
```
GET http://localhost:3000/api/v1/db/channel/report/leads-generated?startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <your_token>
```

### Test 2: Get All Visits Created (All Time)
```
GET http://localhost:3000/api/v1/db/channel/report/visits-created?startDate=2024-01-01&endDate=2024-12-31&type=all
Authorization: Bearer <your_token>
```

### Test 3: Download Bookings Excel
```
GET http://localhost:3000/api/v1/db/channel/report/bookings-completed/download?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <your_token>
```

---

## Common Issues & Solutions

### Issue 1: "No Token Found!"
**Solution:** Make sure you have the Authorization header set correctly:
```
Authorization: Bearer <your_token>
```
(Note: There's a space between "Bearer" and the token)

### Issue 2: "Auth Failed No User found!"
**Solution:** Your token might be expired or invalid. Get a new token from your login endpoint.

### Issue 3: Empty Results
**Solution:** 
- Check if the date range is correct
- Verify you have data in that date range
- Check if you're using the correct user role (non-DB users only see their assigned data)

### Issue 4: Excel Download Not Working
**Solution:**
- Make sure you're using the `/download` endpoint
- Check that the response type is set to handle binary data in Postman
- In Postman, click "Send and Download" instead of just "Send"

---

## Testing Checklist

- [ ] All 4 report endpoints return data successfully
- [ ] All 4 Excel download endpoints download files
- [ ] Date filtering works correctly (startDate and endDate)
- [ ] `type=all` parameter works for all-time data
- [ ] User role filtering works (non-DB users see only their data)
- [ ] Error handling works (invalid dates, missing token, etc.)
- [ ] Excel files contain correct data and columns

---

## Notes

1. **Date Format:** Always use `YYYY-MM-DD` format for dates
2. **Token Expiry:** JWT tokens may expire. Refresh your token if you get authentication errors
3. **User Permissions:** Non-DB users (role_id != 3) will only see data assigned to them
4. **Excel Files:** Excel downloads are saved temporarily and deleted after sending
5. **Date Range:** Make sure `endDate` is after `startDate`

