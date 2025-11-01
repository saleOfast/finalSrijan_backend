# ERP Integration Guide

## Overview
This guide explains how the ERP team should interact with the 3 booking-related APIs.

## API Flow

### Flow Diagram
```
ERP System → 1. Create/Update Lead → Get lead_id
           → 2. Create/Update Booking → Get booking_id
           → 3. Update Booking Status
```

### APIs Available

#### 1. Create/Update Lead API
**Endpoint:** `/api/erp/webhook/lead`  
**Method:** POST  
**Purpose:** Creates a new lead or updates an existing one

#### 2. Create/Update Booking API  
**Endpoint:** `/api/erp/webhook/booking`  
**Method:** POST  
**Purpose:** Creates a new booking or updates an existing one, **links to lead automatically**

#### 3. Update Booking Status API
**Endpoint:** `/api/erp/webhook/booking/status`  
**Method:** POST  
**Purpose:** Updates booking status only (e.g., "Payment Initiated" → "Payment Received")

---

## Step-by-Step Integration

### Option A: Two-Step Process (Recommended)

**Step 1: Create Lead First**
```json
{
  "erp_lead_id": "ERP-LEAD-001",
  "LOI_Number": "LOI-2024-001",
  "lead_name": "Neeraj Sharma",
  "email": "neeraj.sharma@example.com",
  "contact_no": "9876543210",
  "project": "Skyline Residency",
  "CP_Name": "Dream Homes Pvt Ltd",
  "location": "Sector 45, Gurgaon",
  "pincode": "122003",
  "created_at": "2025-10-24T10:00:00Z",
  "visit_date": "2025-10-23",
  "visit_time": "11:30",
  "created_by": "Aakash",
  "budget_range": "50-70 Lakhs",
  "size": "1200 sqft",
  "type_of_bhk": "3 BHK",
  "lead_valid_upto": "2025-12-31",
  "zone": "North",
  "zone_area": "Gurgaon",
  "aadhar": "1234-5678-9012"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "lead_id": 123,
    "lead_code": "ASL_00001",
    "erp_lead_id": "ERP-LEAD-001",
    ...
  }
}
```

**Step 2: Create Booking (Link to Lead)**
```json
{
  "erp_booking_id": "erp-2",
  "sales_booking_id": "BK-2025-11",
  "booking_name": "Neeraj Sharma",
  "email": "neeraj.sharma@example.com",
  "contact_no": "9876543210",
  "project": "Skyline Residency",
  "cp_name": "Dream Homes Pvt Ltd",
  "location": "Sector 45, Gurgaon",
  "pincode": "122003",
  "created_at": "2025-10-24T10:00:00Z",
  "recieved_date": "2025-10-24",
  "recieved_time": "15:00",
  "flat_number": "A-403",
  "block_number": "Tower A",
  "buyer_id": "BUY-1102",
  "visit_done_date": "2025-10-23",
  "visit_done_time": "11:30",
  "visit_remarks": "Interested in booking after site visit",
  "created_by": "Aakash",
  "status": "Payment Initiated",
  "erp_lead_id": "ERP-LEAD-001"
}
```

**⚠️ Important:** Include `erp_lead_id` in your booking payload to automatically link the booking to the lead!

**Response:**
```json
{
  "success": true,
  "data": {
    "booking_id": 456,
    "lead_id": 123,
    "sales_booking_id": "BK-2025-11",
    "erp_booking_id": "erp-2",
    ...
  }
}
```

**Step 3: Update Booking Status**
```json
{
  "sales_booking_id": "BK-2025-11",
  "status": "Payment Received"
}
```

Or using ERP booking ID:
```json
{
  "erp_booking_id": "erp-2",
  "status": "Payment Received"
}
```

---

## What Changed?

### Before (Your Original Code)
- Booking was created without linking to lead
- Missing `erp_lead_id` field handling
- No automatic lead lookup

### After (Fixed Code)
✅ **Automatic Lead Linking:** If you provide `erp_lead_id` in the booking payload, the system will automatically find and link to the existing lead

✅ **Two Linking Options:**
1. `erp_lead_id` - Automatically looks up and links to lead
2. `lead_id` - Direct link (if you already have the internal lead_id)

---

## Complete Booking Payload Structure

```json
{
  // IDENTIFIERS (Required)
  "erp_booking_id": "erp-2",              // Required: Your ERP booking ID
  "sales_booking_id": "BK-2025-11",       // Optional: Internal booking ID
  
  // CUSTOMER INFO (Required)
  "booking_name": "Neeraj Sharma",
  "email": "neeraj.sharma@example.com",
  "contact_no": "9876543210",
  
  // PROJECT INFO (Required)
  "project": "Skyline Residency",
  "cp_name": "Dream Homes Pvt Ltd",
  "location": "Sector 45, Gurgaon",
  "pincode": "122003",
  
  // TIMESTAMPS (Required)
  "created_at": "2025-10-24T10:00:00Z",
  "recieved_date": "2025-10-24",
  "recieved_time": "15:00",
  
  // PROPERTY DETAILS (Required)
  "flat_number": "A-403",
  "block_number": "Tower A",
  "buyer_id": "BUY-1102",
  
  // VISIT INFO (Required)
  "visit_done_date": "2025-10-23",
  "visit_done_time": "11:30",
  "visit_remarks": "Interested in booking after site visit",
  
  // STATUS & CREATOR (Required)
  "status": "Payment Initiated",
  "created_by": "Aakash",
  
  // ⭐ NEW: LEAD LINKING (Optional but Recommended)
  "erp_lead_id": "ERP-LEAD-001",  // ⬅️ USE THIS to auto-link to lead!
  
  // Alternative linking options
  "lead_id": 123,                  // Direct internal lead ID
  "project_id": 456                // Internal project ID
}
```

---

## Valid Booking Status Values

The booking status must be one of:
- `"Payment Initiated"`
- `"Payment Received"`
- `"Payment Rejected"`
- `"Booking Done"`
- `"Eligible for brokerage bill"`
- `"Bill Received"`
- `"Bill sent"`
- `"VISIT DONE NOT BOOKED"`

---

## Example Workflow

### Scenario: Customer completes booking

**1. Lead already exists? → Check and use existing lead_id**
   - If yes: Use `erp_lead_id` in booking payload
   - If no: Create lead first, then create booking

**2. Create/Update booking with lead linking**
   ```json
   {
     "erp_booking_id": "erp-2",
     "erp_lead_id": "ERP-LEAD-001",  // ⬅️ Links to existing lead
     ...
   }
   ```

**3. Update status as payment progresses**
   - Status: `"Payment Initiated"` → `"Payment Received"` → `"Booking Done"`

---

## Common Questions

### Q: Do I need to provide `lead_id` in the booking?
**A:** No! Just provide `erp_lead_id` and the system will automatically link it.

### Q: What if I don't have an existing lead?
**A:** Create the lead first using API #1, then create the booking with `erp_lead_id`.

### Q: Can I create a booking without a lead?
**A:** Yes, but it won't be linked to any lead. The booking will exist independently.

### Q: What if the `erp_lead_id` doesn't exist?
**A:** The booking will be created without a lead link. The system will log a warning but won't fail.

---

## Testing Recommendations

1. **Test Lead Creation:** Ensure you can create a lead and get back the `lead_id`
2. **Test Booking with Auto-Link:** Create a booking with `erp_lead_id` and verify the `lead_id` is populated
3. **Test Status Updates:** Update booking status and verify the change
4. **Test Updates:** Use the same `sales_booking_id` to update existing bookings

