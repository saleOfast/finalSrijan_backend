# Roles and CP Lead Approval Flow Summary

## 📊 Roles in the System

### Common Role IDs (Hardcoded in Codebase)

| Role ID | Role Name | Description | Usage |
|---------|-----------|-------------|-------|
| **1** | Channel Partner (CP) | Channel partner users | CP users who manage leads and bookings |
| **2** | BST (Business Sales Team) | Business Sales Team / Admin/Manager | Manages CP leads, approves CP users |
| **3** | Director/Supervisor | Director/Supervisor role | Oversees BST users and CP leads |
| **5** | Media | Media platform users | Media-related functionality |
| **10** | DMS | DMS (Dealer Management System) users | DMS platform users |

### Dynamic Roles

- The system supports **dynamic role creation** through the Role Management API
- Roles are stored in the `db_role` table
- Roles can be created with platform-specific permissions (CRM, SALES, DMS, CHANNEL, MEDIA)
- The exact number of roles depends on what's stored in your database

### Finding All Roles

To get the complete list of roles in your system, use the API endpoint:
```
GET /api/v1/db/role-management/roles
```

Or query the database directly:
```sql
SELECT role_id, role_name, platform_id 
FROM db_role 
WHERE deletedAt IS NULL;
```

---

## 🔄 CP Lead Approval Flow

### When a CP Lead is Created

**Endpoint**: `POST /api/v1/db/channelPartnerLeads`

**Controller**: `addChannelPartnerLead` in `controllers/contactUsController.js`

### Approval Assignment Process

1. **Lead Creation**:
   - CP lead is created with `stage = 'OPEN'`
   - Lead details are stored in `db_channel_partner_leads` table
   - Lead details entry is created in `db_channel_partner_lead_details` table

2. **Automatic BST Assignment**:
   - Function `assignCPLeadToBST()` is automatically called
   - **Assignment Criteria**:
     - Finds BST users (`role_id = 2`) with matching `state` AND `city`
     - If no match found, falls back to matching by `state` only
     - Uses **round-robin logic** to assign to BST with least leads
   
3. **Assignment Logic** (from `controllers/contactUsController.js:73-187`):
   ```javascript
   // Priority 1: Match by state AND city
   WHERE role_id = 2 
   AND user_status = true 
   AND deletedAt IS NULL
   AND state = :state 
   AND city = :city
   
   // Priority 2: Fallback to state-only match
   WHERE role_id = 2 
   AND user_status = true 
   AND deletedAt IS NULL
   AND state = :state
   
   // Round-robin: Assign to BST with least leads
   // If tied, assign to BST created earliest
   ```

4. **Result**:
   - CP lead's `asssigned_to` field is updated with BST `user_id`
   - The BST user (`role_id = 2`) is responsible for managing/approving the lead

### Key Fields

- **CP Lead Table** (`db_channel_partner_leads`):
  - `cpl_id`: Primary key
  - `asssigned_to`: BST user_id (who manages this lead)
  - `stage`: Lead stage (OPEN, CONTACTED, LINK SENT, ONBOARDED, etc.)
  - `state`, `city`: Used for BST assignment matching

- **BST User** (`db_users`):
  - `user_id`: Primary key
  - `role_id = 2`: BST role identifier
  - `state`, `city`: Used for matching with CP leads
  - `user_status = true`: Active BST users only

---

## 📝 Summary

### Roles
- **Minimum 5 common roles** (role_id: 1, 2, 3, 5, 10)
- **Dynamic role creation** supported via Role Management API
- **Total number of roles** depends on database contents

### CP Lead Approval
- **CP leads are automatically assigned to BST users** (`role_id = 2`)
- **Assignment is based on**:
  - State and city matching (primary)
  - State-only matching (fallback)
  - Round-robin distribution (least leads first)
- **BST users** are responsible for:
  - Managing CP leads
  - Approving CP user registrations
  - Verifying documents
  - Updating lead stages

### Important Notes

1. **State and City are Required**: CP leads must have both `state` and `city` for proper BST assignment
2. **BST Assignment is Automatic**: No manual intervention needed when creating CP leads
3. **Round-Robin Distribution**: Leads are distributed evenly among BST users to balance workload
4. **Fallback Logic**: If no BST matches city, system falls back to state-only matching

---

## 🔍 Verification Queries

### Check All Roles
```sql
SELECT role_id, role_name, platform_id, createdAt 
FROM db_role 
WHERE deletedAt IS NULL 
ORDER BY role_id;
```

### Check BST Users
```sql
SELECT user_id, user, email, state, city, user_status 
FROM db_users 
WHERE role_id = 2 
AND user_status = true 
AND deletedAt IS NULL;
```

### Check CP Leads and Their Assignments
```sql
SELECT 
    cpl.cpl_id,
    cpl.first_name,
    cpl.last_name,
    cpl.email,
    cpl.state,
    cpl.city,
    cpl.stage,
    cpl.asssigned_to,
    u.user AS assigned_bst_name,
    u.email AS assigned_bst_email
FROM db_channel_partner_leads cpl
LEFT JOIN db_users u ON cpl.asssigned_to = u.user_id
WHERE cpl.deletedAt IS NULL
ORDER BY cpl.createdAt DESC;
```

### Check Lead Distribution Among BST Users
```sql
SELECT 
    u.user_id,
    u.user AS bst_name,
    u.state,
    u.city,
    COUNT(cpl.cpl_id) AS lead_count
FROM db_users u
LEFT JOIN db_channel_partner_leads cpl ON u.user_id = cpl.asssigned_to 
    AND cpl.deletedAt IS NULL
WHERE u.role_id = 2 
AND u.user_status = true 
AND u.deletedAt IS NULL
GROUP BY u.user_id, u.user, u.state, u.city
ORDER BY lead_count ASC;
```

---

*Last Updated: Based on codebase analysis of `controllers/contactUsController.js` and `controllers/roleController.js`*

