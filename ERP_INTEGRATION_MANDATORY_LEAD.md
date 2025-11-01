# ERP Integration - Mandatory Lead Policy

## ✅ IMPLEMENTATION COMPLETE

**Lead is now MANDATORY for all bookings.** Bookings will be rejected without a lead.

---

## What Changed

### Before (Optional)
- Bookings could be created without leads
- System would log a warning but still create booking
- `lead_id` would be null

### After (Mandatory) ✅
- **Bookings MUST have a lead**
- System will **REJECT** booking if no lead provided
- Returns error: `"Lead is required. Please provide 'erp_lead_id' or 'lead_id' in the payload."`

---

## How It Works

### Flow 1: Booking WITH erp_lead_id ✅
```json
{
  "erp_booking_id": "erp-2",
  "erp_lead_id": "erp_1",  // ⬅️ REQUIRED
  ...
}
```
**What happens:**
1. System looks up lead by `erp_lead_id: "erp_1"`
2. Finds lead with `lead_id: 19`
3. Automatically links booking (`lead_id = 19`)
4. ✅ Booking created successfully

### Flow 2: Booking WITHOUT lead ❌
```json
{
  "erp_booking_id": "erp-2",
  // Missing erp_lead_id
  ...
}
```
**What happens:**
1. System tries to find lead
2. No lead found
3. ❌ **REJECTED**: Returns error
4. **Response:** `"Lead is required. Please provide 'erp_lead_id' or 'lead_id' in the payload."`

---

## ERP Team Requirements

### What ERP Team Must Do

1. **Create Lead First** (or ensure lead exists)
   ```json
   POST /api/erp/webhook/lead
   {
     "erp_lead_id": "erp_1",
     "lead_name": "Customer Name",
     ...
   }
   ```

2. **Create Booking with Lead Link** (MANDATORY)
   ```json
   POST /api/erp/webhook/booking
   {
     "erp_booking_id": "erp-2",
     "erp_lead_id": "erp_1",  // ⬅️ MANDATORY!
     ...
   }
   ```

### Error Handling

**If booking created without lead:**
```json
{
  "status": 400,
  "message": "Lead is required. Please provide 'erp_lead_id' or 'lead_id' in the payload.",
  "data": null
}
```

**Logs will show:**
```
[BOOKING_xxx] ERP Booking Webhook - Validation Failed: Lead is required
[BOOKING_xxx] ERP Booking Webhook - Provided: erp_lead_id='undefined', lead_id='undefined'
```

---

## Complete Booking Payload (Updated)

```json
{
  // ✅ MANDATORY: Lead Linking
  "erp_lead_id": "erp_1",         // ⬅️ REQUIRED (auto-links to lead)
  
  // Required Identifiers
  "erp_booking_id": "erp-2",
  "sales_booking_id": "BK-2025-11",
  
  // Customer Information
  "booking_name": "Neeraj Sharma",
  "email": "neeraj.sharma@example.com",
  "contact_no": "9876543210",
  
  // Project Information
  "project_name": "Skyline Residency",  // Auto-links to project
  "cp_name": "Dream Homes Pvt Ltd",
  "location": "Sector 45, Gurgaon",
  "pincode": "122003",
  
  // Timestamps
  "created_at": "2025-10-24T10:00:00Z",
  "recieved_date": "2025-10-24",
  "recieved_time": "15:00",
  
  // Property Details
  "flat_number": "A-403",
  "block_number": "Tower A",
  "buyer_id": "BUY-1102",
  
  // Visit Information
  "visit_done_date": "2025-10-23",
  "visit_done_time": "11:30",
  "visit_remarks": "Interested in booking after site visit",
  
  // Status & Creator
  "status": "Payment Initiated",
  "created_by": "Aakash"
}
```

---

## Success Response

```json
{
  "status": 200,
  "message": "ERP booking processed",
  "data": {
    "booking_id": 3,
    "lead_id": 19,              // ✅ Successfully linked!
    "erp_booking_id": "erp-2",
    "sales_booking_id": "BK-2025-11",
    ...
  }
}
```

---

## Validation Logic

### Step-by-Step Process

1. **Check for `erp_lead_id` in payload**
   - ✅ Found: Lookup lead by `erp_lead_id`
   - ❌ Not found: Move to step 2

2. **Check for `lead_id` in payload**
   - ✅ Found: Use directly
   - ❌ Not found: Move to step 3

3. **Validate Lead Exists**
   - If `lead_id` set, verify in database
   - If not in database: Set to null
   - If null: **REJECT**

4. **Create Booking**
   - ✅ If `lead_id` is valid: Create booking
   - ❌ If `lead_id` is null: **ERROR**

---

## Database Impact

### Booking Table Structure
```sql
CREATE TABLE db_lead_booking (
  booking_id INT PRIMARY KEY AUTO_INCREMENT,
  erp_booking_id VARCHAR UNIQUE,
  lead_id INT,                    -- ⬅️ Now REQUIRED in logic (not NULL in DB for backward compatibility)
  ...
  FOREIGN KEY (lead_id) REFERENCES db_lead(lead_id)
)
```

**Note:** Database still allows `lead_id = null`, but application logic now **enforces** it.

---

## Testing

### Test Case 1: Booking with valid erp_lead_id ✅
```json
{
  "erp_booking_id": "test-1",
  "erp_lead_id": "erp_1",
  "booking_name": "Test User",
  ...
}
```
**Expected:** ✅ Success, `lead_id` populated

### Test Case 2: Booking without erp_lead_id ❌
```json
{
  "erp_booking_id": "test-2",
  "booking_name": "Test User",
  ...
}
```
**Expected:** ❌ Error: "Lead is required..."

### Test Case 3: Booking with invalid erp_lead_id ❌
```json
{
  "erp_booking_id": "test-3",
  "erp_lead_id": "invalid_lead_id",
  "booking_name": "Test User",
  ...
}
```
**Expected:** ❌ Error: "Lead is required..."

### Test Case 4: Booking with direct lead_id ✅
```json
{
  "erp_booking_id": "test-4",
  "lead_id": 19,
  "booking_name": "Test User",
  ...
}
```
**Expected:** ✅ Success, uses provided `lead_id`

---

## Migration Notes

### Existing Bookings
- ✅ Old bookings without leads: Remain in database unchanged
- ⚠️ Future bookings: **MUST** have lead

### Rollback
If you need to revert this change:
1. Remove the validation check (lines 430-435)
2. Change from mandatory to warning
3. Keep backward compatibility

---

## Summary

✅ **Lead is now MANDATORY** for all new bookings  
✅ **Auto-linking** still works with `erp_lead_id`  
✅ **Error handling** with clear error messages  
✅ **Logging** for debugging and audit trails  

**All bookings MUST have a lead connection!**

