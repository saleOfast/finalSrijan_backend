# Roles and Admin Permissions Analysis

## 📊 Roles in the System

### Hardcoded Role IDs (Common Roles)

Based on codebase analysis, the following roles are hardcoded in the system:

| Role ID | Role Name | Description | Usage |
|---------|-----------|-------------|-------|
| **1** | Channel Partner (CP) | Channel partner users | CP users who manage leads and bookings |
| **2** | BST (Business Sales Team) | Business Sales Team / Manager | Manages CP leads, approves CP users (restricted after form submission) |
| **3** | Director/Supervisor | Director/Supervisor role | Oversees BST users and CP leads, can approve/reject CP requests |
| **5** | Media | Media platform users | Media-related functionality |
| **10** | DMS | DMS (Dealer Management System) users | DMS platform users |

### Dynamic Roles

- The system supports **dynamic role creation** through the Role Management API
- Roles are stored in the `db_role` table
- Roles can be created with platform-specific permissions (CRM, SALES, DMS, CHANNEL, MEDIA)
- **The exact number of roles depends on what's stored in your database**

### Finding All Roles

**API Endpoint:**
```
GET /api/v1/db/role-management/roles
```

**Database Query:**
```sql
SELECT role_id, role_name, platform_id, createdAt 
FROM db_role 
WHERE deletedAt IS NULL 
ORDER BY role_id;
```

**Get Role Count:**
```sql
SELECT COUNT(*) as total_roles 
FROM db_role 
WHERE deletedAt IS NULL;
```

---

## 🔐 Admin Permissions Analysis

### Admin Identification

**Admin is identified by:** `req.user.isDB = true`

**Key Characteristics:**
- Admin users have `isDB = true` in the `db_users` table
- Admin is the database owner/tenant admin
- There is typically **ONE admin per database/tenant**

### Admin Access Rights

#### ✅ **Admin Has FULL Application Rights**

Based on codebase analysis, **Admin has complete access** to:

1. **See ALL Data (No Filtering)**
   - ✅ Sees ALL users (no role-based filtering)
   - ✅ Sees ALL leads (no assigned_lead filtering)
   - ✅ Sees ALL CP leads (no assignment filtering)
   - ✅ Sees ALL reports (no user-based filtering)
   - ✅ Sees ALL CP pending verifications (including doc_verification = 1)
   - ✅ Sees ALL bookings, visits, and other data

2. **Can Perform ALL Actions**
   - ✅ Can approve/reject CP requests
   - ✅ Can create/edit/delete users
   - ✅ Can create/edit/delete leads
   - ✅ Can create/edit/delete roles
   - ✅ Can manage all settings
   - ✅ Can access all menus (if menu is active)

3. **No Role-Based Restrictions**
   - ✅ Admin bypasses all role-based filtering
   - ✅ Admin can see data from all users (BST, Director, CP, etc.)
   - ✅ Admin can perform actions that other roles cannot

---

## 📋 Code Evidence

### 1. Admin Sees ALL Data (No Filtering)

**Example from `channelReportController.js`:**
```javascript
// Filter based on user role
if (!req.user.isDB && req.user.role_id != 3) {
    whereLeadClause = {
        assigned_lead: req.user.user_id  // Filter by assigned user
    };
}
// Admin (isDB = true) sees ALL leads - no filtering applied
```

**Example from `channelDasboard.js`:**
```javascript
if (!req.user.isDB && req.user.role_id != 3) {
    whereLeadClause = {
        assigned_lead: req.user.user_id
    }
}
// Admin (isDB = true) sees ALL data - no filtering
```

**Example from `contactUsController.js`:**
```javascript
if (req.user.isDB) {
    // Admin sees ALL CP leads
    getAllLeadsQuery = `
        SELECT leads.*, users.user_id, users.user, users.user_status
        FROM ${db_name}.db_channel_partner_leads as leads
        WHERE 1=1 AND leads.deletedAt IS NULL
        ORDER BY leads.createdAt DESC
    `;
} else {
    // Other users see only their assigned leads
    getAllLeadsQuery = `
        WHERE leads.asssigned_to = :user_id AND leads.deletedAt IS NULL
    `;
}
```

**Example from `userController.js` - `getAllUsers()`:**
```javascript
// Admin sees ALL users (no filtering)
if (req.query.mode && req.query.mode == "ul") {
    whereCaluse = {
        isDB: false,  // Exclude admin from list, but admin can see all
        doc_verification: 2,
    };
}
// BST and Director have filtering, but Admin doesn't
```

**Example from `userController.js` - `getPendingVerificationUser()`:**
```javascript
if (req.user.isDB) {
    // Admin can see ALL CP pending verifications (no restrictions)
    // No need to modify whereClause - Admin sees everything
}
```

### 2. Admin Can Perform ALL Actions

**Example from `userController.js` - `handleAcceptProcess()`:**
```javascript
// Admin case
if (req.user.isDB) {
    dbUserData.doc_verification = 2
    dbUserData.bst_response = dbUserData.bst_approval = 
        dbUserData.director_response = dbUserData.director_approval = true;
    message = `The Channel Partner's request has been accepted successfully.`;
}
// Admin can approve CP requests directly
```

**Example from `userController.js` - `handleRejectProcess()`:**
```javascript
if (req.user.isDB) {
    // Admin can reject CP requests
    dbUserData.bst_response = dbUserData.director_response = 
        dbUserData.director_approval = true;
    dbUserData.bst_approval = dbUserData.director_approval = false;
    message = `The Channel Partner's request has been rejected successfully.`;
}
```

### 3. Admin Permission Check

**From `middleware/authController.js` - `rolePermission()`:**
```javascript
// for admin permission
if (req.user.isDB == true) {
    // if no menu id then respond with not authorised
    if (!req.headers.m_id) {
        return responseError(req, res, "not authorised")
    }
    // find client permission in permission menu
    let clientdata = await req.config.menus.findOne({
        where: {
            menu_id: req.headers.m_id,
            is_active: true
        }
    })
    if (clientdata == null) {
        return responseError(req, res, "Admin User not authorised for this action")
    }
    else {
        next();  // Admin can access if menu is active
    }
} else {
    // For other users, check role permissions
    // ... role-based permission check
}
```

**Key Points:**
- Admin only needs menu to be `is_active = true`
- Admin doesn't need role permissions (bypasses `db_role_permissions` check)
- Admin can access any active menu

---

## 🔍 Admin vs Other Roles Comparison

### Data Visibility

| Feature | Admin (isDB = true) | Director (role_id = 3) | BST (role_id = 2) | CP (role_id = 1) |
|---------|---------------------|----------------------|-------------------|------------------|
| **All Users** | ✅ Yes | ⚠️ Only CPs under BSTs | ⚠️ Only assigned CPs | ❌ No |
| **All Leads** | ✅ Yes | ✅ Yes | ⚠️ Only assigned leads | ⚠️ Only assigned leads |
| **All CP Leads** | ✅ Yes | ✅ Yes | ⚠️ Only assigned CP leads | ❌ No |
| **All Reports** | ✅ Yes | ✅ Yes | ⚠️ Only assigned data | ⚠️ Only assigned data |
| **CP Pending Verifications** | ✅ Yes (all) | ✅ Yes (all) | ⚠️ Only doc_verification = 0 or 3 | ❌ No |

### Action Permissions

| Action | Admin (isDB = true) | Director (role_id = 3) | BST (role_id = 2) | CP (role_id = 1) |
|--------|---------------------|----------------------|-------------------|------------------|
| **Approve CP Request** | ✅ Yes | ✅ Yes | ❌ No (after form submission) | ❌ No |
| **Reject CP Request** | ✅ Yes | ✅ Yes | ❌ No (after form submission) | ❌ No |
| **Create Users** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Create Roles** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Manage Settings** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **See All Menus** | ✅ Yes (if active) | ⚠️ Based on role permissions | ⚠️ Based on role permissions | ⚠️ Based on role permissions |

---

## 🎯 Key Findings

### 1. **Admin Has Complete Access**
- ✅ Admin can see **ALL data** from all users (BST, Director, CP, etc.)
- ✅ Admin can perform **ALL actions** in the system
- ✅ Admin bypasses all role-based restrictions
- ✅ Admin only needs menu to be active (no role permission check)

### 2. **Role Count**
- **Hardcoded Roles**: 5 roles (1, 2, 3, 5, 10)
- **Dynamic Roles**: Unlimited (stored in `db_role` table)
- **Total Roles**: Depends on database contents

### 3. **Admin vs Director**
- **Admin (isDB = true)**: Complete access, can manage everything
- **Director (role_id = 3)**: Can see all data but cannot manage system settings, roles, etc.

### 4. **Data Filtering Pattern**
The codebase consistently uses this pattern:
```javascript
if (!req.user.isDB && req.user.role_id != 3) {
    // Apply filtering for BST and CP
    whereClause = { assigned_lead: req.user.user_id };
}
// Admin (isDB = true) and Director (role_id = 3) see ALL data
```

---

## 📝 Summary

### Roles
- **Minimum 5 hardcoded roles** (1, 2, 3, 5, 10)
- **Unlimited dynamic roles** (stored in database)
- **Total count**: Query `db_role` table to get exact number

### Admin Permissions
- ✅ **Admin has FULL application rights**
- ✅ **Admin can see ALL data** from all users (BST, Director, CP, etc.)
- ✅ **Admin can perform ALL actions** (approve, reject, create, edit, delete)
- ✅ **Admin bypasses all role-based restrictions**
- ✅ **Admin can see everything that all users are doing**

### Verification
To verify admin access in your database:
```sql
-- Check admin user
SELECT user_id, user, email, isDB, role_id 
FROM db_users 
WHERE isDB = true;

-- Check all roles
SELECT role_id, role_name, platform_id 
FROM db_role 
WHERE deletedAt IS NULL 
ORDER BY role_id;
```

---

## 🔧 Code Locations

**Admin Permission Checks:**
- `middleware/authController.js` → `rolePermission()` (lines 81-171)
- `controllers/userController.js` → Multiple functions check `req.user.isDB`
- `controllers/channel/channelReportController.js` → Admin sees all data
- `controllers/channel/channelDasboard.js` → Admin sees all data
- `controllers/contactUsController.js` → Admin sees all CP leads

**Role Management:**
- `controllers/roleController.js` → Role CRUD operations
- `model/userRoleModel.js` → Role model definition
- `routes/roleRoutes.js` → Role API endpoints

---

*Last Updated: Based on comprehensive codebase analysis*

