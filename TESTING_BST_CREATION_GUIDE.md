# Testing Guide: Create BST User with New State & City

This guide helps you create a BST (Business Sales Team) user with a new state and city to test the BST assignment functionality.

## 📋 Prerequisites

1. **Admin Authentication Token**: You need a valid admin JWT token
2. **Database Name**: Your client database name (e.g., `your_db_name`)
3. **API Base URL**: Your API base URL (e.g., `http://localhost:3000`)

---

## 🎯 Step 1: Create BST User via API

### Endpoint
```
POST /api/v1/db/users
```

### Headers
```
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json
m_id: YOUR_MENU_ID
```

### Request Body
```json
{
  "user": "BST Test User",
  "user_l_name": "Kumar",
  "email": "bst.test@example.com",
  "contact_number": "9876543210",
  "role_id": 2,
  "state": "Karnataka",
  "city": "Bangalore",
  "isCHANNEL": true,
  "isCRM": true,
  "isDMS": false,
  "isSALES": false,
  "isMEDIA": false
}
```

### Important Fields for BST User:
- **`role_id`**: Must be `2` (BST role)
- **`state`**: String name of the state (e.g., "Karnataka", "Maharashtra", "Tamil Nadu")
- **`city`**: String name of the city (e.g., "Bangalore", "Mumbai", "Chennai")
- **`user_status`**: Will be set to `true` by default (active user)
- **`isCHANNEL`**: Should be `true` for BST users
- **`email`**: Must be unique

### Expected Response
```json
{
  "status": 200,
  "message": "User created successfully",
  "data": {
    "user_id": 123,
    "user": "BST Test User",
    "user_l_name": "Kumar",
    "email": "bst.test@example.com",
    "role_id": 2,
    "state": "Karnataka",
    "city": "Bangalore",
    "user_status": true,
    "doc_verification": 2,
    "user_code": "USER12345678"
  }
}
```

### Notes:
- BST users (role_id = 2) are automatically approved (`doc_verification = 2`)
- The password is auto-generated based on `user_code`
- Platform permissions are automatically created

---

## 🔍 Step 2: Verify BST User Creation

### Option A: Get User by ID
```
GET /api/v1/db/users?user_id=123
```

### Option B: Get All BST Users
```
GET /api/v1/db/users?role_id=2
```

### Expected Response
```json
{
  "status": 200,
  "message": "Users retrieved successfully",
  "data": [
    {
      "user_id": 123,
      "user": "BST Test User",
      "email": "bst.test@example.com",
      "role_id": 2,
      "state": "Karnataka",
      "city": "Bangalore",
      "user_status": true
    }
  ]
}
```

---

## ✅ Step 3: Test BST Assignment to CP Lead

Now that you have a BST user with a new state and city, you can test the BST assignment functionality.

### Prerequisites for Testing:
1. **CP Lead exists** with matching email/contact
2. **CP User created** with registration token
3. **CP completes registration** with the same state as BST

### Test Flow:

1. **Create CP Lead** (if not exists):
   ```json
   POST /api/v1/db/channelPartnerLeads
   {
     "first_name": "Test",
     "last_name": "CP",
     "email": "test.cp@example.com",
     "contact": "9876543211",
     "state": "Karnataka",  // Same state as BST
     "city": "Bangalore"    // Same city as BST
   }
   ```

2. **Create CP User** (Admin):
   ```json
   POST /api/v1/db/users
   {
     "email": "test.cp@example.com",
     "role_id": 1,
     "user": "Test CP",
     "isCHANNEL": true
   }
   ```

3. **Complete CP Registration** (CP User):
   ```
   PUT /api/v1/db/users/cp/completeRegistration
   ```
   Form Data:
   - `token`: Registration JWT token
   - `state`: "Karnataka" (must match BST state)
   - `city`: "Bangalore" (must match BST city)
   - `name`: "Test CP"
   - `mobile`: "9876543211"
   - Required files: `aadhar`, `pan`, `rera`

4. **Verify BST Assignment**:
   ```
   GET /api/v1/db/channelPartnerLeads
   ```
   
   Check that `asssigned_to` field matches your BST user_id:
   ```json
   {
     "cpl_id": 1,
     "email": "test.cp@example.com",
     "state": "Karnataka",
     "city": "Bangalore",
     "asssigned_to": 123,  // ✅ Your BST user_id
     "stage": "OPEN"
   }
   ```

---

## 🧪 Testing Scenarios

### Scenario 1: Single BST in New State
**Setup:**
- Create 1 BST user with `state = "Karnataka"`
- Create 1 CP Lead with `state = "Karnataka"`

**Expected Result:**
- CP Lead will be assigned to the BST user automatically

### Scenario 2: Multiple BSTs in Same State (Round-Robin)
**Setup:**
- Create 2 BST users:
  - BST1: `state = "Karnataka"`, `user_id = 123`
  - BST2: `state = "Karnataka"`, `user_id = 124`
- Create 2 CP Leads with `state = "Karnataka"`

**Expected Result:**
- First CP Lead → assigned to BST with least leads (or oldest BST)
- Second CP Lead → assigned to other BST (round-robin distribution)

### Scenario 3: No BST in State
**Setup:**
- Create CP Lead with `state = "Unknown State"` (no BST exists for this state)

**Expected Result:**
- Console log: "No BST users found for state: Unknown State"
- CP Lead remains unassigned (`asssigned_to = null`)

---

## 📝 Example: Complete Testing Workflow

### 1. Create BST User
```bash
curl -X POST http://localhost:3000/api/v1/db/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user": "BST Manager",
    "email": "bst.manager@example.com",
    "contact_number": "9876543210",
    "role_id": 2,
    "state": "Karnataka",
    "city": "Bangalore",
    "isCHANNEL": true,
    "isCRM": true
  }'
```

### 2. Verify BST User
```bash
curl -X GET "http://localhost:3000/api/v1/db/users?role_id=2" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Create CP Lead
```bash
curl -X POST http://localhost:3000/api/v1/db/channelPartnerLeads \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Test",
    "last_name": "Partner",
    "email": "test.partner@example.com",
    "contact": "9876543211",
    "state": "Karnataka",
    "city": "Bangalore"
  }'
```

### 4. Create CP User (Admin)
```bash
curl -X POST http://localhost:3000/api/v1/db/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test.partner@example.com",
    "role_id": 1,
    "user": "Test Partner",
    "isCHANNEL": true
  }'
```

### 5. Complete CP Registration (Use the registration token from email)
```bash
curl -X PUT http://localhost:3000/api/v1/db/users/cp/completeRegistration \
  -F "token=YOUR_REGISTRATION_TOKEN" \
  -F "name=Test Partner" \
  -F "mobile=9876543211" \
  -F "state=Karnataka" \
  -F "city=Bangalore" \
  -F "aadhar=@/path/to/aadhar.pdf" \
  -F "pan=@/path/to/pan.pdf" \
  -F "rera=@/path/to/rera.pdf"
```

### 6. Verify BST Assignment
```bash
curl -X GET "http://localhost:3000/api/v1/db/channelPartnerLeads?email=test.partner@example.com" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Check that `asssigned_to` field contains the BST user_id.

---

## 🔑 Key Points

1. **State Matching**: BST assignment matches by **string name** of state, not state_id
2. **Round-Robin Logic**: When multiple BSTs exist in same state, assignment is based on:
   - Least number of assigned leads
   - If equal, oldest BST (by createdAt)
3. **Required Fields for BST**:
   - `role_id = 2`
   - `state` (string name, required for assignment)
   - `city` (string name, optional but recommended)
   - `user_status = true` (active)
4. **Assignment Trigger**: BST assignment happens automatically when CP completes registration with state and city

---

## 🐛 Troubleshooting

### Issue: BST not assigned to CP Lead
**Possible Causes:**
1. No BST user exists with matching state
2. BST user has `user_status = false` (inactive)
3. CP Lead already has `asssigned_to` value
4. CP Lead not found by email/contact

**Check:**
```sql
-- Verify BST users exist for state
SELECT user_id, user, email, state, city, user_status 
FROM db_users 
WHERE role_id = 2 AND state = 'Karnataka' AND user_status = 1;

-- Check CP Lead
SELECT cpl_id, email, contact, state, city, asssigned_to 
FROM db_channel_partner_leads 
WHERE email = 'test.partner@example.com';
```

### Issue: Multiple BSTs but assignment not working
**Check:**
- Ensure all BST users have `state` field set (string name)
- Verify `user_status = true` for all BST users
- Check console logs for assignment errors

---

## 📚 Related Documentation

- `CP_LEAD_TO_CP_USER_FLOW.md` - Complete CP Lead to User flow
- `POSTMAN_TESTING_GUIDE_BST_ASSIGNMENT.md` - Postman testing guide

---

*This guide helps you create BST users with new states and cities for testing the automatic BST assignment functionality.*

