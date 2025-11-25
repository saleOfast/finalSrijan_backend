# Create Test Role and User - CURL Commands

## Step 0: Login to Get JWT Token

**First, you need to login to get a JWT token.** Use an Admin account or any user account that has permission to manage roles.

```bash
curl -X POST "http://localhost:3000/api/v1/db/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your_password",
    "type": "common",
    "client_url": "http://your-client-url.com"
  }'
```

**Response:**
```json
{
  "status": 200,
  "message": "Login successful",
  "data": {
    "user": {...},
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",  // <-- COPY THIS TOKEN
    "platformData": [...]
  }
}
```

**⚠️ IMPORTANT:** Copy the `token` from the response. You'll use this token in all subsequent API calls.

**Note:** 
- Replace `admin@example.com` with your actual admin email
- Replace `your_password` with your actual password
- Replace `client_url` with your actual client URL (or remove this field if not needed)
- Replace `localhost:3000` with your actual server URL

---

## Step 1: Get Menu IDs for CHANNEL Platform

Now use the token from Step 0 to get all menus for CHANNEL platform to find the menu IDs for:
- CP Leads
- Channel Partners  
- Pending Requests

```bash
curl -X GET "http://localhost:3000/api/v1/db/role/menus/CHANNEL" \
  -H "Authorization: Bearer YOUR_TOKEN_FROM_STEP_0" \
  -H "Content-Type: application/json" \
  -H "m_id: 1"
```

**Note:** Replace `YOUR_TOKEN_FROM_STEP_0` with the token you got from Step 0.

**Response will show all menus with their `menu_id` values. Look for:**
- Menu with name containing "CP Lead" or "Channel Partner Lead"
- Menu with name "Channel Partner" or "Channel Partners"
- Menu with name "Pending Request" or "Pending Verification" or "Pending Requests"

---

## Step 2: Create Role with Permissions

Once you have the menu IDs, create the role. **Replace the menu IDs in `selected_menu_ids` with the actual IDs you found in Step 1.**

**Example menu IDs (you need to verify these from Step 1):**
- CP Leads menu might be: `280` or `281` (example)
- Channel Partners menu might be: `265` or `274` (example)  
- Pending Requests menu might be: `275` or `276` (example)

**Also include parent menu IDs** (the system will auto-add them, but you can include them explicitly):

```bash
curl -X POST "http://localhost:3000/api/v1/db/role/create-with-permissions" \
  -H "Authorization: Bearer YOUR_TOKEN_FROM_STEP_0" \
  -H "Content-Type: application/json" \
  -H "m_id: 1" \
  -d '{
    "role_name": "test role",
    "platform_type": "CHANNEL",
    "selected_menu_ids": [
      263,    // Top Navigation (parent - usually required)
      265,    // Channel Partner (parent menu - example ID)
      274,    // View User / Channel Partners (example ID)
      280,    // CP Leads (example ID - verify from Step 1)
      275     // Pending Requests (example ID - verify from Step 1)
    ]
  }'
```

**Response:**
```json
{
  "status": 200,
  "message": "Role created successfully with permissions",
  "data": {
    "role_id": 11,  // <-- SAVE THIS role_id FOR STEP 3
    "role_name": "test role",
    "permissions_count": 5
  }
}
```

**⚠️ IMPORTANT:** Save the `role_id` from the response. You'll need it in Step 3.

---

## Step 3: Create User with the New Role

Now create a user and assign the `role_id` from Step 2.

**Which Token to Use:**
- ✅ **Admin Token (Recommended)**: Use the Admin token from Step 0. Admin can create users with any active `m_id`.
- ⚠️ **Other User Token**: You can use any user token, but that user's role must have permission for the menu_id specified in the `m_id` header (typically the "Create User" menu).

**For Admin (Recommended):**
```bash
curl -X POST "http://localhost:3000/api/v1/db/users" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN_FROM_STEP_0" \
  -H "Content-Type: application/json" \
  -H "m_id: 1" \
  -d '{
    "user": "Test User",
    "user_l_name": "Last Name",
    "email": "testuser@example.com",
    "contact_number": "1234567890",
    "password": "Test@123",
    "role_id": 11,  // <-- USE THE role_id FROM STEP 2
    "user_status": true,
    "isDB": false,
    "doc_verification": 2,
    "organisation": "Test Organisation",
    "state": "Maharashtra",
    "city": "Mumbai"
  }'
```

**Note:** 
- Replace `YOUR_ADMIN_TOKEN_FROM_STEP_0` with the Admin token you got from Step 0
- Replace `role_id: 11` with the actual `role_id` from Step 2
- The `m_id: 1` can be any active menu_id for Admin users

**Response:**
```json
{
  "status": 200,
  "message": "User created successfully",
  "data": {
    "user_id": 123,
    "user": "Test User",
    "email": "testuser@example.com",
    "role_id": 11
  }
}
```

---

## Alternative: If You Know the Exact Menu IDs

If you already know the menu IDs, you can skip Step 1 and go directly to Step 2.

**Common CHANNEL Platform Menu IDs (verify these first):**
- `263` - Top Navigation (parent)
- `265` - Channel Partner (parent)
- `274` - View User / Channel Partners
- `280` - CP Leads (verify this)
- `275` - Pending Requests (verify this)

---

## Verification Steps

### 1. Verify Role Was Created

```bash
curl -X GET "http://localhost:3000/api/v1/db/role/one?id=11" \
  -H "Authorization: Bearer YOUR_TOKEN_FROM_STEP_0" \
  -H "Content-Type: application/json" \
  -H "m_id: 1"
```

### 2. Verify Role Permissions

```bash
curl -X GET "http://localhost:3000/api/v1/db/role/permissions/11" \
  -H "Authorization: Bearer YOUR_TOKEN_FROM_STEP_0" \
  -H "Content-Type: application/json" \
  -H "m_id: 1"
```

This will show all menus with `is_selected: true` for the menus you assigned.

### 3. Login as the New User and Check Permissions

**First, login as the new user to get their token:**

```bash
curl -X POST "http://localhost:3000/api/v1/db/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "Test@123",
    "type": "common",
    "client_url": "http://your-client-url.com"
  }'
```

**Login Response:**
```json
{
  "userData": {
    "user_id": 123,
    "user": "Test User",
    "email": "testuser@example.com",
    "role_id": 11,  // <-- This shows the role_id assigned to the user
    "isDB": false,
    ...
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "platformData": [...],
  "Logo": {...},
  "userAdminSubscriptionData": {...}
}
```

**Note:** The login response shows the user's `role_id`, but **does NOT directly show menu permissions**. You need to call a separate endpoint to see the actual menu permissions.

---

### 4. Get User's Menu Permissions

**⚠️ IMPORTANT: There are TWO different endpoints with different purposes:**

---

**Option A: Get Navigation Menus (RECOMMENDED - Shows Only Permitted Menus)**

```bash
curl -X GET "http://localhost:3000/api/v1/db/permission/nav?pf=CHANNEL" \
  -H "Authorization: Bearer NEW_USER_TOKEN_FROM_LOGIN" \
  -H "Content-Type: application/json" \
  -H "m_id: 1"
```

**Response:** Returns **ONLY** the menus the user has permission for (filtered by `actions = true`).

**This is what you should use to see what menus the user can actually see in the navigation.**

---

**Option B: Get All Permissions for a Role (Shows ALL Menus with Permission Status)**

```bash
curl -X GET "http://localhost:3000/api/v1/db/permission/roleWise?db_name=YOUR_DB_NAME&id=11&pf=CHANNEL" \
  -H "Content-Type: application/json"
```

**Note:** Replace `YOUR_DB_NAME` with the database name from the login response, and `11` with the `role_id` from the login response.

**Response:** Returns **ALL menus** with permission status:
- `actions: 1` = User HAS permission (the menus you assigned)
- `actions: 0` = User does NOT have permission (other menus)

**This endpoint shows ALL menus to help you see what permissions exist and what don't.**

---

## Understanding the Response

### If you assigned: `[263, 264, 272, 266, 278, 279]`

**What you'll see:**

1. **In `/permission/nav` endpoint (Navigation):**
   - ✅ **ONLY** menus with `actions: 1` (the 6 menus you assigned + parent menus)
   - This is what the user sees in the UI navigation

2. **In `/permission/roleWise` endpoint (Permission Check):**
   - ✅ Menus with `actions: 1` = Your assigned menus (263, 264, 272, 266, 278, 279)
   - ❌ Menus with `actions: 0` = Other menus (265, 267, 268, 269, 270, 271, etc.)
   - This shows ALL menus to help you understand what permissions exist

---

**Expected Result:** 
- **Navigation endpoint (`/nav`)**: User should only see the menus you assigned (263, 264, 272, 266, 278, 279) plus their parent menus
- **Permission check endpoint (`/roleWise`)**: Shows ALL menus but marks which ones have permission (`actions: 1`) and which don't (`actions: 0`)

---

## Important Notes

1. **Parent Menu IDs:** When you select a child menu, the system automatically adds parent menu permissions. So if you select menu ID `274` (child), it will also add menu ID `265` (parent) automatically.

2. **Menu IDs Vary:** The actual menu IDs depend on your database. Always use Step 1 to get the correct menu IDs for your system.

3. **Authentication:** All endpoints require:
   - Valid JWT token in `Authorization: Bearer` header
   - `m_id` header (menu ID for permission check)
     - **For Admin**: Can use any active menu_id (e.g., `1`)
     - **For Other Users**: Must use a menu_id that their role has permission for

4. **Which Token for User Creation:**
   - ✅ **Admin Token (Easiest)**: Admin can create users with any active `m_id`
   - ⚠️ **Other User Token**: The user's role must have permission for the "Create User" menu (specific menu_id)

4. **Database Name:** The system uses multi-tenant architecture. Make sure your token includes the correct database context.

---

## Troubleshooting

### Error: "Role with this name already exists"
- Change the role name or delete the existing role first.

### Error: "User not authorised for this action"
- Check that your token is valid and you have admin permissions.
- Verify the `m_id` header is correct.

### User sees more menus than expected
- Check that parent menus are included in `selected_menu_ids`.
- Verify the menu IDs are correct for CHANNEL platform.

### User sees no menus
- Verify the menu IDs exist in the database.
- Check that `menu_type = 'CHANNEL'` for those menus.
- Ensure `is_active = true` for those menus.

