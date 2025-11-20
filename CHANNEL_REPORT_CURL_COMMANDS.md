# Channel Report API - cURL Commands

## Base URL
```
http://localhost:3000/api/v1/db/channel/report
```
*(Replace `localhost:3000` with your actual server URL and port)*

## Authentication
All endpoints require a **Bearer Token**. Replace `<YOUR_JWT_TOKEN>` with your actual JWT token.

### Which Token to Use for Dashboard & Reports?

**The token you use determines what data you see:**

| Token Type | Role ID | isDB | Data Access | Use Case |
|------------|---------|------|-------------|----------|
| **Admin Token** | Any | `true` | ✅ **Sees ALL data** (no filtering) | **Best for testing all data** |
| **Director Token** | `3` | `false` | ✅ **Sees ALL data** (no filtering) | **Best for testing all data** |
| **BST Token** | `2` | `false` | ⚠️ **Sees only assigned data** (filtered by `assigned_lead = user_id`) | Testing user-specific view |
| **CP Token** | `1` | `false` | ⚠️ **Sees only assigned data** (filtered by `assigned_lead = user_id`) | Testing user-specific view |

**Code Logic:**
```javascript
// From channelDasboard.js and channelReportController.js
if (!req.user.isDB && req.user.role_id != 3) {
    whereLeadClause = {
        assigned_lead: req.user.user_id  // Filter by assigned user
    }
}
// Otherwise: No filtering = See ALL data
```

**Recommendation for Testing:**
- ✅ **Use Admin Token or Director Token** → See ALL data across all users
- ⚠️ **Use BST Token or CP Token** → See only data assigned to that specific user

**Dashboard Endpoints:**
- `/api/v1/db/channel/dashboard` → Regular dashboard (role-based filtering)
- `/api/v1/db/channel/dashboard/admin` → Admin dashboard (shows ALL data, no filtering)

---

## 1. Leads Generated Report

### Get Leads Generated Report (JSON)
```bash
curl -X GET "http://localhost:3000/api/v1/db/channel/report/leads-generated?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

### Get Leads Generated Report (All Time)
```bash
curl -X GET "http://localhost:3000/api/v1/db/channel/report/leads-generated?startDate=2024-01-01&endDate=2024-12-31&type=all" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

### Download Leads Generated Excel
```bash
curl -X GET "http://localhost:3000/api/v1/db/channel/report/leads-generated/download?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -o leads_generated_report.xlsx
```

---

## 2. Visits Created Report

### Get Visits Created Report (JSON)
```bash
curl -X GET "http://localhost:3000/api/v1/db/channel/report/visits-created?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

### Get Visits Created Report (All Time)
```bash
curl -X GET "http://localhost:3000/api/v1/db/channel/report/visits-created?startDate=2024-01-01&endDate=2024-12-31&type=all" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

### Download Visits Created Excel
```bash
curl -X GET "http://localhost:3000/api/v1/db/channel/report/visits-created/download?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -o visits_created_report.xlsx
```

---

## 3. Visits Completed Report

### Get Visits Completed Report (JSON)
```bash
curl -X GET "http://localhost:3000/api/v1/db/channel/report/visits-completed?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

### Get Visits Completed Report (All Time)
```bash
curl -X GET "http://localhost:3000/api/v1/db/channel/report/visits-completed?startDate=2024-01-01&endDate=2024-12-31&type=all" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

### Download Visits Completed Excel
```bash
curl -X GET "http://localhost:3000/api/v1/db/channel/report/visits-completed/download?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -o visits_completed_report.xlsx
```

---

## 4. Bookings Completed Report

### Get Bookings Completed Report (JSON)
```bash
curl -X GET "http://localhost:3000/api/v1/db/channel/report/bookings-completed?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

### Get Bookings Completed Report (All Time)
```bash
curl -X GET "http://localhost:3000/api/v1/db/channel/report/bookings-completed?startDate=2024-01-01&endDate=2024-12-31&type=all" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

### Download Bookings Completed Excel
```bash
curl -X GET "http://localhost:3000/api/v1/db/channel/report/bookings-completed/download?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -o bookings_completed_report.xlsx
```

---

## Windows PowerShell Commands

### Get Leads Generated Report (JSON)
```powershell
$headers = @{
    "Authorization" = "Bearer <YOUR_JWT_TOKEN>"
    "Content-Type" = "application/json"
}
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/db/channel/report/leads-generated?startDate=2024-01-01&endDate=2024-12-31" -Method Get -Headers $headers
```

### Download Leads Generated Excel (PowerShell)
```powershell
$headers = @{
    "Authorization" = "Bearer <YOUR_JWT_TOKEN>"
}
Invoke-WebRequest -Uri "http://localhost:3000/api/v1/db/channel/report/leads-generated/download?startDate=2024-01-01&endDate=2024-12-31" -Method Get -Headers $headers -OutFile "leads_generated_report.xlsx"
```

### Get Visits Created Report (JSON)
```powershell
$headers = @{
    "Authorization" = "Bearer <YOUR_JWT_TOKEN>"
    "Content-Type" = "application/json"
}
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/db/channel/report/visits-created?startDate=2024-01-01&endDate=2024-12-31" -Method Get -Headers $headers
```

### Download Visits Created Excel (PowerShell)
```powershell
$headers = @{
    "Authorization" = "Bearer <YOUR_JWT_TOKEN>"
}
Invoke-WebRequest -Uri "http://localhost:3000/api/v1/db/channel/report/visits-created/download?startDate=2024-01-01&endDate=2024-12-31" -Method Get -Headers $headers -OutFile "visits_created_report.xlsx"
```

### Get Visits Completed Report (JSON)
```powershell
$headers = @{
    "Authorization" = "Bearer <YOUR_JWT_TOKEN>"
    "Content-Type" = "application/json"
}
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/db/channel/report/visits-completed?startDate=2024-01-01&endDate=2024-12-31" -Method Get -Headers $headers
```

### Download Visits Completed Excel (PowerShell)
```powershell
$headers = @{
    "Authorization" = "Bearer <YOUR_JWT_TOKEN>"
}
Invoke-WebRequest -Uri "http://localhost:3000/api/v1/db/channel/report/visits-completed/download?startDate=2024-01-01&endDate=2024-12-31" -Method Get -Headers $headers -OutFile "visits_completed_report.xlsx"
```

### Get Bookings Completed Report (JSON)
```powershell
$headers = @{
    "Authorization" = "Bearer <YOUR_JWT_TOKEN>"
    "Content-Type" = "application/json"
}
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/db/channel/report/bookings-completed?startDate=2024-01-01&endDate=2024-12-31" -Method Get -Headers $headers
```

### Download Bookings Completed Excel (PowerShell)
```powershell
$headers = @{
    "Authorization" = "Bearer <YOUR_JWT_TOKEN>"
}
Invoke-WebRequest -Uri "http://localhost:3000/api/v1/db/channel/report/bookings-completed/download?startDate=2024-01-01&endDate=2024-12-31" -Method Get -Headers $headers -OutFile "bookings_completed_report.xlsx"
```

---

## Using Variables in cURL

### Set Token as Environment Variable (Linux/Mac)
```bash
export TOKEN="your_jwt_token_here"
export BASE_URL="http://localhost:3000"
export START_DATE="2024-01-01"
export END_DATE="2024-12-31"
```

### Then use in commands:
```bash
curl -X GET "${BASE_URL}/api/v1/db/channel/report/leads-generated?startDate=${START_DATE}&endDate=${END_DATE}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json"
```

---

## Pretty Print JSON Response

### Using jq (if installed)
```bash
curl -X GET "http://localhost:3000/api/v1/db/channel/report/leads-generated?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" | jq .
```

### Using Python (if jq not available)
```bash
curl -X GET "http://localhost:3000/api/v1/db/channel/report/leads-generated?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" | python -m json.tool
```

---

## Quick Test Script (Bash)

Save this as `test_reports.sh`:

```bash
#!/bin/bash

# Configuration
TOKEN="<YOUR_JWT_TOKEN>"
BASE_URL="http://localhost:3000"
START_DATE="2024-01-01"
END_DATE="2024-12-31"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Testing Channel Report Endpoints..."
echo ""

# Test 1: Leads Generated
echo -e "${GREEN}Testing Leads Generated Report...${NC}"
curl -X GET "${BASE_URL}/api/v1/db/channel/report/leads-generated?startDate=${START_DATE}&endDate=${END_DATE}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | head -20
echo ""

# Test 2: Visits Created
echo -e "${GREEN}Testing Visits Created Report...${NC}"
curl -X GET "${BASE_URL}/api/v1/db/channel/report/visits-created?startDate=${START_DATE}&endDate=${END_DATE}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | head -20
echo ""

# Test 3: Visits Completed
echo -e "${GREEN}Testing Visits Completed Report...${NC}"
curl -X GET "${BASE_URL}/api/v1/db/channel/report/visits-completed?startDate=${START_DATE}&endDate=${END_DATE}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | head -20
echo ""

# Test 4: Bookings Completed
echo -e "${GREEN}Testing Bookings Completed Report...${NC}"
curl -X GET "${BASE_URL}/api/v1/db/channel/report/bookings-completed?startDate=${START_DATE}&endDate=${END_DATE}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | head -20
echo ""

echo -e "${GREEN}All tests completed!${NC}"
```

Make it executable:
```bash
chmod +x test_reports.sh
./test_reports.sh
```

---

## Quick Test Script (PowerShell)

Save this as `test_reports.ps1`:

```powershell
# Configuration
$TOKEN = "<YOUR_JWT_TOKEN>"
$BASE_URL = "http://localhost:3000"
$START_DATE = "2024-01-01"
$END_DATE = "2024-12-31"

$headers = @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
}

Write-Host "Testing Channel Report Endpoints..." -ForegroundColor Green
Write-Host ""

# Test 1: Leads Generated
Write-Host "Testing Leads Generated Report..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/v1/db/channel/report/leads-generated?startDate=$START_DATE&endDate=$END_DATE" -Method Get -Headers $headers
    Write-Host "Success! Records found: $($response.data.Count)" -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 2: Visits Created
Write-Host "Testing Visits Created Report..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/v1/db/channel/report/visits-created?startDate=$START_DATE&endDate=$END_DATE" -Method Get -Headers $headers
    Write-Host "Success! Records found: $($response.data.Count)" -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 3: Visits Completed
Write-Host "Testing Visits Completed Report..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/v1/db/channel/report/visits-completed?startDate=$START_DATE&endDate=$END_DATE" -Method Get -Headers $headers
    Write-Host "Success! Records found: $($response.data.Count)" -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 4: Bookings Completed
Write-Host "Testing Bookings Completed Report..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/v1/db/channel/report/bookings-completed?startDate=$START_DATE&endDate=$END_DATE" -Method Get -Headers $headers
    Write-Host "Success! Records found: $($response.data.Count)" -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "All tests completed!" -ForegroundColor Green
```

Run it:
```powershell
.\test_reports.ps1
```

---

## Common Issues & Solutions

### Issue 1: "No Token Found!"
**Solution:** Make sure there's a space between "Bearer" and the token:
```bash
-H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

### Issue 2: URL Encoding Issues
**Solution:** Use quotes around the URL or encode special characters:
```bash
curl -X GET "http://localhost:3000/api/v1/db/channel/report/leads-generated?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

### Issue 3: Excel File Not Downloading
**Solution:** Make sure to use `-o` flag to save the file:
```bash
curl -X GET "..." -H "Authorization: Bearer <TOKEN>" -o filename.xlsx
```

### Issue 4: SSL Certificate Issues
**Solution:** Use `-k` flag (insecure, for testing only):
```bash
curl -k -X GET "https://..." -H "Authorization: Bearer <TOKEN>"
```

---

## Example with Real Dates

### Get Current Month Reports
```bash
# Get current month start and end dates
START_DATE=$(date +%Y-%m-01)
END_DATE=$(date +%Y-%m-%d)

curl -X GET "http://localhost:3000/api/v1/db/channel/report/leads-generated?startDate=${START_DATE}&endDate=${END_DATE}" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

### Get Last 30 Days
```bash
START_DATE=$(date -d "30 days ago" +%Y-%m-%d)
END_DATE=$(date +%Y-%m-%d)

curl -X GET "http://localhost:3000/api/v1/db/channel/report/leads-generated?startDate=${START_DATE}&endDate=${END_DATE}" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json"
```

---

## Notes

1. **Replace `<YOUR_JWT_TOKEN>`** with your actual JWT token
2. **Replace `localhost:3000`** with your actual server URL
3. **Date Format:** Always use `YYYY-MM-DD` format
4. **Excel Downloads:** Files will be saved in the current directory
5. **Windows Users:** Use PowerShell commands or Git Bash for curl

