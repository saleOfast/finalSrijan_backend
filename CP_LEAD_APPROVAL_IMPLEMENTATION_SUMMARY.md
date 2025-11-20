# CP Lead Approval Flow Implementation Summary

## ✅ Implementation Complete

All changes have been implemented to ensure that **only Supervisor** can see and approve CP onboarding requests after the CP submits the form.

---

## 🔧 Changes Implemented

### 1. **Modified `getPendingVerificationUser()` - Restrict BST Access**
**File**: `controllers/userController.js`  
**Lines**: 2977-3021

**Changes**:
- BST (role_id = 2) can NO LONGER see CP pending verifications with `doc_verification = 1` (submitted form)
- BST can only see CPs with `doc_verification = 0` (link sent but not submitted) or `doc_verification = 3` (rejected)
- Supervisor (role_id = 3) can see ALL CP pending verifications, including those with `doc_verification = 1`
- Supervisor can see CPs that report to BSTs under them, CPs that report directly to them, and CPs with no report_to

**Result**: Only Supervisor can see CP onboarding requests after form submission.

---

### 2. **Modified `handleAcceptProcess()` - Prevent BST Approval**
**File**: `controllers/userController.js`  
**Lines**: 1856-1872

**Changes**:
- Added check to prevent BST from approving CP requests after form submission
- If BST tries to approve a CP request with `doc_verification = 1`, it returns an error message
- Only Supervisor (role_id = 3) can approve CP requests after form submission

**Result**: BST cannot approve CP requests after CP submits form.

---

### 3. **Modified `handleRejectProcess()` - Prevent BST Rejection**
**File**: `controllers/userController.js`  
**Lines**: 1916-1933

**Changes**:
- Added check to prevent BST from rejecting CP requests after form submission
- If BST tries to reject a CP request with `doc_verification = 1`, it returns an error message
- Only Supervisor (role_id = 3) can reject CP requests after form submission

**Result**: BST cannot reject CP requests after CP submits form.

---

### 4. **Added Notification to Supervisor in `cpCompleteRegistration()`**
**File**: `controllers/userController.js`  
**Lines**: 2761-2838

**Changes**:
- When CP submits onboarding form (`doc_verification = 1`), all Supervisor users (role_id = 3) are notified via email
- Email includes CP name, email, contact, and company name
- Uses email template (template_id = 9) if available, otherwise uses default email content
- Notification is sent asynchronously and doesn't block the form submission

**Result**: Supervisor is notified when CP submits onboarding form.

---

### 5. **Added CP Lead Stage Update in `createUser()`**
**File**: `controllers/userController.js`  
**Lines**: 468-502

**Changes**:
- When registration link is sent to CP (role_id = 1), CP lead stage is automatically updated to "LINK SENT"
- Finds CP lead by email or contact number
- Updates CP lead stage and creates a new entry in `db_channel_partner_lead_details` table
- Error handling ensures that lead update failure doesn't block user creation

**Result**: CP lead stage is automatically updated to "LINK SENT" when registration link is sent.

---

### 6. **Modified `updateUser()` - Handle BST Approval/Rejection Errors**
**File**: `controllers/userController.js`  
**Lines**: 1737-1753

**Changes**:
- Added error handling to check if BST tried to approve/reject CP request
- Returns 403 Forbidden status if BST tries to approve/reject CP request after form submission
- Error message clearly states that only Supervisor can approve/reject after CP submits form

**Result**: Proper error response when BST tries to approve/reject CP request.

---

## 🔄 Complete Flow (As Implemented)

### Step 1: CP Lead Created ✅
- CP lead is created with `stage = 'OPEN'`
- Automatically assigned to BST based on state/city
- Email sent to admin

### Step 2: BST Changes Status to CONTACTED ✅
- BST manually updates lead stage to `'CONTACTED'`
- Done via `updateChannelPartnerLeads` endpoint

### Step 3: BST/Admin Sends Onboarding Form Link ✅
- Admin creates CP user (role_id = 1)
- Registration token generated and sent to CP via email
- **CP lead stage automatically updated to "LINK SENT"** ✨

### Step 4: CP Fills and Submits Onboarding Form ✅
- CP completes registration with documents
- `doc_verification = 1` (pending verification)
- **Supervisor is notified via email** ✨

### Step 5: Approval Process ✅
- **Only Supervisor can see CP pending verifications** ✨
- **BST cannot see CP pending verifications after form submission** ✨
- **BST cannot approve/reject CP requests after form submission** ✨
- **Only Supervisor can approve/reject CP requests** ✨

### Step 6: Supervisor Approves ✅
- Supervisor approves CP request
- `doc_verification = 2` (approved)
- CP lead stage updated to "ONBOARDED"
- Password reset email sent to CP

---

## 🎯 Key Features

1. **BST Restriction**: BST cannot see or approve CP requests after form submission
2. **Supervisor Only**: Only Supervisor can see and approve CP requests after form submission
3. **Automatic Notifications**: Supervisor is automatically notified when CP submits form
4. **Automatic Stage Updates**: CP lead stage is automatically updated to "LINK SENT" when registration link is sent
5. **Error Handling**: Proper error messages when BST tries to approve/reject CP request

---

## 📝 Testing Checklist

- [ ] Test CP lead creation and BST assignment
- [ ] Test BST changing status to "CONTACTED"
- [ ] Test CP user creation and registration link sending
- [ ] Verify CP lead stage is updated to "LINK SENT"
- [ ] Test CP form submission
- [ ] Verify Supervisor receives notification email
- [ ] Test BST cannot see CP pending verifications (doc_verification = 1)
- [ ] Test Supervisor can see CP pending verifications
- [ ] Test BST cannot approve CP request (should return 403 error)
- [ ] Test Supervisor can approve CP request
- [ ] Test BST cannot reject CP request (should return 403 error)
- [ ] Test Supervisor can reject CP request
- [ ] Verify CP lead stage is updated to "ONBOARDED" on approval

---

## 🚨 Important Notes

1. **BST Can Still See**: BST can still see CPs with `doc_verification = 0` (link sent but not submitted) or `doc_verification = 3` (rejected)
2. **Supervisor Access**: Supervisor can see ALL CP pending verifications, including those that report to BSTs under them
3. **Email Notifications**: Email notifications are sent asynchronously and don't block the request
4. **Error Handling**: All error handling is in place to ensure the system doesn't break if notifications or stage updates fail

---

## 🔍 Code Locations

- **getPendingVerificationUser()**: `controllers/userController.js` (lines 2890-3072)
- **handleAcceptProcess()**: `controllers/userController.js` (lines 1836-1877)
- **handleRejectProcess()**: `controllers/userController.js` (lines 1896-1939)
- **cpCompleteRegistration()**: `controllers/userController.js` (lines 2683-2888)
- **createUser()**: `controllers/userController.js` (lines 405-503)
- **updateUser()**: `controllers/userController.js` (lines 1717-1756)

---

## ✅ Implementation Status

All changes have been successfully implemented and are ready for testing.

**Status**: ✅ **COMPLETE**

