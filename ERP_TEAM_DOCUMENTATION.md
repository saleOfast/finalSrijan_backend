# ERP Integration Documentation for ERP Team

## Quick Summary
**3 APIs** for booking management: Create Lead, Create Booking, Update Booking Status.

---

## ⚠️ Important: Booking Flow Requirement

### RECOMMENDED: Always link bookings to leads

Bookings work WITHOUT leads, but we STRONGLY recommend linking them:

✅ **Why link bookings to leads:**
- Track customer journey (lead → booking)
- Generate reports (conversion rates)
- Query: "Show all bookings for customer X"
- Better data integrity

✅ **How to link:**
- Include `erp_lead_id` in your booking payload
- System will automatically find and link the lead

---

## API #1: Create/Update Lead

**Endpoint:** `POST /api/erp/webhook/lead`

**Purpose:** Create a new lead or update existing one

**Required Fields:**
```json
{
  "erp_lead_id": "ERP-LEAD-001",     // Your lead ID
  "LOI_Number": "LOI-2024-001",
  "lead_name": "Customer Name",
  "email": "customer@example.com",
  "contact_no": "9876543210",
  "project": "Project Name",
  "CP_Name": "Channel Partner Name",
  "location": "Address",
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

---

## API #2: Create/Update Booking

**Endpoint:** `POST /api/erp/webhook/booking`

**Purpose:** Create a booking and link it to an existing lead

### ⭐ CRITICAL: Always include erp_lead_id

**Required Fields:**
```json
{
  "erp_booking_id": "erp-2",           // Your booking ID
  "sales_booking_id": "BK-2025-11",    // Internal booking ID
  "erp_lead_id": "erp_1",               // ⭐ REQUIRED for linking!
  
  "booking_name": "Customer Name",
  "email": "customer@example.com",
  "contact_no": "9876543210",
  "project_name": "Project Name",
  "cp_name": "Channel Partner Name",
  "location": "Address",
  "pincode": "122003",
  "created_at": "2025-10-24T10:00:00Z",
  "recieved_date": "2025-10-24",
  "recieved_time": "15:00",
  "flat_number": "A-403",
  "block_number": "Tower A",
  "buyer_id": "BUY-1102",
  "visit_done_date": "2025-10-23",
  "visit_done_time": "11:30",
  "visit_remarks": "Interested in booking",
  "created_by": "Aakash",
  "status": "Payment Initiated"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "booking_id": 3,
    "lead_id": 19,                      // ✅ Successfully linked!
    "erp_booking_id": "erp-2",
    "sales_booking_id": "BK-2025-11",
    ...
  }
}
```

### What happens if you DON'T provide erp_lead_id?
```json
{
  // Without erp_lead_id
  "erp_booking_id": "erp-2",
  ...
}
```
Response:
```json
{
  "lead_id": null,  // ⚠️ No lead connection
  ...
}
```
**System will:**
- Create booking successfully
- Log a WARNING: "Booking created without lead"
- Booking won't be traceable to customer

---

## API #3: Update Booking Status

**Endpoint:** `POST /api/erp/webhook/booking/status`

**Purpose:** Update booking status only

**Required Fields:**
```json
{
  "sales_booking_id": "BK-2025-11",    // OR
  "erp_booking_id": "erp-2",           // One of these
  "status": "Payment Received"
}
```

**Valid Status Values:**
- `"Payment Initiated"`
- `"Payment Received"`
- `"Payment Rejected"`
- `"Booking Done"`
- `"Eligible for brokerage bill"`
- `"Bill Received"`
- `"Bill sent"`
- `"VISIT DONE NOT BOOKED"`

**Response:**
```json
{
  "success": true,
  "data": {
    "booking_id": 3,
    "status": "Payment Received",  // ✅ Updated
    ...
  }
}
```

---

## Recommended Workflow

### Scenario: New Customer Booking

**Step 1: Create Lead**
```bash
POST /api/erp/webhook/lead
{
  "erp_lead_id": "erp_1",
  "lead_name": "Neeraj Sharma",
  ...
}
```
✅ Response: `{ "lead_id": 19, "erp_lead_id": "erp_1" }`

**Step 2: Create Booking (Link to Lead)**
```bash
POST /api/erp/webhook/booking
{
  "erp_booking_id": "erp-2",
  "erp_lead_id": "erp_1",  // ⭐ Link to Step 1
  ...
}
```
✅ Response: `{ "booking_id": 3, "lead_id": 19 }`

**Step 3: Update Status (Optional)**
```bash
POST /api/erp/webhook/booking/status
{
  "sales_booking_id": "BK-2025-11",
  "status": "Payment Received"
}
```
✅ Response: `{ "status": "Payment Received" }`

---

## Auto-Linking Features

### What Gets Auto-Linked?

| Field in Payload | What it does | Example |
|------------------|--------------|---------|
| `erp_lead_id` | Finds lead by `erp_lead_id` and links booking | `"erp_1"` → finds lead → links `lead_id` |
| `project_name` | Finds project by name and links booking | `"Skyline Residency"` → finds project → links `project_id` |
| `lead_id` | Direct link (if you know internal ID) | `19` → directly links |

### Auto-Linking Examples

**Example 1: Auto-link lead**
```json
{
  "erp_booking_id": "erp-2",
  "erp_lead_id": "erp_1"  // ⬅️ System finds lead and sets lead_id=19
}
```

**Example 2: Auto-link project**
```json
{
  "erp_booking_id": "erp-2",
  "project_name": "Skyline Residency"  // ⬅️ System finds project and sets project_id=123
}
```

**Example 3: Both**
```json
{
  "erp_booking_id": "erp-2",
  "erp_lead_id": "erp_1",             // ⬅️ Auto-links lead
  "project_name": "Skyline Residency" // ⬅️ Auto-links project
}
```

---

## Testing Checklist

- [ ] Can create lead successfully
- [ ] Can create booking with `erp_lead_id` (auto-links)
- [ ] Can create booking without `erp_lead_id` (works but warning)
- [ ] Can update existing booking
- [ ] Can update booking status
- [ ] Verify `lead_id` is populated in response
- [ ] Verify `project_id` is populated (if project_name provided)

---

## Common Questions

### Q: Do I need to create lead first?
**A:** Recommended but not required. You can create booking with `erp_lead_id` and system will link it.

### Q: What if erp_lead_id doesn't exist?
**A:** Booking will be created successfully but with `lead_id = null`. WARNING logged.

### Q: Can I update a booking?
**A:** Yes! Use the same `sales_booking_id` and it will update existing booking.

### Q: Can one lead have multiple bookings?
**A:** Yes! A lead can have many bookings (one-to-many relationship).

### Q: What if I send erp_lead_id but lead doesn't exist?
**A:** System will:
1. Try to find lead by erp_lead_id
2. If not found: log warning
3. Still create booking (with lead_id = null)

---

## Summary

✅ **Keep it simple:** Always provide `erp_lead_id` in booking payload  
✅ **Auto-linking:** System finds and links automatically  
✅ **Optional:** Works without lead (not recommended)  
✅ **Status updates:** Use separate API for status changes  

