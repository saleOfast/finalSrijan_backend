const { Sequelize, DataTypes } = require("sequelize");

/**
 * Role Management Menu Seeder
 * This seeder adds role management menu items for all platforms
 */

const roleManagementMenuData = [
    // CHANNEL Platform - Role Management Menu (under Top Navigation - menu_id: 263)
    {
        menu_id: 294,
        menu_name: 'Role Management',
        parent_id: 263,
        menu_order: 9,
        is_active: true,
        link: 'RoleManagement',
        is_task: false,
        icon_path: 'fas fa-user-shield',
        allais_menu: 'Role Management',
        menu_type: 'CHANNEL',
        createdAt: new Date('2023-04-10 11:12:54'),
        updatedAt: new Date('2023-04-10 11:12:54')
    },
    {
        menu_id: 295,
        menu_name: 'Create Role',
        parent_id: 294,
        menu_order: 1,
        is_active: true,
        link: 'CreateRole',
        is_task: false,
        icon_path: 'fas fa-plus',
        allais_menu: 'Create Role',
        menu_type: 'CHANNEL',
        createdAt: new Date('2023-04-10 11:12:54'),
        updatedAt: new Date('2023-04-10 11:12:54')
    },
    {
        menu_id: 296,
        menu_name: 'Edit Role',
        parent_id: 294,
        menu_order: 2,
        is_active: true,
        link: 'EditRole',
        is_task: false,
        icon_path: 'fas fa-edit',
        allais_menu: 'Edit Role',
        menu_type: 'CHANNEL',
        createdAt: new Date('2023-04-10 11:12:54'),
        updatedAt: new Date('2023-04-10 11:12:54')
    },
    {
        menu_id: 297,
        menu_name: 'Role Permissions',
        parent_id: 294,
        menu_order: 3,
        is_active: true,
        link: 'RolePermissions',
        is_task: false,
        icon_path: 'fas fa-key',
        allais_menu: 'Role Permissions',
        menu_type: 'CHANNEL',
        createdAt: new Date('2023-04-10 11:12:54'),
        updatedAt: new Date('2023-04-10 11:12:54')
    }
];

// Additional platforms will be added once we get their parent menu IDs
// These are placeholder entries that need to be updated with actual parent IDs
const additionalPlatformMenus = [
    // CRM Platform (replace [CRM_PARENT_ID] with actual parent menu_id)
    {
        menu_name: 'Role Management',
        parent_id: null, // Will be set dynamically
        menu_order: 9,
        is_active: true,
        link: 'RoleManagement',
        is_task: false,
        icon_path: 'fas fa-user-shield',
        allais_menu: 'Role Management',
        menu_type: 'CRM',
        createdAt: new Date('2023-04-10 11:12:54'),
        updatedAt: new Date('2023-04-10 11:12:54')
    },
    // SALES Platform (replace [SALES_PARENT_ID] with actual parent menu_id)
    {
        menu_name: 'Role Management',
        parent_id: null, // Will be set dynamically
        menu_order: 9,
        is_active: true,
        link: 'RoleManagement',
        is_task: false,
        icon_path: 'fas fa-user-shield',
        allais_menu: 'Role Management',
        menu_type: 'SALES',
        createdAt: new Date('2023-04-10 11:12:54'),
        updatedAt: new Date('2023-04-10 11:12:54')
    },
    // DMS Platform (replace [DMS_PARENT_ID] with actual parent menu_id)
    {
        menu_name: 'Role Management',
        parent_id: null, // Will be set dynamically
        menu_order: 9,
        is_active: true,
        link: 'RoleManagement',
        is_task: false,
        icon_path: 'fas fa-user-shield',
        allais_menu: 'Role Management',
        menu_type: 'DMS',
        createdAt: new Date('2023-04-10 11:12:54'),
        updatedAt: new Date('2023-04-10 11:12:54')
    },
    // MEDIA Platform (replace [MEDIA_PARENT_ID] with actual parent menu_id)
    {
        menu_name: 'Role Management',
        parent_id: null, // Will be set dynamically
        menu_order: 9,
        is_active: true,
        link: 'RoleManagement',
        is_task: false,
        icon_path: 'fas fa-user-shield',
        allais_menu: 'Role Management',
        menu_type: 'MEDIA',
        createdAt: new Date('2023-04-10 11:12:54'),
        updatedAt: new Date('2023-04-10 11:12:54')
    }
];

/**
 * Seed role management menus
 * @param {Sequelize} sequelize - Sequelize instance
 * @param {Object} config - Database configuration
 */
exports.seed = async (sequelize, config) => {
    try {
        console.log('Seeding role management menu items...');

        // Get the next available menu_id
        const maxMenuId = await sequelize.query(
            'SELECT MAX(menu_id) as max_id FROM db_menus',
            { type: sequelize.QueryTypes.SELECT }
        );
        
        let nextMenuId = maxMenuId[0].max_id ? maxMenuId[0].max_id + 1 : 1;

        // Get parent menu IDs for different platforms (including CHANNEL)
        const parentMenus = await sequelize.query(
            'SELECT menu_id, menu_type FROM db_menus WHERE parent_id = 0 AND menu_type IN (?, ?, ?, ?, ?)',
            {
                replacements: ['CHANNEL', 'CRM', 'SALES', 'DMS', 'MEDIA'],
                type: sequelize.QueryTypes.SELECT
            }
        );
        console.log('Parent menus:', parentMenus);
        const parentMenuMap = {};
        parentMenus.forEach(menu => {
            parentMenuMap[menu.menu_type] = menu.menu_id;
        });

        // Prepare all menu items
        const allMenuItems = [...roleManagementMenuData];

        // Add platform-specific menus with correct parent IDs
        const platformTypes = ['CHANNEL', 'CRM', 'SALES', 'DMS', 'MEDIA'];
        platformTypes.forEach(platformType => {
            if (parentMenuMap[platformType]) {
                const parentMenuId = parentMenuMap[platformType];
                
                // For CHANNEL platform, use fixed menu IDs (294-297)
                if (platformType === 'CHANNEL') {
                    // CHANNEL platform uses fixed IDs, so they're already in roleManagementMenuData
                    // Just update the parent_id to the actual CHANNEL parent menu
                    roleManagementMenuData.forEach(menuItem => {
                        if (menuItem.menu_type === 'CHANNEL') {
                            menuItem.parent_id = parentMenuId;
                        }
                    });
                } else {
                    // For other platforms, use dynamic menu IDs
                    // Parent menu
                    allMenuItems.push({
                        menu_id: nextMenuId++,
                        menu_name: 'Role Management',
                        parent_id: parentMenuId,
                        menu_order: 9,
                        is_active: true,
                        link: 'RoleManagement',
                        is_task: false,
                        icon_path: 'fas fa-user-shield',
                        allais_menu: 'Role Management',
                        menu_type: platformType,
                        createdAt: new Date('2023-04-10 11:12:54'),
                        updatedAt: new Date('2023-04-10 11:12:54')
                    });

                    const roleManagementParentId = nextMenuId - 1;

                    // Child menus
                    const childMenus = [
                        { name: 'Create Role', link: 'CreateRole', icon: 'fas fa-plus' },
                        { name: 'Edit Role', link: 'EditRole', icon: 'fas fa-edit' },
                        { name: 'Role Permissions', link: 'RolePermissions', icon: 'fas fa-key' }
                    ];

                    childMenus.forEach((childMenu, index) => {
                        allMenuItems.push({
                            menu_id: nextMenuId++,
                            menu_name: childMenu.name,
                            parent_id: roleManagementParentId,
                            menu_order: index + 1,
                            is_active: true,
                            link: childMenu.link,
                            is_task: false,
                            icon_path: childMenu.icon,
                            allais_menu: childMenu.name,
                            menu_type: platformType,
                            createdAt: new Date('2023-04-10 11:12:54'),
                            updatedAt: new Date('2023-04-10 11:12:54')
                        });
                    });
                }
            } else {
                console.log(`Warning: Parent menu not found for platform: ${platformType}`);
            }
        });

        // Insert all menu items
        for (const menuItem of allMenuItems) {
            await sequelize.query(
                `INSERT INTO db_menus 
                (menu_id, menu_name, parent_id, menu_order, is_active, link, is_task, icon_path, allais_menu, menu_type, createdAt, updatedAt) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                {
                    replacements: [
                        menuItem.menu_id,
                        menuItem.menu_name,
                        menuItem.parent_id,
                        menuItem.menu_order,
                        menuItem.is_active ? 1 : 0,
                        menuItem.link,
                        menuItem.is_task ? 1 : 0,
                        menuItem.icon_path,
                        menuItem.allais_menu,
                        menuItem.menu_type,
                        menuItem.createdAt,
                        menuItem.updatedAt
                    ],
                    type: sequelize.QueryTypes.INSERT
                }
            );
        }

        console.log(`Successfully seeded ${allMenuItems.length} role management menu items`);
        
        // Log the created menu structure
        console.log('\n=== Role Management Menu Structure ===');
        const createdMenus = allMenuItems.filter(item => item.menu_name === 'Role Management');
        createdMenus.forEach(menu => {
            console.log(`${menu.menu_type} Platform:`);
            console.log(`  └── Role Management (ID: ${menu.menu_id}, Parent: ${menu.parent_id})`);
            const children = allMenuItems.filter(item => item.parent_id === menu.menu_id);
            children.forEach(child => {
                console.log(`      └── ${child.menu_name} (ID: ${child.menu_id})`);
            });
        });

        return {
            success: true,
            message: `Seeded ${allMenuItems.length} role management menu items`,
            menuItems: allMenuItems
        };

    } catch (error) {
        console.error('Error seeding role management menus:', error);
        throw error;
    }
};

/**
 * Down function to remove seeded data
 * @param {Sequelize} sequelize - Sequelize instance
 */
exports.down = async (sequelize) => {
    try {
        console.log('Removing role management menu items...');
        
        // Get all role management menu IDs
        const roleManagementMenus = await sequelize.query(
            `SELECT menu_id FROM db_menus WHERE menu_name IN ('Role Management', 'Create Role', 'Edit Role', 'Role Permissions')`,
            { type: sequelize.QueryTypes.SELECT }
        );

        const menuIds = roleManagementMenus.map(menu => menu.menu_id);

        if (menuIds.length > 0) {
            // Delete the menu items
            await sequelize.query(
                `DELETE FROM db_menus WHERE menu_id IN (?)`,
                {
                    replacements: [menuIds],
                    type: sequelize.QueryTypes.DELETE
                }
            );

            console.log(`Successfully removed ${menuIds.length} role management menu items`);
        }

        return {
            success: true,
            message: `Removed ${menuIds.length} role management menu items`
        };

    } catch (error) {
        console.error('Error removing role management menus:', error);
        throw error;
    }
};

/**
 * Run the seeder directly
 * This function can be called to run the seeder independently
 */
exports.runSeeder = async () => {
    try {
        const db = require("../model");
        const { tenantsObj } = require("../connectionResolver/resolver");
        
        // Get all tenant databases
        const tenants = Object.keys(tenantsObj);
        console.log('Tenants:', tenants);
        
        for (const tenantId of tenants) {
            const tenantConfig = tenantsObj[tenantId];
            console.log(`\nSeeding role management menus for tenant: ${tenantId}`);
            
            await exports.seed(tenantConfig.instance.sequelize, tenantConfig);
        }
        
        console.log('\n✅ Role management menu seeding completed for all tenants!');
        
    } catch (error) {
        console.error('❌ Error running role management menu seeder:', error);
        process.exit(1);
    }
};

// If this file is run directly, execute the seeder
if (require.main === module) {
    exports.runSeeder();
}
