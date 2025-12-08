# CP List - Onboarded CPs Not Showing Issue

## 🔍 Problem Description

When viewing the **Channel Partner list** in Supervisor, Admin, or BST portals, **onboarded CPs are not appearing** in the list, even though they have been successfully onboarded (status changed to "ONBOARDED").

---

## 📋 Current Flow Analysis

### 1. **CP Lead Creation** ✅
- **Location**: `controllers/contactUsController.js` → `addChannelPartnerLead()`
- CP Lead is created in `db_channel_partner_leads` table
- Automatically assigned to BST based on state/city (`asssigned_to` = BST user_id)
- **Hierarchy**: CP Lead → BST → Supervisor → Admin

### 2. **Document Upload** ✅
- **Location**: `controllers/userController.js` → `cpCompleteRegistration()`
- CP uploads documents, `doc_verification = 1` (pending verification)
- Notification sent to Supervisor

### 3. **Acceptance/Onboarding** ✅
- **Location**: `controllers/userController.js` → `handleAcceptProcess()` (line 1848-1917)
- When Supervisor/Admin accepts:
  - ✅ `doc_verification = 2` in `db_users` table
  - ✅ CP Lead `stage = 'ONBOARDED'` in `db_channel_partner_leads` table
  - ✅ `report_to` is set from CP Lead's `asssigned_to` (BST user_id) in `db_users` table
  - ✅ `onboarding_date` is set to current date

**Code (line 1890-1908):**
```javascript
if (data && dbUserData.doc_verification == 2) {
    let userExistInCPLeads = await req.config.channelPartnerLeads.findOne({
        where: { email: userData.email }
    })
    if (userExistInCPLeads) {
        await userExistInCPLeads.update({ stage: 'ONBOARDED' })
        
        // Transfer ownership: Set report_to from CP lead's assigned_to (BST user)
        if (userExistInCPLeads.asssigned_to && userData.role_id == 1) {
            await userDataInDB.update({ report_to: userExistInCPLeads.asssigned_to });
            await db.clients.update(
                { report_to: userExistInCPLeads.asssigned_to },
                { where: { user_code: dbUserData.user_code } }
            );
        }
    }
}
```

### 4. **CP List Query** ❌ **THE PROBLEM**

**Location**: `controllers/userController.js` → `getUsersByRoleID()` (line 976-1173)

**The Issue**: The query filters by **current week by default** when no date parameters are provided.

**Problematic Code (line 1008-1024):**
```javascript
else {
    let weekStartDate = getCurrentWeekStartDate();
    let weekEndDate = getCurrentWeekEndDate();
    whereClause[Op.or] = [
        {
            createdAt: {
                [Op.gte]: weekStartDate,
                [Op.lte]: weekEndDate
            }
        },
        {
            onboarding_date: {
                [Op.gte]: weekStartDate,
                [Op.lte]: weekEndDate
            }
        }
    ];
}
```

**Why This Fails:**
- If a CP was **created weeks/months ago** but **onboarded today**:
  - Their `createdAt` is **outside the current week** ❌
  - Their `onboarding_date` is **today (within current week)** ✅
  - BUT: The `Op.or` condition requires **EITHER** createdAt **OR** onboarding_date to be in the current week
  - However, when combined with other filters (role_id, doc_verification, report_to), the date filter is too restrictive

**Actual Filtering Logic:**
1. ✅ Filters `role_id = 1` (Channel Partners only)
2. ✅ Filters `doc_verification = 2` (Approved/Onboarded CPs only)
3. ✅ Filters `report_to` based on user role (BST/Supervisor hierarchy)
4. ❌ **Filters by current week** - This excludes CPs created weeks ago but onboarded recently

---

## 🔧 Root Cause

The date filter in `getUsersByRoleID()` is applied **by default** (when no `f_date`/`t_date` query parameters are provided), which restricts results to the **current week only**. This means:

- ✅ CPs created **this week** and onboarded **this week** → **SHOW** ✅
- ❌ CPs created **last month** but onboarded **today** → **HIDDEN** ❌

---

## 🎯 Solution

### Option 1: Remove Default Week Filter for CP List (Recommended)
When viewing CP list (`role_id = 1`), don't apply default week filtering. Show all onboarded CPs regardless of when they were created.

### Option 2: Use Only `onboarding_date` for CP List
For CP list queries, only filter by `onboarding_date` (not `createdAt`), since `onboarding_date` is more relevant for showing "active/onboarded" CPs.

### Option 3: Make Date Filter Optional
Only apply date filtering if explicit date parameters are provided in the query. If no dates are provided, show all onboarded CPs.

---

## 📝 Code Locations

### Files to Modify:
1. **`controllers/userController.js`**
   - `getUsersByRoleID()` function (line 976-1173)
   - Date filtering logic (line 979-1034)

### Related Functions:
- `getAllUsers()` (line 1205-1468) - **Works correctly** (no default date filtering)
- `getUsersByRoleID()` (line 976-1173) - **Has the issue** (applies week filter by default)

---

## 🧪 Testing

After fix, verify:
- ✅ CPs created weeks ago but onboarded today appear in the list
- ✅ CPs created this week and onboarded this week still appear
- ✅ Date filters still work when `f_date`/`t_date` are provided
- ✅ BST/Supervisor/Admin can see CPs that report to them (hierarchy works)

---

## 📊 Summary

| Aspect | Status |
|--------|--------|
| CP Lead Creation | ✅ Working |
| Document Upload | ✅ Working |
| Onboarding Acceptance | ✅ Working |
| `report_to` Assignment | ✅ Working |
| CP List Query - Role Filter | ✅ Working |
| CP List Query - Date Filter | ❌ **BROKEN** (too restrictive) |

**The fix**: Modify `getUsersByRoleID()` to not apply default week filtering for CP lists, or make the date filter logic more intelligent (use `onboarding_date` instead of `createdAt` for CPs).

