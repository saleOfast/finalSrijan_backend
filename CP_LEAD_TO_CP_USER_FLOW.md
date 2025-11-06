# Channel Partner (CP) Lead to CP User Flow

This document explains the complete flow from creating a CP Lead to creating a fully functional Channel Partner user.

## 📋 Overview

The process involves multiple steps:
1. **CP Lead Creation** - Initial registration/interested party
2. **CP User Creation** - Admin creates user account from lead
3. **Registration Token** - Email sent with registration link
4. **Complete Registration** - CP completes their profile and documents
5. **BST Assignment** - Automatic assignment to Business Sales Team
6. **Verification & Approval** - Document verification process

---

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: CP LEAD CREATION                                       │
│ POST /api/v1/db/channelPartnerLeads                            │
│ Controller: addChannelPartnerLead                              │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │ Creates CP Lead Record              │
        │ - first_name, last_name             │
        │ - email, contact                   │
        │ - state, city (optional)           │
        │ - stage: 'OPEN'                    │
        │ - Creates lead_details entry        │
        │ - Sends email to admin              │
        └────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: ADMIN CREATES CP USER                                  │
│ POST /api/v1/db/users (with role_id = 1)                       │
│ Controller: createUser                                         │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │ Creates User Account               │
        │ - Creates in db_users table        │
        │ - Creates in db_user_profile table │
        │ - Sets role_id = 1 (CP)            │
        │ - Sets doc_verification = 0        │
        │ - Generates registration token     │
        │ - Sends email with signup link     │
        └────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │ Registration Token Generated       │
        │ JWT Token contains:               │
        │ - id: user_id                     │
        │ - db_name: database name          │
        │ - exp: expiration time            │
        │                                   │
        │ Signup Link Format:               │
        │ {client_url}/partner/Signup?      │
        │   token={registrationToken}       │
        └────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: CP VERIFIES TOKEN (Optional)                           │
│ POST /api/v1/db/users/cp/registrationToken/verification       │
│ Controller: registrationTokenVerification                        │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │ Validates Token                    │
        │ - Checks if token is valid         │
        │ - Checks if token expired          │
        │ - Returns user data if valid       │
        └────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: CP COMPLETES REGISTRATION                              │
│ PUT /api/v1/db/users/cp/completeRegistration                   │
│ Controller: cpCompleteRegistration                              │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │ Registration Process               │
        │ ✅ Validates token                 │
        │ ✅ Validates mandatory fields:     │
        │    - state (required)             │
        │    - city (required)             │
        │    - cp_category (optional)       │
        │ ✅ Validates uploaded files:      │
        │    - aadhar (required)             │
        │    - pan (required)               │
        │    - rera (required)              │
        │    - cheque (optional)            │
        │                                   │
        │ Updates User Data:                │
        │ - name, mobile, user_l_name        │
        │ - gst, organisation, address      │
        │ - state, city (string names)       │
        │ - cp_category (if provided)        │
        │ - Document files                  │
        │ - doc_verification = 1             │
        │                                   │
        │ Saves to:                         │
        │ - db_users table                   │
        │ - db_user_profile table            │
        └────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │ Automatic BST Assignment           │
        │ Function: assignCPLeadToBST       │
        │                                   │
        │ Process:                          │
        │ 1. Finds CP Lead by email/contact │
        │ 2. Finds BST users (role_id=2)    │
        │    matching state                 │
        │ 3. Uses round-robin logic:        │
        │    - Counts assigned leads       │
        │    - Assigns to BST with least   │
        │      leads                        │
        │ 4. Updates CP Lead:               │
        │    - asssigned_to: BST user_id    │
        │    - state, city (updates)        │
        └────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: DOCUMENT VERIFICATION                                  │
│ Admin/BST reviews documents and approves/rejects               │
│ PUT /api/v1/db/users/{id} (with doc_verification)               │
│ Controller: updateUser -> handleAcceptProcess                   │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │ Verification Process               │
        │                                    │
        │ If Approved (doc_verification=2): │
        │ - Updates onboarding_date          │
        │ - Finds CP Lead by email          │
        │ - Updates CP Lead stage to         │
        │   'ONBOARDED'                      │
        │ - Sends password reset email       │
        │                                    │
        │ If Rejected (doc_verification=3):  │
        │ - Sets reject_reason               │
        │ - Updates approval flags           │
        │ - Sends rejection email            │
        └────────────────────────────────────┘
```

---

## 📝 Detailed Steps

### **Step 1: Create CP Lead**

**Endpoint:** `POST /api/v1/db/channelPartnerLeads`

**Request Body:**
```json
{
  "db_name": "client_database_name",
  "first_name": "John",
  "last_name": "Doe",
  "contact": "9876543210",
  "email": "john.doe@example.com",
  "state": "Maharashtra",      // Optional
  "city": "Mumbai"            // Optional
}
```

**What Happens:**
- Checks if lead already exists (by email or contact)
- Creates record in `db_channel_partner_leads` table
- Sets `stage = 'OPEN'`
- Creates corresponding entry in `db_channel_partner_lead_details`
- Sends email notification to admin
- Returns success message

**Database Tables Updated:**
- `db_channel_partner_leads` (new record)
- `db_channel_partner_lead_details` (new record)

---

### **Step 2: Admin Creates CP User**

**Endpoint:** `POST /api/v1/db/users` (Admin only)

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "role_id": 1,              // 1 = Channel Partner
  "user": "John",
  "isCHANNEL": true,
  "cpt_id": 1,              // Optional: Channel Partner Type ID
  "report_to": 123          // Optional: BST user_id
}
```

**What Happens:**
- Validates license availability (checks channel license count)
- Creates user in `db_users` table:
  - `role_id = 1` (Channel Partner)
  - `doc_verification = 0` (Pending)
  - `isCHANNEL = true`
  - Generates `user_code`
- Creates user profile in `db_user_profile` table
- Creates platform permissions in `db_user_platform` table
- **Generates Registration Token** (JWT):
  ```javascript
  {
    id: user_id,
    db_name: database_name,
    exp: expiration_time
  }
  ```
- Sends email with registration link:
  ```
  {client_url}/partner/Signup?token={registrationToken}
  ```

**Database Tables Updated:**
- `db_users` (new record)
- `db_user_profile` (new record)
- `db_user_platform` (new records for each platform)

---

### **Step 3: Verify Registration Token (Optional)**

**Endpoint:** `POST /api/v1/db/users/cp/registrationToken/verification`

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**What Happens:**
- Validates JWT token
- Checks if token expired
- Returns user data if valid

**Use Case:** Frontend can verify token before showing registration form

---

### **Step 4: Complete CP Registration**

**Endpoint:** `PUT /api/v1/db/users/cp/completeRegistration`

**Request Body (multipart/form-data):**
```
token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
name: "John"
mobile: "9876543210"
user_l_name: "Doe"
gst: "27ABCDE1234F1Z5"
organisation: "John's Realty"
address: "123 Main Street"
state: "Maharashtra"           // Required (string name)
city: "Mumbai"                  // Required (string name)
cp_category: "Category A"       // Optional: Category A/B/C/D
aadhar: [file]                  // Required
pan: [file]                     // Required
rera: [file]                    // Required
cheque: [file]                  // Optional
```

**What Happens:**
1. **Token Validation:**
   - Verifies JWT token
   - Checks expiration
   - Extracts `user_id` and `db_name`

2. **Field Validation:**
   - ✅ `state` is required (string name)
   - ✅ `city` is required (string name)
   - ✅ `aadhar` file is required
   - ✅ `pan` file is required
   - ✅ `rera` file is required
   - ✅ `cp_category` is optional (if provided, must be: Category A/B/C/D)

3. **File Upload:**
   - Uploads aadhar file → `uploads/adh/`
   - Uploads pan file → `uploads/pan/`
   - Uploads rera file → `uploads/rera/`
   - Uploads cheque file (if provided) → `uploads/cheque/`

4. **Update User Data:**
   - Updates `db_users` table:
     - `user`, `contact_number`
     - `state`, `city` (string names)
     - `cp_category` (if provided)
     - `doc_verification = 1` (Pending Verification)
   - Updates/Creates `db_user_profile` table:
     - `user_l_name`, `gst`, `organisation`, `address`
     - Document file paths
     - `state`, `city`
     - `cp_category` (if provided)

5. **Automatic BST Assignment:**
   - Calls `assignCPLeadToBST()` function
   - Finds CP Lead by email or contact number
   - Finds BST users (role_id = 2) matching the state
   - Uses round-robin logic to assign to BST with least leads
   - Updates CP Lead:
     - `asssigned_to`: BST user_id
     - `state`, `city`: Updates from registration

**Database Tables Updated:**
- `db_users` (user record updated)
- `db_user_profile` (profile record updated/created)
- `db_channel_partner_leads` (BST assignment updated)

---

### **Step 5: Document Verification & Approval**

**Endpoint:** `PUT /api/v1/db/users/{user_id}` (Admin/BST/Director)

**Request Body:**
```json
{
  "doc_verification": 2,  // 2 = Approved, 3 = Rejected
  "reject_reason": "",    // If rejected
  "bst_approval": true,   // BST approval
  "director_approval": true  // Director approval
}
```

**What Happens:**

**If Approved (doc_verification = 2):**
- Updates `doc_verification = 2`
- Sets `onboarding_date` to current date
- **Finds CP Lead by email** and updates:
  - `stage = 'ONBOARDED'`
- Sends password reset email to CP

**If Rejected (doc_verification = 3):**
- Updates `doc_verification = 3`
- Sets `reject_reason`
- Updates approval flags (`bst_approval`, `director_approval`)
- Sends rejection email to CP

**Database Tables Updated:**
- `db_users` (verification status updated)
- `db_channel_partner_leads` (stage updated to 'ONBOARDED' if approved)

---

## 🔑 Key Fields & Their Purposes

### **CP Lead Fields (`db_channel_partner_leads`):**
- `cpl_id`: Primary key
- `first_name`, `last_name`: CP name
- `email`, `contact`: Contact information
- `state`, `city`: Location (string names)
- `stage`: Lead stage (OPEN, CONTACTED, LINK SENT, ONBOARDED, etc.)
- `asssigned_to`: BST user_id who manages this lead
- `status`: Active/Inactive

### **CP User Fields (`db_users`):**
- `user_id`: Primary key
- `user`, `user_l_name`: Name
- `email`, `contact_number`: Contact info
- `role_id`: 1 = Channel Partner
- `state`, `city`: Location (string names, preferred over IDs)
- `cp_category`: Category A/B/C/D (optional)
- `doc_verification`: 
  - `0` = Registration link sent
  - `1` = Documents uploaded, pending verification
  - `2` = Approved
  - `3` = Rejected
- `bst_approval`, `director_approval`: Approval flags
- `onboarding_date`: Date when approved

### **CP Profile Fields (`db_user_profile`):**
- `user_profle_id`: Primary key
- `user_id`: Foreign key to db_users
- `aadhar_file`, `pan_file`, `rera_file`, `c_cheque_file`: Document paths
- `gst`, `organisation`, `address`: Business information
- `state`, `city`: Location (duplicated from db_users)

---

## 🔄 CP Lead Stage Flow

```
OPEN → CONTACTED → LINK SENT → [User Completes Registration] → ONBOARDED
  │
  ├─→ NOT INTERESTED
  ├─→ CALL
  ├─→ VISIT
  └─→ FOLLOW UP
```

**Stage Changes:**
- **OPEN**: Initial lead creation
- **CONTACTED**: BST has contacted the lead
- **LINK SENT**: Registration link sent (when user created)
- **ONBOARDED**: CP approved and verified (automatic on approval)
- **NOT INTERESTED**: Lead not interested
- **CALL**: Follow-up call scheduled
- **VISIT**: Site visit scheduled (requires OTP)
- **FOLLOW UP**: Follow-up needed

---

## 🎯 Important Notes

1. **State & City:**
   - Always use **string names** (e.g., "Maharashtra", "Mumbai")
   - Not IDs (state_id, city_id)
   - Required in completeRegistration
   - Used for BST assignment matching

2. **CP Category:**
   - Optional field
   - Must be one of: `'Category A'`, `'Category B'`, `'Category C'`, `'Category D'`
   - Validated in registration endpoint

3. **BST Assignment:**
   - Automatic during `completeRegistration`
   - Matches BST users by `state` (string name)
   - Uses round-robin logic (least leads first)
   - Only assigns if CP Lead exists and not already assigned

4. **Document Verification:**
   - `doc_verification = 0`: User created, link sent
   - `doc_verification = 1`: Documents uploaded, pending review
   - `doc_verification = 2`: Approved, CP can login
   - `doc_verification = 3`: Rejected

5. **Email Matching:**
   - CP Lead and CP User are linked by `email` or `contact`
   - Used for automatic BST assignment
   - Used to update lead stage to 'ONBOARDED' on approval

---

## 📍 API Endpoints Summary

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/v1/db/channelPartnerLeads` | POST | Create CP Lead | No |
| `/api/v1/db/users` | POST | Create CP User | Admin |
| `/api/v1/db/users/cp/registrationToken/verification` | POST | Verify Token | No |
| `/api/v1/db/users/cp/completeRegistration` | PUT | Complete Registration | No (Token) |
| `/api/v1/db/users/{id}` | PUT | Approve/Reject | Admin/BST/Director |

---

## ✅ Checklist for Creating a Proper CP

- [ ] CP Lead created with correct email/contact
- [ ] Admin creates CP User with role_id = 1
- [ ] Registration email sent to CP
- [ ] CP verifies token (optional)
- [ ] CP completes registration with:
  - [ ] State (required)
  - [ ] City (required)
  - [ ] CP Category (optional)
  - [ ] Aadhar file (required)
  - [ ] PAN file (required)
  - [ ] RERA file (required)
  - [ ] Cheque file (optional)
- [ ] BST automatically assigned (if lead exists)
- [ ] Admin/BST reviews documents
- [ ] Documents approved (doc_verification = 2)
- [ ] CP Lead stage updated to 'ONBOARDED'
- [ ] CP can login with reset password link

---

*This document provides a complete overview of the CP Lead to CP User flow. For specific implementation details, refer to the controller files.*

