# CP Lead Approval Flow Analysis

## 📋 Current Flow Analysis

### What Currently Happens:

1. **CP Lead Creation** ✅
   - CP lead is created with `stage = 'OPEN'`
   - Automatically assigned to BST (role_id = 2) based on state/city
   - Email sent to admin
   - **File**: `controllers/contactUsController.js` → `addChannelPartnerLead()`
   - **Line**: 189-303

2. **BST Changes Status to CONTACTED** ✅
   - BST manually updates lead stage to `'CONTACTED'`
   - **File**: `controllers/contactUsController.js` → `updateChannelPartnerLeads()`
   - **Line**: 462-566
   - **Endpoint**: `PUT /api/v1/db/channelPartnerLeads`

3. **BST/Admin Sends Onboarding Form Link** ✅
   - Admin creates CP user (role_id = 1)
   - Registration token generated and sent to CP via email
   - **File**: `controllers/userController.js` → `createUser()`
   - **Line**: 405-467
   - **Endpoint**: `POST /api/v1/db/users`
   - **Note**: There's NO automatic update of CP lead stage to "LINK SENT" when user is created

4. **CP Fills and Submits Onboarding Form** ✅
   - CP completes registration with documents
   - `doc_verification = 1` (pending verification)
   - **File**: `controllers/userController.js` → `cpCompleteRegistration()`
   - **Line**: 2641-2780
   - **Endpoint**: `PUT /api/v1/db/users/cp/completeRegistration`
   - **Issue**: NO notification sent to Supervisor when form is submitted

5. **Approval Process** ❌ **PROBLEM AREA**
   - Currently, BOTH BST (role_id = 2) and Supervisor/Director (role_id = 3) can see pending verifications
   - BST can approve, but it only sets `bst_approval = true` and waits for Director approval
   - Only Director (role_id = 3) can set `doc_verification = 2` (fully approved)
   - **File**: `controllers/userController.js` → `handleAcceptProcess()`
   - **Line**: 1803-1854
   - **Issue**: BST should NOT be able to approve after CP submits form

---

## 🎯 Desired Flow (What You Want)

1. ✅ CP Lead Created → Auto-assigned to BST
2. ✅ BST changes status to "CONTACTED"
3. ✅ BST/Admin sends onboarding form link to CP
4. ✅ CP fills and submits onboarding form
5. ❌ **Request should go to Supervisor (role_id = 3) for approval, NOT BST**
6. ❌ **BST should NOT be involved in approval after CP submits form**

---

## ❌ What's NOT Happening in Current Code

### Issue 1: No Automatic Routing to Supervisor
- **Problem**: When CP submits form (`doc_verification = 1`), there's NO automatic routing to Supervisor
- **Current**: Both BST and Supervisor can see pending verifications via `getPendingVerificationUser`
- **Expected**: Only Supervisor should see pending verifications after CP submits form
- **File**: `controllers/userController.js` → `getPendingVerificationUser()`
- **Line**: 2782-2831

### Issue 2: BST Can Still Approve
- **Problem**: BST (role_id = 2) can approve CP requests, even though you want it to go directly to Supervisor
- **Current**: BST approval sets `bst_approval = true` but requires Director approval
- **Expected**: BST should NOT be able to approve after CP submits form
- **File**: `controllers/userController.js` → `handleAcceptProcess()`
- **Line**: 1820-1828

### Issue 3: No Notification to Supervisor
- **Problem**: When CP submits form, there's NO email notification sent to Supervisor
- **Current**: No notification mechanism when `doc_verification = 1`
- **Expected**: Supervisor should be notified when CP submits form
- **File**: `controllers/userController.js` → `cpCompleteRegistration()`
- **Line**: 2641-2780

### Issue 4: No Automatic Stage Update
- **Problem**: CP lead stage is NOT automatically updated to "LINK SENT" when registration link is sent
- **Current**: Stage remains "CONTACTED" even after link is sent
- **Expected**: Stage should update to "LINK SENT" when registration link is sent
- **File**: `controllers/userController.js` → `createUser()`
- **Line**: 405-467

---

## 🔧 What Needs to Be Changed

### Change 1: Restrict BST Approval
- **Action**: Modify `handleAcceptProcess()` to prevent BST from approving CP requests after form submission
- **Location**: `controllers/userController.js` → `handleAcceptProcess()`
- **Change**: Remove or restrict BST approval logic for CP (role_id = 1) when `doc_verification = 1`

### Change 2: Route to Supervisor Only
- **Action**: Modify `getPendingVerificationUser()` to show pending verifications only to Supervisor (role_id = 3)
- **Location**: `controllers/userController.js` → `getPendingVerificationUser()`
- **Change**: Add role-based filtering to show pending CP verifications only to Supervisor

### Change 3: Add Notification to Supervisor
- **Action**: Send email notification to Supervisor when CP submits form
- **Location**: `controllers/userController.js` → `cpCompleteRegistration()`
- **Change**: Add email notification to Supervisor (role_id = 3) when `doc_verification = 1`

### Change 4: Update CP Lead Stage
- **Action**: Automatically update CP lead stage to "LINK SENT" when registration link is sent
- **Location**: `controllers/userController.js` → `createUser()`
- **Change**: Update CP lead stage when CP user is created and registration link is sent

### Change 5: Update Approval Flow
- **Action**: Ensure only Supervisor (role_id = 3) can approve CP requests after form submission
- **Location**: `controllers/userController.js` → `handleAcceptProcess()`
- **Change**: Modify approval logic to skip BST and go directly to Supervisor

---

## 📊 Approval Flow Comparison

### Current Flow:
```
CP Submits Form (doc_verification = 1)
    ↓
Both BST and Supervisor can see it
    ↓
BST can approve (but requires Director approval)
    ↓
Director/Supervisor can approve (sets doc_verification = 2)
```

### Desired Flow:
```
CP Submits Form (doc_verification = 1)
    ↓
Only Supervisor can see it (BST cannot)
    ↓
Supervisor approves (sets doc_verification = 2)
    ↓
CP is onboarded
```

---

## 🔍 Key Code Sections to Modify

### 1. `controllers/userController.js` → `cpCompleteRegistration()`
- **Line**: 2641-2780
- **Action**: Add notification to Supervisor when form is submitted
- **Action**: Optionally update CP lead stage

### 2. `controllers/userController.js` → `handleAcceptProcess()`
- **Line**: 1803-1854
- **Action**: Remove BST approval logic for CP (role_id = 1)
- **Action**: Ensure only Supervisor (role_id = 3) can approve

### 3. `controllers/userController.js` → `getPendingVerificationUser()`
- **Line**: 2782-2831
- **Action**: Filter to show pending CP verifications only to Supervisor

### 4. `controllers/userController.js` → `createUser()`
- **Line**: 405-467
- **Action**: Update CP lead stage to "LINK SENT" when registration link is sent

---

## ✅ Summary

**Current State**: 
- BST can see and approve CP requests (though it requires Director approval)
- No automatic routing to Supervisor
- No notification to Supervisor when CP submits form

**Desired State**:
- BST should NOT be able to approve after CP submits form
- Only Supervisor should see and approve CP requests
- Supervisor should be notified when CP submits form
- Approval should go directly to Supervisor, bypassing BST

**Main Issues**:
1. BST can still approve (should be restricted)
2. No automatic routing to Supervisor
3. No notification to Supervisor
4. No automatic stage update to "LINK SENT"

---

## 🚀 Next Steps

1. Modify `handleAcceptProcess()` to restrict BST approval for CP
2. Modify `getPendingVerificationUser()` to show only to Supervisor
3. Add notification to Supervisor in `cpCompleteRegistration()`
4. Update CP lead stage in `createUser()`
5. Test the complete flow to ensure it works as expected

