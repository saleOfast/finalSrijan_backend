# Role Management Menu Seeder

This seeder adds role management menu items to all platform types (CRM, SALES, DMS, CHANNEL, MEDIA) in your application.

## 📋 What This Seeder Does

### Menu Structure Created:
```
Role Management (Parent Menu)
├── Create Role
├── Edit Role
└── Role Permissions
```

### Platforms Supported:
- **CHANNEL** - Added under "Top Navigation" (menu_id: 263)
- **CRM** - Added under the top-level CRM parent menu
- **SALES** - Added under the top-level SALES parent menu  
- **DMS** - Added under the top-level DMS parent menu
- **MEDIA** - Added under the top-level MEDIA parent menu

## 🚀 How to Run the Seeder

### Method 1: Using the Runner Script (Recommended)
```bash
cd seeders
node run-role-management-seeder.js
```

### Method 2: Direct Execution
```bash
cd seeders
node role-management-menu-seeder.js
```

### Method 3: Programmatic Usage
```javascript
const roleManagementSeeder = require('./seeders/role-management-menu-seeder');

// Run for all tenants
await roleManagementSeeder.runSeeder();

// Or run for specific database configuration
const result = await roleManagementSeeder.seed(sequelizeInstance, config);
```

## 🔧 Prerequisites

1. **Database Connection**: Ensure your database is running and accessible
2. **Existing Menus**: The seeder expects existing parent menus for each platform
3. **Menu Table**: The `db_menus` table must exist in your database

## 📊 Seeder Details

### Menu Items Created:
| Menu Name | Link | Icon | Description |
|-----------|------|------|-------------|
| Role Management | RoleManagement | fas fa-user-shield | Main role management section |
| Create Role | CreateRole | fas fa-plus | Create new roles |
| Edit Role | EditRole | fas fa-edit | Edit existing roles |
| Role Permissions | RolePermissions | fas fa-key | Manage role permissions |

### Database Fields:
- `menu_id`: Auto-incremented unique identifier
- `menu_name`: Display name of the menu
- `parent_id`: Parent menu ID (0 for top-level)
- `menu_order`: Position in menu hierarchy
- `is_active`: Menu visibility status
- `link`: Frontend route identifier
- `is_task`: Task menu flag
- `icon_path`: Font Awesome icon class
- `allais_menu`: Accessibility text
- `menu_type`: Platform type (CRM, SALES, DMS, CHANNEL, MEDIA)
- `createdAt`/`updatedAt`: Timestamps

## 🔄 Rollback / Undo

To remove the seeded menu items:

```javascript
const roleManagementSeeder = require('./seeders/role-management-menu-seeder');
await roleManagementSeeder.down(sequelizeInstance);
```

## ⚠️ Important Notes

### Parent Menu Detection:
- The seeder automatically detects parent menu IDs for CRM, SALES, DMS, and MEDIA platforms
- For CHANNEL platform, it uses the known parent menu_id: 263 (Top Navigation)
- If a parent menu is not found for a platform, it will skip that platform and log a warning

### Menu ID Assignment:
- The seeder automatically determines the next available menu_id
- It starts from the current maximum menu_id + 1 to avoid conflicts

### Multi-Tenant Support:
- The seeder runs for all tenant databases in your system
- It uses the existing tenant connection resolver

## 🔍 Troubleshooting

### Common Issues:

1. **"Parent menu not found" Warning**
   - This means the seeder couldn't find a top-level menu for a specific platform
   - Check that you have existing parent menus for all platforms
   - Run this query to verify: `SELECT menu_id, menu_name, menu_type FROM db_menus WHERE parent_id = 0`

2. **Database Connection Errors**
   - Ensure your database is running
   - Check your database configuration
   - Verify connection credentials

3. **Permission Errors**
   - Ensure the database user has INSERT permissions on the `db_menus` table

### Verification:
After running the seeder, you can verify the created menus:

```sql
-- Check all role management menus
SELECT * FROM db_menus WHERE menu_name LIKE '%Role%' ORDER BY menu_type, menu_order;

-- Check menu hierarchy
SELECT 
    m1.menu_id,
    m1.menu_name,
    m1.parent_id,
    m1.menu_type,
    m2.menu_name as parent_name
FROM db_menus m1
LEFT JOIN db_menus m2 ON m1.parent_id = m2.menu_id
WHERE m1.menu_name LIKE '%Role%'
ORDER BY m1.menu_type, m1.menu_order;
```

## 🎯 Integration with Frontend

After running the seeder, the role management menus will be available in your frontend navigation. Users with appropriate permissions will see:

- **Role Management** - Main section
- **Create Role** - Access to role creation interface
- **Edit Role** - Access to role editing interface  
- **Role Permissions** - Access to permission management

The frontend can use the menu links to navigate to the corresponding role management pages.

## 📝 Customization

### To Modify Menu Details:
Edit the `roleManagementMenuData` array in `role-management-menu-seeder.js` to change:
- Menu names
- Icons
- Links
- Order
- Any other menu properties

### To Add More Platforms:
1. Add the platform type to the `platformTypes` array
2. Ensure you have a parent menu for that platform
3. The seeder will automatically create the menu structure

## 🛠️ Maintenance

### Updating Existing Menus:
If you need to update existing menu items, you can:
1. Run the `down()` function to remove existing menus
2. Modify the seeder data
3. Run the `seed()` function again

### Adding New Menu Items:
Simply add new menu objects to the appropriate arrays in the seeder file and re-run it.

---

**Note**: This seeder is designed to be idempotent - it can be run multiple times without creating duplicate entries, as it uses specific menu IDs.
