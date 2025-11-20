# Director/Supervisor (Role ID = 3) - Access and Permissions

## 📋 Overview

**Director/Supervisor** is identified by `role_id = 3` and `isDB = false`.

**Key Characteristics:**
- Oversees BST users and CP leads
- Has hierarchical access to all users under them
- Can see all data from BST and CP users that report to them
- Can approve/reject CP onboarding requests
- **Cannot** manage system settings, roles, or create users

---

## ✅ What Director/Supervisor CAN See

### 1. **All Leads (No Filtering)**
- ✅ Sees **ALL leads** in the system (no `assigned_lead` filtering)
- ✅ Sees leads from all users (BST, CP, etc.)
- ✅ Can view all lead details, visits, bookings

**Code Evidence:**
```javascript
// From channelReportController.js, channelDasboard.js
if (!req.user.isDB && req.user.role_id != 3) {
    whereLeadClause = {
        assigned_lead: req.user.user_id  // Filter by assigned user
    };
}
// Director (role_id = 3) sees ALL leads - no filtering applied
```

### 2. **All CP Leads (No Filtering)**
- ✅ Sees **ALL CP leads** in the system
- ✅ Can see CP leads assigned to any BST
- ✅ Can view all CP lead stages and details

**Code Evidence:**
```javascript
// From contactUsController.js
if (req.user.role_id == 3) {
    // Director uses recursive query to get all users under them
    // Then fetches ALL CP leads assigned to those users
    // If no hierarchy, shows ALL BST users' CP leads
}
```

### 3. **All Reports (No Filtering)**
- ✅ Sees **ALL reports** (no user-based filtering)
- ✅ Can view reports for all users
- ✅ Can see aggregated data across all BST and CP users

**Code Evidence:**
```javascript
// From channelReportController.js - All report endpoints
if (!req.user.isDB && req.user.role_id != 3) {
    whereLeadClause = { assigned_lead: req.user.user_id };
}
// Director sees ALL data in reports
```

### 4. **All CP Pending Verifications**
- ✅ Sees **ALL CP pending verifications** (including `doc_verification = 1`)
- ✅ Can see CPs that report to BSTs under them
- ✅ Can see CPs that report directly to them
- ✅ Can see CPs with no report_to

**Code Evidence:**
```javascript
// From userController.js - getPendingVerificationUser()
if (req.user.role_id == 3) {
    // Find all BSTs that report to this Supervisor
    const bstUser = await req.config.users.findAll({
        where: { report_to: req.user.user_id, role_id: 2 }
    });
    // Show CPs that report to BSTs under Supervisor, OR CPs that report directly to Supervisor
    whereClause.report_to = {
        [Op.or]: [
            { [Op.in]: bstUserIds },
            req.user.user_id,
            { [Op.is]: null }
        ]
    };
}
```

### 5. **Users Under Their Hierarchy**
- ✅ Sees **CP users** that report to BST users under them
- ✅ Sees **BST users** that report directly to them
- ✅ Uses recursive query to get all users in their hierarchy

**Code Evidence:**
```javascript
// From userController.js - getAllUsers()
if (!req.user.isDB && req.user.role_id == 3) {
    // Get all BST users reporting to Director
    const bstUsers = await req.config.users.findAll({
        where: { 
            report_to: req.user.user_id, 
            role_id: 2 
        }
    });
    // Show CP users that report to BST users under Director
}
```

### 6. **All Bookings**
- ✅ Sees **ALL bookings** from all users under their hierarchy
- ✅ Uses recursive query to get all users under Director

**Code Evidence:**
```javascript
// From bookingController.js
if (req.user.role_id === 3) {
    // Recursive query to get all users under Director
    // Fetch all bookings from those users
}
```

### 7. **All Lead Visits**
- ✅ Sees **ALL lead visits** from all users under their hierarchy
- ✅ Can view visit details, status, and history

**Code Evidence:**
```javascript
// From leadVisitController.js
if (req.user.role_id === 3) {
    // Recursive query to get all users under Director
    // Fetch all lead visits from those users
}
```

### 8. **All Brokerages**
- ✅ Sees **ALL brokerages** from all users under their hierarchy

**Code Evidence:**
```javascript
// From brokerageController.js
if (req.user.role_id === 3) {
    // Recursive query to get all users under Director
    // Fetch all brokerages from those users
}
```

---

## ✅ What Director/Supervisor CAN Do

### 1. **Approve CP Onboarding Requests**
- ✅ Can approve CP requests after form submission
- ✅ Sets `doc_verification = 2` (approved)
- ✅ Sets all approval flags (`bst_approval`, `director_approval`, etc.)
- ✅ Updates CP lead stage to "ONBOARDED"
- ✅ Sends password reset email to CP

**Code Evidence:**
```javascript
// From userController.js - handleAcceptProcess()
else if (req.user.role_id == 3) { // Director role
    dbUserData.doc_verification = 2
    dbUserData.director_response = dbUserData.director_approval = 
        dbUserData.bst_response = dbUserData.bst_approval = true;
    message = `The Channel Partner's request has been accepted by both BST and Director.`;
}
```

### 2. **Reject CP Onboarding Requests**
- ✅ Can reject CP requests after form submission
- ✅ Sets `doc_verification = 3` (rejected)
- ✅ Sets rejection flags
- ✅ Sends rejection email to CP

**Code Evidence:**
```javascript
// From userController.js - handleRejectProcess()
else if (req.user.role_id == 3) { // Director role
    dbUserData.doc_verification = 3
    dbUserData.director_response = dbUserData.director_approval = true;
    dbUserData.bst_approval = false;
    message = `The Channel Partner's request has been rejected by both BST and Director.`;
}
```

### 3. **View All Dashboards**
- ✅ Can access all dashboard views
- ✅ Sees aggregated data from all users under them
- ✅ No filtering applied to dashboard data

**Code Evidence:**
```javascript
// From channelDasboard.js, chanelAdminDashboard.js
if (!req.user.isDB && req.user.role_id != 3) {
    // Apply filtering for BST and CP
}
// Director sees ALL dashboard data
```

### 4. **View All Reports**
- ✅ Can view all report types
- ✅ Sees data from all users (no filtering)
- ✅ Can export reports with all data

**Code Evidence:**
```javascript
// From channelReportController.js - All report functions
if (!req.user.isDB && req.user.role_id != 3) {
    whereLeadClause = { assigned_lead: req.user.user_id };
}
// Director sees ALL report data
```

### 5. **Update CP Lead Stages**
- ✅ Can update CP lead stages (including VISIT stage with OTP)
- ✅ Can add follow-up dates and remarks

**Code Evidence:**
```javascript
// From contactUsController.js - updateChannelPartnerLeads()
const isAdminOrBST = req?.user?.role_id === 2 || req?.user?.role_id === 3;
if (!isAdminOrBST) {
    return responseError(req, res, "Only Admin or BST can update stage to VISIT");
}
// Director can update CP lead stages
```

### 6. **View User Hierarchy**
- ✅ Can see all BST users that report to them
- ✅ Can see all CP users that report to BSTs under them
- ✅ Uses recursive query to get complete hierarchy

**Code Evidence:**
```javascript
// Recursive query pattern used throughout
WITH RECURSIVE user_hierarchy AS (
    SELECT user_id, report_to, user
    FROM db_users
    WHERE user_id = :user_id
    UNION
    SELECT u.user_id, u.report_to, u.user
    FROM db_users u
    INNER JOIN user_hierarchy uh ON u.report_to = uh.user_id
)
SELECT user_id, user FROM user_hierarchy;
```

---

## ❌ What Director/Supervisor CANNOT Do

### 1. **Cannot Create Users**
- ❌ Cannot create new users (only Admin can)
- ❌ Cannot create BST or CP users

### 2. **Cannot Create/Edit Roles**
- ❌ Cannot create new roles
- ❌ Cannot edit role permissions
- ❌ Cannot delete roles

### 3. **Cannot Manage System Settings**
- ❌ Cannot manage email configurations
- ❌ Cannot manage email templates
- ❌ Cannot manage organization settings
- ❌ Cannot manage platform settings

### 4. **Cannot Access Admin-Only Features**
- ❌ Cannot access admin dashboard features
- ❌ Cannot manage database settings
- ❌ Cannot manage licenses

### 5. **Menu Access Restrictions**
- ⚠️ Director's menu access is based on **role permissions** (`db_role_permissions`)
- ⚠️ Unlike Admin, Director needs role permissions to access menus
- ⚠️ Director cannot access menus they don't have permissions for

**Code Evidence:**
```javascript
// From middleware/authController.js - rolePermission()
if (req.user.isDB == true) {
    // Admin: Only needs menu to be active
    next();
} else {
    // Director: Needs role permissions check
    let findUserPermissionInProgram = await req.config.sequelize.query(
        `SELECT * FROM db_role_permissions 
         WHERE role_id = ${req.user.role_id} and menu_id = ${Number(req.headers.m_id)};`
    );
    // Director can only access if permission exists
}
```

---

## 🔍 Data Access Pattern

### Hierarchical Access Model

Director uses a **recursive hierarchy query** to access data:

```sql
WITH RECURSIVE user_hierarchy AS (
    SELECT user_id, report_to, user
    FROM db_users
    WHERE user_id = :director_user_id
    UNION
    SELECT u.user_id, u.report_to, u.user
    FROM db_users u
    INNER JOIN user_hierarchy uh ON u.report_to = uh.user_id
)
SELECT user_id, user FROM user_hierarchy;
```

**This means:**
- Director sees data from:
  1. **Direct reports** (BST users with `report_to = director_user_id`)
  2. **Indirect reports** (CP users that report to BSTs under Director)
  3. **All leads/bookings/visits** from users in their hierarchy

### Fallback Logic

If no hierarchy exists:
- Director sees **ALL BST users** (role_id = 2) as fallback
- Director can see CP leads assigned to all BST users

---

## 📊 Director vs Other Roles Comparison

| Feature | Director (role_id = 3) | BST (role_id = 2) | CP (role_id = 1) |
|---------|------------------------|-------------------|------------------|
| **See All Leads** | ✅ Yes | ⚠️ Only assigned | ⚠️ Only assigned |
| **See All CP Leads** | ✅ Yes | ⚠️ Only assigned | ❌ No |
| **See All Reports** | ✅ Yes | ⚠️ Only assigned data | ⚠️ Only assigned data |
| **See All Users** | ⚠️ Only under hierarchy | ⚠️ Only assigned CPs | ❌ No |
| **Approve CP Requests** | ✅ Yes | ❌ No (after form) | ❌ No |
| **Reject CP Requests** | ✅ Yes | ❌ No (after form) | ❌ No |
| **Update CP Lead Stages** | ✅ Yes | ✅ Yes | ❌ No |
| **Create Users** | ❌ No | ❌ No | ❌ No |
| **Create Roles** | ❌ No | ❌ No | ❌ No |
| **Menu Access** | ⚠️ Based on permissions | ⚠️ Based on permissions | ⚠️ Based on permissions |

---

## 🎯 Key Responsibilities

### 1. **CP Onboarding Approval**
- Approve/reject CP onboarding requests after form submission
- Review CP documents and information
- Make final decision on CP approval

### 2. **Oversight and Monitoring**
- Monitor all leads from BST and CP users under them
- View reports and analytics for their team
- Track performance of BST and CP users

### 3. **Hierarchical Management**
- Manage BST users that report to them
- Oversee CP users that report to BSTs under them
- View complete hierarchy of users

### 4. **Data Analysis**
- Access all reports without filtering
- View aggregated data across all users
- Analyze trends and performance

---

## 📝 Code Locations

### Data Access (No Filtering)
- `controllers/channel/channelReportController.js` - All report functions
- `controllers/channel/channelDasboard.js` - Dashboard data
- `controllers/channel/chanelAdminDashboard.js` - Admin dashboard
- `controllers/contactUsController.js` - CP leads (line 334-372)

### User Management
- `controllers/userController.js` - `getAllUsers()` (line 1359-1392)
- `controllers/userController.js` - `getUsersByRoleID()` (line 1042-1068)
- `controllers/userController.js` - `getPendingVerificationUser()` (line 2990-3020)

### Approval/Rejection
- `controllers/userController.js` - `handleAcceptProcess()` (line 1881-1885)
- `controllers/userController.js` - `handleRejectProcess()` (line 1942-1947)

### Lead Management
- `controllers/channel/channelLeadController.js` - Lead access (line 289-313)
- `controllers/channel/leadVisitController.js` - Visit access (line 667-689)
- `controllers/channel/bookingController.js` - Booking access (line 78-100)
- `controllers/channel/brokerageController.js` - Brokerage access (line 189-210)

---

## 🔑 Summary

### Director/Supervisor Can:
✅ See ALL leads, CP leads, reports (no filtering)  
✅ See all users under their hierarchy (recursive)  
✅ Approve/reject CP onboarding requests  
✅ View all dashboards and analytics  
✅ Update CP lead stages  
✅ Access all bookings, visits, brokerages from their team  

### Director/Supervisor Cannot:
❌ Create users  
❌ Create/edit roles  
❌ Manage system settings  
❌ Access admin-only features  
❌ Access menus without role permissions  

### Key Difference from Admin:
- **Admin (isDB = true)**: Complete access, can manage everything
- **Director (role_id = 3)**: Can see all data but **cannot manage system settings/roles**

---

*Last Updated: Based on comprehensive codebase analysis*

