# Role Management API Documentation

This API provides endpoints for creating and managing roles with hierarchical menu permissions for the frontend role creation interface.

## Base URL
```
/api/v1/db/role-management
```

## Authentication
All endpoints require authentication via the `supreProtect` middleware.

---

## 1. Get Available Platforms

**Endpoint:** `GET /platforms`

**Description:** Retrieves all available platform types for role creation.

**Response:**
```json
{
  "status": 200,
  "message": "Platforms fetched successfully",
  "data": [
    { "menu_type": "CRM" },
    { "menu_type": "SALES" },
    { "menu_type": "DMS" },
    { "menu_type": "CHANNEL" },
    { "menu_type": "MEDIA" }
  ]
}
```

**Usage in Frontend:**
- Use this to populate the platform dropdown in the role creation form
- The selected platform will determine which menus are displayed

---

## 2. Get Hierarchical Menus by Platform

**Endpoint:** `GET /menus/:platform_type`

**Description:** Retrieves all active menus for a specific platform in hierarchical structure.

**Parameters:**
- `platform_type` (path parameter): The platform type (CRM, SALES, DMS, CHANNEL, MEDIA)

**Response:**
```json
{
  "status": 200,
  "message": "Menus fetched successfully",
  "data": [
    {
      "menu_id": 263,
      "menu_name": "Top Navigation",
      "parent_id": 0,
      "link": null,
      "icon_path": null,
      "menu_order": 1,
      "children": [
        {
          "menu_id": 264,
          "menu_name": "Report and Dashboard",
          "parent_id": 263,
          "link": null,
          "icon_path": null,
          "menu_order": 1,
          "children": [
            {
              "menu_id": 272,
              "menu_name": "View Dashboard",
              "parent_id": 264,
              "link": null,
              "icon_path": null,
              "menu_order": 1,
              "children": [],
              "is_selected": false
            }
          ],
          "is_selected": false
        },
        {
          "menu_id": 265,
          "menu_name": "Channel Partner",
          "parent_id": 263,
          "link": "ActivePartners",
          "icon_path": null,
          "menu_order": 2,
          "children": [
            {
              "menu_id": 273,
              "menu_name": "Create User",
              "parent_id": 265,
              "link": null,
              "icon_path": null,
              "menu_order": 1,
              "children": [],
              "is_selected": false
            },
            {
              "menu_id": 274,
              "menu_name": "View User",
              "parent_id": 265,
              "link": null,
              "icon_path": null,
              "menu_order": 2,
              "children": [],
              "is_selected": false
            }
          ],
          "is_selected": false
        }
      ],
      "is_selected": false
    }
  ]
}
```

**Usage in Frontend:**
- Call this API when user selects a platform
- Use the hierarchical structure to build nested checkboxes
- Each menu item has `children` array for sub-menus
- `is_selected` indicates if the menu is currently selected (for editing)

---

## 3. Get Role Permissions (For Editing)

**Endpoint:** `GET /permissions/:role_id`

**Description:** Retrieves existing role details and permissions for editing a role.

**Parameters:**
- `role_id` (path parameter): The ID of the role to edit

**Response:**
```json
{
  "status": 200,
  "message": "Role permissions fetched successfully",
  "data": {
    "role": {
      "role_id": 1,
      "role_name": "Channel Manager",
      "platform_id": null
    },
    "platform_type": "CHANNEL",
    "menus": [
      {
        "menu_id": 263,
        "menu_name": "Top Navigation",
        "parent_id": 0,
        "link": null,
        "icon_path": null,
        "menu_order": 1,
        "children": [...],
        "is_selected": true,
        "is_indeterminate": false
      },
      {
        "menu_id": 265,
        "menu_name": "Channel Partner",
        "parent_id": 263,
        "link": "ActivePartners",
        "icon_path": null,
        "menu_order": 2,
        "children": [
          {
            "menu_id": 273,
            "menu_name": "Create User",
            "parent_id": 265,
            "link": null,
            "icon_path": null,
            "menu_order": 1,
            "children": [],
            "is_selected": false,
            "is_indeterminate": false
          },
          {
            "menu_id": 274,
            "menu_name": "View User",
            "parent_id": 265,
            "link": null,
            "icon_path": null,
            "menu_order": 2,
            "children": [],
            "is_selected": true,
            "is_indeterminate": false
          }
        ],
        "is_selected": false,
        "is_indeterminate": true
      }
    ],
    "permitted_menu_ids": [263, 274, 275, 276]
  }
}
```

**Usage in Frontend:**
- Use this when editing an existing role
- `is_selected`: true if menu is fully selected
- `is_indeterminate`: true if some but not all children are selected
- `permitted_menu_ids`: Array of all menu IDs that have permissions

---

## 4. Create Role with Permissions

**Endpoint:** `POST /create-with-permissions`

**Description:** Creates a new role with selected menu permissions.

**Request Body:**
```json
{
  "role_name": "Channel Manager",
  "platform_type": "CHANNEL",
  "selected_menu_ids": [263, 264, 272, 274, 275, 276, 279, 281, 284, 287, 289, 293]
}
```

**Parameters:**
- `role_name` (string, required): Name of the role
- `platform_type` (string, required): Platform type (CRM, SALES, DMS, CHANNEL, MEDIA)
- `selected_menu_ids` (array, optional): Array of menu IDs to grant access to

**Response:**
```json
{
  "status": 200,
  "message": "Role created successfully with permissions",
  "data": {
    "role_id": 5,
    "role_name": "Channel Manager",
    "permissions_count": 12
  }
}
```

**Usage in Frontend:**
- Call this when submitting the role creation form
- Include all selected menu IDs (both parent and child menus)
- API automatically ensures parent menu access for hierarchical consistency

---

## 5. Update Role Permissions

**Endpoint:** `PUT /update-permissions`

**Description:** Updates permissions for an existing role.

**Request Body:**
```json
{
  "role_id": 5,
  "selected_menu_ids": [263, 264, 272, 274, 275, 276, 279, 281, 284, 287, 289, 293, 280, 282]
}
```

**Parameters:**
- `role_id` (integer, required): ID of the role to update
- `selected_menu_ids` (array, optional): Array of menu IDs to grant access to

**Response:**
```json
{
  "status": 200,
  "message": "Role permissions updated successfully",
  "data": {
    "role_id": 5,
    "permissions_count": 14
  }
}
```

**Usage in Frontend:**
- Call this when updating permissions for an existing role
- Replaces all existing permissions with the new selection
- API automatically ensures parent menu access for hierarchical consistency

---

## Frontend Implementation Guide

### 1. Role Creation Form Flow

```javascript
// Step 1: Load platforms
GET /api/v1/db/role-management/platforms

// Step 2: User selects platform, load menus
GET /api/v1/db/role-management/menus/CHANNEL

// Step 3: User selects permissions via checkboxes
// Build hierarchical checkbox UI based on menu structure

// Step 4: Submit form
POST /api/v1/db/role-management/create-with-permissions
{
  "role_name": "New Role Name",
  "platform_type": "CHANNEL",
  "selected_menu_ids": [263, 264, 272, 274, 275, 276]
}
```

### 2. Role Editing Form Flow

```javascript
// Step 1: Load existing role data
GET /api/v1/db/role-management/permissions/5

// Step 2: Display form with pre-selected permissions
// Use is_selected and is_indeterminate to set checkbox states

// Step 3: User modifies permissions
// Handle checkbox changes and update selected_menu_ids array

// Step 4: Submit updates
PUT /api/v1/db/role-management/update-permissions
{
  "role_id": 5,
  "selected_menu_ids": [263, 264, 272, 274, 275, 276, 280, 282]
}
```

### 3. Checkbox State Management

For hierarchical checkboxes, implement this logic:

```javascript
// When a child checkbox is checked/unchecked:
function handleChildChange(parentMenu, childMenu, isChecked) {
  // Update child selection
  childMenu.is_selected = isChecked;
  
  // Update parent state based on children
  const selectedChildren = parentMenu.children.filter(child => child.is_selected).length;
  const totalChildren = parentMenu.children.length;
  
  if (selectedChildren === 0) {
    parentMenu.is_selected = false;
    parentMenu.is_indeterminate = false;
  } else if (selectedChildren === totalChildren) {
    parentMenu.is_selected = true;
    parentMenu.is_indeterminate = false;
  } else {
    parentMenu.is_selected = false;
    parentMenu.is_indeterminate = true;
  }
}

// When a parent checkbox is checked/unchecked:
function handleParentChange(parentMenu, isChecked) {
  // Update all children
  parentMenu.children.forEach(child => {
    child.is_selected = isChecked;
    child.is_indeterminate = false;
  });
  
  parentMenu.is_selected = isChecked;
  parentMenu.is_indeterminate = false;
}

// Collect all selected menu IDs for submission:
function getSelectedMenuIds(menus) {
  const selectedIds = [];
  
  function traverse(menu) {
    if (menu.is_selected) {
      selectedIds.push(menu.menu_id);
    }
    menu.children.forEach(traverse);
  }
  
  menus.forEach(traverse);
  return selectedIds;
}
```

### 4. Error Handling

Handle these common error responses:

```json
// Role already exists
{
  "status": 400,
  "message": "Role with this name already exists"
}

// Missing required parameters
{
  "status": 400,
  "message": "Role name and platform type are required"
}

// Role not found (for editing)
{
  "status": 400,
  "message": "Role not found"
}

// Platform type required
{
  "status": 400,
  "message": "Platform type is required"
}
```

---

## Security Features

1. **Authentication**: All endpoints require valid authentication
2. **Hierarchical Consistency**: Parent menus automatically get access when children are selected
3. **Validation**: Input validation for all required parameters
4. **Error Handling**: Comprehensive error logging and user-friendly messages
5. **Data Integrity**: Proper foreign key relationships and constraints

---

## Performance Considerations

1. **Bulk Operations**: Uses `bulkCreate` for efficient permission creation
2. **Hierarchical Queries**: Optimized database queries for menu hierarchy
3. **Caching**: Consider implementing caching for frequently accessed menu data
4. **Pagination**: For large menu structures, consider implementing pagination
