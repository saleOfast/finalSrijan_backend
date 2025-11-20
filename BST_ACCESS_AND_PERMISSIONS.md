# BST (Business Sales Team, Role ID = 2) - Access and Permissions

## 📋 Overview

**BST (Business Sales Team)** is identified by `role_id = 2` and `isDB = false`.

**Key Characteristics:**
- Manages CP leads assigned to them
- Manages CP users that report to them
- Can update CP lead stages
- **Cannot** approve/reject CP requests after form submission (restricted)
- **Cannot** see CP pending verifications after form submission (`doc_verification = 1`)
- Sees only data assigned to them (filtered access)

---

## ✅ What BST CAN See

### 1. **Only Assigned Leads (Filtered)**
- ⚠️ Sees **ONLY leads** assigned to them (`assigned_lead = BST user_id`)
- ⚠️ Sees leads from CP users that report to them (`report_to = BST user_id`)
- ⚠️ Cannot see leads from other BST users

**Code Evidence:**
```javascript
// From channelReportController.js, channelDasboard.js
if (!req.user.isDB && req.user.role_id != 3) {
    whereLeadClause = {
        assigned_lead: req.user.user_id  // Filter by assigned user
    };
}
// BST (role_id = 2) sees ONLY assigned leads
```

### 2. **Only Assigned CP Leads (Filtered)**
- ⚠️ Sees **ONLY CP leads** assigned to them (`asssigned_to = BST user_id`)
- ⚠️ Cannot see CP leads assigned to other BST users
- ⚠️ CP leads are automatically assigned to BST based on state/city matching

**Code Evidence:**
```javascript
// From contactUsController.js - getChannelPartnerLeads()
if (!req.user.isDB) {
    // BST sees only their assigned CP leads
    getAllLeadsQuery = `
        WHERE leads.asssigned_to = :user_id AND leads.deletedAt IS NULL
    `;
}
```

### 3. **Only Assigned Reports (Filtered)**
- ⚠️ Sees **ONLY report data** from leads assigned to them
- ⚠️ Cannot see reports from other BST users' leads
- ⚠️ All report endpoints filter by `assigned_lead = BST user_id`

**Code Evidence:**
```javascript
// From channelReportController.js - All report functions
if (!req.user.isDB && req.user.role_id != 3) {
    whereLeadClause = { assigned_lead: req.user.user_id };
}
// BST sees ONLY assigned report data
```

### 4. **Only Assigned CP Users (Filtered)**
- ⚠️ Sees **ONLY CP users** that report to them (`report_to = BST user_id`)
- ⚠️ Sees themselves (`user_id = BST user_id`)
- ⚠️ Cannot see CP users assigned to other BST users

**Code Evidence:**
```javascript
// From userController.js - getAllUsers()
if (!req.user.isDB && req.user.role_id == 2) {
    whereCaluse = {
        doc_verification: 2,
        isDB: false,
        [Op.or]: [
            { user_id: req.user.user_id },
            { report_to: req.user.user_id },
        ],
    };
}
```

### 5. **Limited CP Pending Verifications**
- ⚠️ Sees **ONLY CPs with `doc_verification = 0`** (link sent but not submitted)
- ⚠️ Sees **ONLY CPs with `doc_verification = 3`** (rejected)
- ❌ **CANNOT see CPs with `doc_verification = 1`** (submitted form, pending approval)
- ⚠️ Only sees CPs that report to them (`report_to = BST user_id`)

**Code Evidence:**
```javascript
// From userController.js - getPendingVerificationUser()
else if (req.user.role_id == 2) {
    // BST should NOT see CP pending verifications after form submission
    // Only show CPs with doc_verification = 0 or 3
    whereClause.doc_verification = {
        [Op.in]: [0, 3] // Only show link sent or rejected, not submitted
    };
    whereClause.report_to = req.user.user_id;
}
```

### 6. **Only Assigned Lead Visits**
- ⚠️ Sees **ONLY lead visits** from leads assigned to CP users under them
- ⚠️ Filtered by `report_to = BST user_id` on lead owner

**Code Evidence:**
```javascript
// From leadVisitController.js
if (req.user.role_id === 2) {
    visitData = await req.config.leadVisit.findAll({
        include: [{
            model: req.config.leads,
            include: [{
                model: req.config.users,
                where: {
                    report_to: req.user.user_id  // Only CPs under BST
                }
            }]
        }]
    });
}
```

### 7. **Only Assigned Bookings**
- ⚠️ Sees **ONLY bookings** from leads assigned to CP users under them
- ⚠️ Filtered by lead owner's `report_to = BST user_id`

**Code Evidence:**
```javascript
// From bookingController.js
else if (req.user.role_id === 2) {
    bookingData = await req.config.leadBooking.findAll({
        include: [{
            model: req.config.leads,
            where: { ...owner },  // Filtered by lead owner
            include: [{
                model: req.config.users,
                where: {
                    report_to: req.user.user_id  // Only CPs under BST
                }
            }]
        }]
    });
}
```

### 8. **Only Assigned Brokerages**
- ⚠️ Sees **ONLY brokerages** from bookings under their assigned CPs

**Code Evidence:**
```javascript
// From brokerageController.js
else if (req.user.role_id === 2) {
    brokerageData = await req.config.leadBrokerage.findAll({
        // Filtered by bookings from CPs under BST
    });
}
```

---

## ✅ What BST CAN Do

### 1. **Update CP Lead Stages**
- ✅ Can update CP lead stages (OPEN, CONTACTED, LINK SENT, ONBOARDED, etc.)
- ✅ Can update CP lead stage to "VISIT" (requires OTP)
- ✅ Can add follow-up dates and remarks
- ✅ Can reassign CP leads to other BST users

**Code Evidence:**
```javascript
// From contactUsController.js - updateChannelPartnerLeads()
const isAdminOrBST = req?.user?.role_id === 2 || req?.user?.role_id === 3;
if (!isAdminOrBST) {
    return responseError(req, res, "Only Admin or BST can update stage to VISIT");
}
// BST can update CP lead stages
```

### 2. **Create CP Users (Send Registration Link)**
- ✅ Can create CP users (via Admin or through system)
- ✅ When CP user is created, registration link is sent
- ✅ CP lead stage is automatically updated to "LINK SENT"

**Code Evidence:**
```javascript
// From userController.js - createUser()
// When CP user is created, CP lead stage is updated to "LINK SENT"
// Registration token is generated and sent via email
```

### 3. **View Assigned Data**
- ✅ Can view all leads assigned to them
- ✅ Can view all CP leads assigned to them
- ✅ Can view all CP users that report to them
- ✅ Can view reports for their assigned leads

### 4. **Manage CP Leads**
- ✅ Can change CP lead status to "CONTACTED"
- ✅ Can add follow-up dates
- ✅ Can add remarks/notes
- ✅ Can reassign CP leads

### 5. **Book Visits for Any Date**
- ✅ Can book visits for any date (not restricted to current/next day)
- ✅ Unlike CP users, BST can schedule visits for any future date

**Code Evidence:**
```javascript
// From channelLeadController.js
const isAdmin = req.user.role_id === 2 || req.user.role_id === 3;
if (!isAdmin) {
    // CP users can only book for current date or next calendar date
    // BST can book for any date
}
```

---

## ❌ What BST CANNOT Do

### 1. **Cannot Approve CP Requests After Form Submission**
- ❌ **Cannot approve** CP requests if `doc_verification = 1` (submitted form)
- ❌ **Cannot approve** CP requests if `doc_verification = 2` (being approved)
- ❌ Returns **403 Forbidden** error if attempted
- ⚠️ Only Supervisor (role_id = 3) and Admin (isDB = true) can approve after form submission

**Code Evidence:**
```javascript
// From userController.js - handleAcceptProcess()
else if (req.user.role_id == 2) { // BST role
    // BST should NOT be able to approve CP requests after form submission
    if (userData.role_id == 1 && (userData.doc_verification == 1 || dbUserData.doc_verification == 2)) {
        // CP has submitted form, BST cannot approve
        return "BST cannot approve CP requests. Only Supervisor and Admin can approve after CP submits form.";
    }
}
```

### 2. **Cannot Reject CP Requests After Form Submission**
- ❌ **Cannot reject** CP requests if `doc_verification = 1` (submitted form)
- ❌ **Cannot reject** CP requests if `doc_verification = 3` (being rejected)
- ❌ Returns **403 Forbidden** error if attempted
- ⚠️ Only Supervisor (role_id = 3) and Admin (isDB = true) can reject after form submission

**Code Evidence:**
```javascript
// From userController.js - handleRejectProcess()
else if (req.user.role_id == 2) { // BST role
    // BST should NOT be able to reject CP requests after form submission
    if (userData.role_id == 1 && (userData.doc_verification == 1 || dbUserData.doc_verification == 3)) {
        // CP has submitted form, BST cannot reject
        return "BST cannot reject CP requests. Only Supervisor and Admin can reject after CP submits form.";
    }
}
```

### 3. **Cannot See CP Pending Verifications After Form Submission**
- ❌ **Cannot see** CPs with `doc_verification = 1` (submitted form, pending approval)
- ⚠️ Only sees CPs with `doc_verification = 0` (link sent) or `doc_verification = 3` (rejected)
- ⚠️ This ensures BST cannot initiate approval process after form submission

**Code Evidence:**
```javascript
// From userController.js - getPendingVerificationUser()
else if (req.user.role_id == 2) {
    // BST should NOT see CP pending verifications after form submission
    whereClause.doc_verification = {
        [Op.in]: [0, 3] // Only show link sent or rejected, not submitted
    };
}
```

### 4. **Cannot Create Users**
- ❌ Cannot create new users (only Admin can)
- ❌ Cannot create BST or CP users directly

### 5. **Cannot Create/Edit Roles**
- ❌ Cannot create new roles
- ❌ Cannot edit role permissions
- ❌ Cannot delete roles

### 6. **Cannot Manage System Settings**
- ❌ Cannot manage email configurations
- ❌ Cannot manage email templates
- ❌ Cannot manage organization settings
- ❌ Cannot manage platform settings

### 7. **Cannot See All Data**
- ❌ Cannot see leads from other BST users
- ❌ Cannot see CP leads assigned to other BST users
- ❌ Cannot see CP users assigned to other BST users
- ❌ Cannot see reports from other BST users' data

### 8. **Menu Access Restrictions**
- ⚠️ BST's menu access is based on **role permissions** (`db_role_permissions`)
- ⚠️ BST needs role permissions to access menus
- ⚠️ BST cannot access menus they don't have permissions for

---

## 🔍 Data Access Pattern

### Filtered Access Model

BST uses **filtered access** based on assignments:

```javascript
// Common pattern for BST filtering
if (!req.user.isDB && req.user.role_id != 3) {
    whereClause = {
        assigned_lead: req.user.user_id  // Only assigned leads
    };
}
```

**This means:**
- BST sees data from:
  1. **Direct assignments** (leads assigned to BST)
  2. **CP users under them** (CPs with `report_to = BST user_id`)
  3. **Leads from their CPs** (leads where `assigned_lead = CP user_id` and CP reports to BST)

### CP Lead Assignment

CP leads are **automatically assigned** to BST based on:
1. **State and City Matching** (primary)
   - CP lead's `state` and `city` match BST's `state` and `city`
2. **State-Only Matching** (fallback)
   - CP lead's `state` matches BST's `state`
3. **Round-Robin Distribution**
   - Assigns to BST with least leads
   - If tied, assigns to BST created earliest

**Code Evidence:**
```javascript
// From contactUsController.js - assignCPLeadToBST()
// Priority 1: Match by state AND city
// Priority 2: Fallback to state-only match
// Round-robin: Assign to BST with least leads
```

---

## 📊 BST vs Other Roles Comparison

| Feature | BST (role_id = 2) | Director (role_id = 3) | CP (role_id = 1) | Admin (isDB = true) |
|---------|-------------------|------------------------|------------------|---------------------|
| **See All Leads** | ❌ Only assigned | ✅ Yes | ⚠️ Only assigned | ✅ Yes |
| **See All CP Leads** | ❌ Only assigned | ✅ Yes | ❌ No | ✅ Yes |
| **See All Reports** | ❌ Only assigned | ✅ Yes | ⚠️ Only assigned | ✅ Yes |
| **See All Users** | ❌ Only assigned CPs | ⚠️ Only under hierarchy | ❌ No | ✅ Yes |
| **Approve CP Requests** | ❌ No (after form) | ✅ Yes | ❌ No | ✅ Yes |
| **Reject CP Requests** | ❌ No (after form) | ✅ Yes | ❌ No | ✅ Yes |
| **Update CP Lead Stages** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **See CP Pending (doc_verification = 1)** | ❌ No | ✅ Yes | ❌ No | ✅ Yes |
| **Create Users** | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **Create Roles** | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **Book Visits (Any Date)** | ✅ Yes | ✅ Yes | ❌ Only current/next | ✅ Yes |

---

## 🎯 Key Responsibilities

### 1. **CP Lead Management**
- Manage CP leads assigned to them
- Update CP lead stages (OPEN → CONTACTED → LINK SENT → ONBOARDED)
- Add follow-up dates and remarks
- Reassign CP leads if needed

### 2. **CP User Management**
- Create CP users (send registration links)
- Monitor CP users that report to them
- Track CP user activity and performance

### 3. **Initial CP Onboarding**
- Contact CP leads (change stage to "CONTACTED")
- Send onboarding form link to CP
- Monitor CP registration progress (until form submission)

### 4. **Data Monitoring**
- View reports for assigned leads
- Monitor lead visits and bookings
- Track brokerage data from their CPs

### 5. **Visit Scheduling**
- Schedule visits for any date (not restricted)
- Generate OTP for VISIT stage updates
- Manage visit follow-ups

---

## ⚠️ Important Restrictions

### 1. **CP Approval Restriction**
After CP submits onboarding form (`doc_verification = 1`):
- ❌ BST **cannot see** the CP in pending verifications
- ❌ BST **cannot approve** the CP request
- ❌ BST **cannot reject** the CP request
- ✅ Only **Supervisor (role_id = 3)** and **Admin (isDB = true)** can approve/reject

### 2. **Data Visibility Restriction**
- BST sees **ONLY** data assigned to them
- BST **cannot** see data from other BST users
- BST **cannot** see all system-wide data

### 3. **CP Lead Assignment**
- CP leads are **automatically assigned** to BST based on state/city
- BST **cannot** manually assign CP leads (assignment is automatic)
- BST **can** reassign CP leads to other BST users

---

## 📝 Code Locations

### Data Access (Filtered)
- `controllers/channel/channelReportController.js` - All report functions (filtered)
- `controllers/channel/channelDasboard.js` - Dashboard data (filtered)
- `controllers/contactUsController.js` - CP leads (filtered by `asssigned_to`)
- `controllers/channel/channelLeadController.js` - Lead access (line 248-288)
- `controllers/channel/leadVisitController.js` - Visit access (line 628-664)
- `controllers/channel/bookingController.js` - Booking access (line 144-189)
- `controllers/channel/brokerageController.js` - Brokerage access (line 256-280)

### User Management
- `controllers/userController.js` - `getAllUsers()` (line 1347-1356)
- `controllers/userController.js` - `getUsersByRoleID()` (line 1037-1039)
- `controllers/userController.js` - `getPendingVerificationUser()` (line 2982-2989)

### Approval/Rejection (Restricted)
- `controllers/userController.js` - `handleAcceptProcess()` (line 1864-1870)
- `controllers/userController.js` - `handleRejectProcess()` (line 1924-1930)

### CP Lead Management
- `controllers/contactUsController.js` - `updateChannelPartnerLeads()` (line 462-566)
- `controllers/contactUsController.js` - `assignCPLeadToBST()` (line 73-187)

---

## 🔑 Summary

### BST Can:
✅ See ONLY assigned leads, CP leads, reports (filtered)  
✅ See ONLY CP users that report to them  
✅ Update CP lead stages (including VISIT with OTP)  
✅ Create CP users (send registration links)  
✅ Book visits for any date  
✅ Manage CP leads assigned to them  

### BST Cannot:
❌ Approve/reject CP requests after form submission  
❌ See CP pending verifications after form submission (`doc_verification = 1`)  
❌ See data from other BST users  
❌ Create users or roles  
❌ Manage system settings  
❌ Access menus without role permissions  

### Key Difference from Director:
- **Director (role_id = 3)**: Sees ALL data, can approve/reject CP requests
- **BST (role_id = 2)**: Sees ONLY assigned data, **cannot** approve/reject after form submission

### Key Difference from Admin:
- **Admin (isDB = true)**: Complete access, can manage everything
- **BST (role_id = 2)**: Filtered access, **cannot** manage system settings

---

*Last Updated: Based on comprehensive codebase analysis*

