const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const { responseError, responseSuccess } = require('../helper/responce');
const { platform } = require("../model");


exports.storeRole = async (req, res) => {
    try {
        let { role_name } = req.body
        const now = new Date();
        const bulkData = [];

        let roleData;

        roleData = await req.config.user_role.findOne({
            where: {
                role_name: role_name
            }
        })

        if (roleData) return await responseError(req, res, "role already exist")
        roleData = await req.config.user_role.create(req.body) //Creating user rol in db_role

        for (let i = 1; i < 381; i++) {
            bulkData.push({
                role_id: roleData.role_id,
                menu_id: i,
                actions: 1,
                createdAt: now,
                updatedAt: now,
                deletedAt: now
            });
        }

        await req.config.role_permissions.bulkCreate(bulkData);  //Creating user role permssion in db_role_permissions

        // await req.config.sequelize.query(myVariable, {
        //     replacements: { userID: roleData.role_id, time : now },
        //     type: QueryTypes.INSERT,
        // })

        return await responseSuccess(req, res, "role created Succesfully", roleData)

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.getRole = async (req, res) => {
    try {
        let permissions = await req.config.platform.findAll()
        console.log('permissions', permissions)
        let arr = []
        let roleData
        
        for (const permission of permissions) {
            if (permission.is_active == true) {
                console.log('permission', permission)
                arr.push(permission.platform_id)
            }
        }

        console.log('arr', arr)
        let data = await req.config.user_role.findAll({
            where: { platform_id: { [Op.in]: arr } }
        });
        
        if (!data) {
            data = await req.config.user_role.findAll();
        }

        roleData = data

        return await responseSuccess(req, res, "role list", roleData)

    } catch (error) {
        logErrorToFile(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.getRoleOne = async (req, res) => {
    try {

        let roleData = await req.config.user_role.findOne({
            where: {
                role_id: req.query.id
            }
        })
        return await responseSuccess(req, res, "role data", roleData)

    } catch (error) {
        logErrorToFile(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}


exports.editRole = async (req, res) => {
    try {

        let { role_name, role_id } = req.body
        if (role_id == 1 || role_id == 2 || role_id == 3) {
            return await responseError(req, res, "Roles cannot be edited")
        }
        let body = req.body
        let roleData = await req.config.user_role.findOne({
            where: {
                role_id: { [Op.ne]: role_id },
                role_name: role_name
            },
            paranoid: false
        })
        if (roleData) return await responseError(req, res, "role name already existed")

        await req.config.user_role.update(body, {
            where: {
                role_id: role_id
            }
        })
        return await responseSuccess(req, res, "role updated")

    } catch (error) {
        logErrorToFile(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.deleteRole = async (req, res) => {
    try {

        let { role_id } = req.query
        let roleData = await req.config.user_role.findOne({
            where: {
                role_id: role_id,
            }
        })

        if (!roleData) return await responseError(req, res, "role name does not existed")
        await roleData.destroy()
        return await responseSuccess(req, res, "role deleted")

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

// Role Management Functions for Frontend Interface

// Get all platforms for role creation
exports.getPlatforms = async (req, res) => {
    try {
        // Get distinct menu types from db_menu table
        const platforms = await req.config.sequelize.query(
            'SELECT DISTINCT menu_type FROM db_menus WHERE menu_type IS NOT NULL',
            { type: req.config.sequelize.QueryTypes.SELECT }
        );

        return await responseSuccess(req, res, "Platforms fetched successfully", platforms);

    } catch (error) {
        logErrorToFile(error)
        return await responseError(req, res, "Something Went Wrong");
    }
};

// Get hierarchical menus by platform type
exports.getMenusByPlatform = async (req, res) => {
    try {
        const { platform_type } = req.params;
        
        if (!platform_type) {
            return await responseError(req, res, "Platform type is required");
        }

        // Get all menus for the platform, ordered by hierarchy
        const menus = await req.config.menus.findAll({
            where: {
                menu_type: platform_type,
                is_active: true
            },
            order: [
                ['parent_id', 'ASC'],
                ['menu_order', 'ASC'],
                ['menu_id', 'ASC']
            ],
            attributes: ['menu_id', 'menu_name', 'parent_id', 'link', 'icon_path', 'menu_order']
        });

        // Build hierarchical structure
        const menuHierarchy = buildMenuHierarchy(menus);

        return await responseSuccess(req, res, "Menus fetched successfully", menuHierarchy);

    } catch (error) {
        logErrorToFile(error)
        return await responseError(req, res, "Something Went Wrong");
    }
};

// Get existing role permissions for editing
exports.getRolePermissions = async (req, res) => {
    try {
        const { role_id } = req.params;
        
        if (!role_id) {
            return await responseError(req, res, "Role ID is required");
        }

        // Get role details
        const role = await req.config.user_role.findOne({
            where: { role_id },
            attributes: ['role_id', 'role_name', 'platform_id']
        });

        if (!role) {
            return await responseError(req, res, "Role not found");
        }

        // Get role's permissions
        const permissions = await req.config.role_permissions.findAll({
            where: { role_id, actions: true },
            attributes: ['menu_id']
        });

        const permittedMenuIds = permissions.map(p => p.menu_id);

        // Get platform type from role's platform or default to CHANNEL
        let platformType = 'CHANNEL'; // default
        if (role.platform_id) {
            const platform = await req.config.platform.findOne({
                where: { platform_id: role.platform_id },
                attributes: ['platform_type']
            });
            if (platform) {
                platformType = platform.platform_type;
            }
        }

        // Get all menus for the platform
        const menus = await req.config.menus.findAll({
            where: {
                menu_type: platformType,
                is_active: true
            },
            order: [
                ['parent_id', 'ASC'],
                ['menu_order', 'ASC'],
                ['menu_id', 'ASC']
            ],
            attributes: ['menu_id', 'menu_name', 'parent_id', 'link', 'icon_path', 'menu_order']
        });

        // Build hierarchical structure with permission status
        const menuHierarchy = buildMenuHierarchyWithPermissions(menus, permittedMenuIds);

        return await responseSuccess(req, res, "Role permissions fetched successfully", {
            role,
            platform_type: platformType,
            menus: menuHierarchy,
            permitted_menu_ids: permittedMenuIds
        });

    } catch (error) {
        logErrorToFile(error)
        return await responseError(req, res, "Something Went Wrong");
    }
};

// Create role with selected permissions
exports.createRoleWithPermissions = async (req, res) => {
    try {
        const { role_name, platform_type, selected_menu_ids } = req.body;
        
        if (!role_name || !platform_type) {
            return await responseError(req, res, "Role name and platform type are required");
        }

        const now = new Date();

        // Check if role already exists
        const existingRole = await req.config.user_role.findOne({
            where: { role_name }
        });

        if (existingRole) {
            return await responseError(req, res, "Role with this name already exists");
        }

        // Create the role
        const newRole = await req.config.user_role.create({
            role_name,
            platform_id: null, // Will be set based on platform_type if needed
            createdAt: now,
            updatedAt: now
        });

        // Create permissions for selected menus
        if (selected_menu_ids && selected_menu_ids.length > 0) {
            const permissions = selected_menu_ids.map(menu_id => ({
                role_id: newRole.role_id,
                menu_id,
                actions: true,
                createdAt: now,
                updatedAt: now
            }));

            await req.config.role_permissions.bulkCreate(permissions);

            // Ensure parent menu access for hierarchical consistency
            await ensureParentMenuAccess(newRole.role_id, selected_menu_ids, req);
        }

        return await responseSuccess(req, res, "Role created successfully with permissions", {
            role_id: newRole.role_id,
            role_name: newRole.role_name,
            permissions_count: selected_menu_ids ? selected_menu_ids.length : 0
        });

    } catch (error) {
        logErrorToFile(error)
        return await responseError(req, res, "Something Went Wrong");
    }
};

// Update role permissions
exports.updateRolePermissions = async (req, res) => {
    try {
        const { role_id, selected_menu_ids } = req.body;
        
        if (!role_id) {
            return await responseError(req, res, "Role ID is required");
        }

        // Check if role exists
        const role = await req.config.user_role.findOne({
            where: { role_id }
        });

        if (!role) {
            return await responseError(req, res, "Role not found");
        }

        const now = new Date();

        // Remove existing permissions
        await req.config.role_permissions.destroy({
            where: { role_id }
        });

        // Create new permissions
        if (selected_menu_ids && selected_menu_ids.length > 0) {
            const permissions = selected_menu_ids.map(menu_id => ({
                role_id,
                menu_id,
                actions: true,
                createdAt: now,
                updatedAt: now
            }));

            await req.config.role_permissions.bulkCreate(permissions);

            // Ensure parent menu access for hierarchical consistency
            await ensureParentMenuAccess(role_id, selected_menu_ids, req);
        }

        return await responseSuccess(req, res, "Role permissions updated successfully", {
            role_id,
            permissions_count: selected_menu_ids ? selected_menu_ids.length : 0
        });

    } catch (error) {
        logErrorToFile(error)
        return await responseError(req, res, "Something Went Wrong");
    }
};

// Helper function to build menu hierarchy
function buildMenuHierarchy(menus) {
    const menuMap = {};
    const rootMenus = [];

    // Create menu map
    menus.forEach(menu => {
        menuMap[menu.menu_id] = {
            ...menu.toJSON(),
            children: [],
            is_selected: false
        };
    });

    // Build hierarchy
    menus.forEach(menu => {
        const menuItem = menuMap[menu.menu_id];
        if (menu.parent_id === 0 || !menuMap[menu.parent_id]) {
            rootMenus.push(menuItem);
        } else {
            menuMap[menu.parent_id].children.push(menuItem);
        }
    });

    return rootMenus;
}

// Helper function to build menu hierarchy with permissions
function buildMenuHierarchyWithPermissions(menus, permittedMenuIds) {
    const menuMap = {};
    const rootMenus = [];

    // Create menu map with permission status
    menus.forEach(menu => {
        menuMap[menu.menu_id] = {
            ...menu.toJSON(),
            children: [],
            is_selected: permittedMenuIds.includes(menu.menu_id),
            is_indeterminate: false
        };
    });

    // Build hierarchy and calculate indeterminate states
    menus.forEach(menu => {
        const menuItem = menuMap[menu.menu_id];
        if (menu.parent_id === 0 || !menuMap[menu.parent_id]) {
            rootMenus.push(menuItem);
        } else {
            menuMap[menu.parent_id].children.push(menuItem);
        }
    });

    // Calculate indeterminate states for parent menus
    function calculateIndeterminate(menuItem) {
        if (menuItem.children.length === 0) return;

        const selectedChildren = menuItem.children.filter(child => child.is_selected).length;
        const totalChildren = menuItem.children.length;

        if (selectedChildren === 0) {
            menuItem.is_selected = false;
            menuItem.is_indeterminate = false;
        } else if (selectedChildren === totalChildren) {
            menuItem.is_selected = true;
            menuItem.is_indeterminate = false;
        } else {
            menuItem.is_selected = false;
            menuItem.is_indeterminate = true;
        }

        // Recursively calculate for children
        menuItem.children.forEach(calculateIndeterminate);
    }

    rootMenus.forEach(calculateIndeterminate);

    return rootMenus;
}

// Helper function to ensure parent menu access
async function ensureParentMenuAccess(roleId, menuIds, req) {
    const parentMenus = new Set();
    
    for (let menuId of menuIds) {
        // Get parent menu chain
        let currentMenu = await req.config.menus.findByPk(menuId);
        while (currentMenu && currentMenu.parent_id > 0) {
            const parentMenu = await req.config.menus.findByPk(currentMenu.parent_id);
            if (parentMenu && !menuIds.includes(parentMenu.menu_id)) {
                parentMenus.add(parentMenu.menu_id);
                currentMenu = parentMenu;
            } else {
                break;
            }
        }
    }

    // Add parent menu permissions if they don't exist
    if (parentMenus.size > 0) {
        const existingPermissions = await req.config.role_permissions.findAll({
            where: {
                role_id: roleId,
                menu_id: Array.from(parentMenus)
            },
            attributes: ['menu_id']
        });

        const existingMenuIds = existingPermissions.map(p => p.menu_id);
        const newParentMenus = Array.from(parentMenus).filter(menuId => !existingMenuIds.includes(menuId));

        if (newParentMenus.length > 0) {
            const parentPermissions = newParentMenus.map(menuId => ({
                role_id: roleId,
                menu_id: menuId,
                actions: true,
                createdAt: new Date(),
                updatedAt: new Date()
            }));

            await req.config.role_permissions.bulkCreate(parentPermissions);
        }
    }
}

// let myVariable = `
// INSERT INTO db_role_permissions (role_id, menu_id, actions, createdAt, updatedAt, deletedAt ) VALUES
// (:userID,  4, 1, '2023-04-12 11:35:45', '2023-04-12 11:45:53', NULL),
// (:userID,  2, 1, '2023-04-12 11:35:45', '2023-04-12 11:35:45', NULL),
// (:userID,  1, 1, '2023-04-12 11:35:45', '2023-04-12 11:35:45', NULL),
// (:userID,  172, 1, '2023-04-12 11:35:45', '2023-04-12 11:35:45', NULL),
// (:userID,  11, 1, '2023-04-12 12:16:38', '2023-04-12 14:27:31', NULL),
// (:userID,  12, 1, '2023-04-12 12:16:38', '2023-04-12 14:27:31', NULL),
// (:userID,  14, 1, '2023-04-12 12:16:38', '2023-04-12 14:27:31', NULL),
// (:userID,  13, 1, '2023-04-12 12:34:09', '2023-04-12 14:27:31', NULL),
// (:userID,  15, 1, '2023-04-12 12:34:09', '2023-04-12 14:27:31', NULL),
// (:userID,  17, 1, '2023-04-12 12:34:09', '2023-04-12 14:27:31', NULL),
// (:userID,  16, 1, '2023-04-12 12:34:09', '2023-04-12 14:27:31', NULL),
// (:userID,  8, 1, '2023-04-12 14:05:53', '2023-04-12 14:27:31', NULL),
// (:userID,  9, 1, '2023-04-12 14:05:53', '2023-04-12 14:27:31', NULL),
// (:userID,  10, 1, '2023-04-12 14:05:53', '2023-04-12 14:27:31', NULL),
// (:userID,  23, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  18, 1, '2023-04-12 14:05:53', '2023-04-12 14:27:31', NULL),
// (:userID,  30, 1, '2023-04-12 14:05:54', '2023-04-12 14:05:54', NULL),
// (:userID,  27, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  19, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  20, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  25, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  31, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  24, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  50, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  51, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  28, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  21, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  22, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  35, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  26, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  37, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  41, 0, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  46, 0, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  42, 0, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  44, 0, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  29, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  45, 0, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  43, 0, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  33, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  34, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  38, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  36, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  32, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  39, 0, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  40, 0, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  48, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  53, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  49, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  52, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  47, 1, '2023-04-12 14:05:54', '2023-04-12 14:27:31', NULL),
// (:userID,  3, 1, '2023-04-12 14:27:31', '2023-04-12 14:27:31', NULL),
// (:userID,  6, 1, '2023-04-12 14:27:31', '2023-04-12 14:27:31', NULL),
// (:userID,  5, 1, '2023-04-12 14:27:31', '2023-04-12 14:27:31', NULL),
// (:userID,  7, 1, '2023-04-12 14:27:31', '2023-04-12 14:27:31', NULL),
// (:userID,  173, 0, '2023-04-12 14:27:31', '2023-04-24 18:29:01', NULL),
// (:userID,  54, 0, '2023-04-12 15:40:32', '2023-04-24 18:29:01', NULL),
// (:userID,  68, 0, '2023-04-12 15:40:32', '2023-04-24 18:29:01', NULL),
// (:userID,  62, 0, '2023-04-12 15:40:32', '2023-04-24 18:29:01', NULL),
// (:userID,  82, 0, '2023-04-12 15:40:32', '2023-04-24 18:29:01', NULL),
// (:userID,  75, 0, '2023-04-12 15:40:32', '2023-04-24 18:29:01', NULL),
// (:userID,  55, 0, '2023-04-12 15:40:32', '2023-04-24 18:29:01', NULL),
// (:userID,  56, 0, '2023-04-12 15:40:32', '2023-04-24 18:29:01', NULL),
// (:userID,  72, 0, '2023-04-12 15:40:32', '2023-04-24 18:29:01', NULL),
// (:userID,  57, 0, '2023-04-12 15:40:32', '2023-04-24 18:29:01', NULL),
// (:userID,  59, 0, '2023-04-12 15:40:32', '2023-04-24 18:29:01', NULL),
// (:userID,  60, 0, '2023-04-12 15:40:32', '2023-04-24 18:29:01', NULL),
// (:userID,  63, 0, '2023-04-12 15:40:32', '2023-04-24 18:29:01', NULL),
// (:userID,  71, 0, '2023-04-12 15:40:32', '2023-04-24 18:29:01', NULL),
// (:userID,  69, 0, '2023-04-12 15:40:32', '2023-04-24 18:29:01', NULL),
// (:userID,  73, 0, '2023-04-12 15:40:32', '2023-04-24 18:29:01', NULL),
// (:userID,  74, 0, '2023-04-12 15:40:32', '2023-04-24 18:29:01', NULL),
// (:userID,  58, 0, '2023-04-12 15:40:32', '2023-04-24 18:29:01', NULL),
// (:userID,  61, 0, '2023-04-12 15:40:32', '2023-04-24 18:29:01', NULL),
// (:userID,  64, 0, '2023-04-12 15:40:32', '2023-04-24 18:29:01', NULL),
// (:userID,  65, 0, '2023-04-12 15:40:32', '2023-04-24 18:29:01', NULL),
// (:userID,  67, 0, '2023-04-12 15:40:32', '2023-04-24 18:29:01', NULL),
// (:userID,  66, 0, '2023-04-12 15:40:32', '2023-04-24 18:29:01', NULL),
// (:userID,  70, 0, '2023-04-12 15:40:32', '2023-04-24 18:29:01', NULL),
// (:userID,  165, 0, '2023-04-12 15:40:57', '2023-04-24 18:30:47', NULL),
// (:userID,  168, 0, '2023-04-12 15:40:57', '2023-04-24 18:30:47', NULL),
// (:userID,  166, 0, '2023-04-12 15:40:57', '2023-04-24 18:30:47', NULL),
// (:userID,  171, 0, '2023-04-12 15:40:57', '2023-04-24 18:30:47', NULL),
// (:userID,  167, 0, '2023-04-12 15:40:57', '2023-04-24 18:30:47', NULL),
// (:userID,  169, 0, '2023-04-12 15:40:57', '2023-04-24 18:30:47', NULL),
// (:userID,  170, 0, '2023-04-12 15:40:57', '2023-04-24 18:30:47', NULL),
// (:userID,  159, 0, '2023-04-12 15:40:57', '2023-04-24 18:30:47', NULL),
// (:userID,  164, 0, '2023-04-12 15:40:57', '2023-04-24 18:30:47', NULL),
// (:userID,  160, 0, '2023-04-12 15:40:57', '2023-04-24 18:30:47', NULL),
// (:userID,  161, 0, '2023-04-12 15:40:57', '2023-04-24 18:30:47', NULL),
// (:userID,  162, 0, '2023-04-12 15:40:57', '2023-04-24 18:30:47', NULL),
// (:userID,  163, 0, '2023-04-12 15:40:57', '2023-04-24 18:30:47', NULL),
// (:userID,  76, 0, '2023-04-12 15:42:20', '2023-04-24 18:29:01', NULL),
// (:userID,  77, 0, '2023-04-12 15:42:20', '2023-04-24 18:29:01', NULL),
// (:userID,  78, 0, '2023-04-12 15:42:20', '2023-04-24 18:29:01', NULL),
// (:userID,  81, 0, '2023-04-12 15:42:20', '2023-04-24 18:29:01', NULL),
// (:userID,  79, 0, '2023-04-12 15:42:20', '2023-04-24 18:29:01', NULL),
// (:userID,  80, 0, '2023-04-12 15:42:20', '2023-04-24 18:29:01', NULL),
// (:userID,  158, 0, '2023-04-12 15:43:26', '2023-04-24 18:30:47', NULL),
// (:userID,  152, 0, '2023-04-12 15:43:26', '2023-04-24 18:30:47', NULL),
// (:userID,   153, 0, '2023-04-12 15:43:26', '2023-04-24 18:30:47', NULL),
// (:userID,   154, 0, '2023-04-12 15:43:26', '2023-04-24 18:30:47', NULL),
// (:userID,   157, 0, '2023-04-12 15:43:26', '2023-04-24 18:30:47', NULL),
// (:userID,   155, 0, '2023-04-12 15:43:26', '2023-04-24 18:30:47', NULL),
// (:userID,   150, 0, '2023-04-12 15:43:26', '2023-04-24 18:30:47', NULL),
// (:userID,   147, 0, '2023-04-12 15:43:26', '2023-04-24 18:30:47', NULL),
// (:userID,   148, 0, '2023-04-12 15:43:26', '2023-04-24 18:30:47', NULL),
// (:userID,   156, 0, '2023-04-12 15:43:26', '2023-04-24 18:30:47', NULL),
// (:userID,   151, 0, '2023-04-12 15:43:26', '2023-04-24 18:30:47', NULL),
// (:userID,   144, 0, '2023-04-12 15:43:26', '2023-04-24 18:30:47', NULL),
// (:userID,   145, 0, '2023-04-12 15:43:26', '2023-04-24 18:30:47', NULL),
// (:userID,   146, 0, '2023-04-12 15:43:26', '2023-04-24 18:30:47', NULL),
// (:userID,   149, 0, '2023-04-12 15:43:26', '2023-04-24 18:30:47', NULL),
// (:userID,   83, 0, '2023-04-12 15:45:59', '2023-04-24 18:29:01', NULL),
// (:userID,   84, 0, '2023-04-12 15:45:59', '2023-04-24 18:29:01', NULL),
// (:userID,   85, 0, '2023-04-12 15:45:59', '2023-04-24 18:29:01', NULL),
// (:userID,   88, 0, '2023-04-12 15:45:59', '2023-04-24 18:29:01', NULL),
// (:userID,   86, 0, '2023-04-12 15:45:59', '2023-04-24 18:29:01', NULL),
// (:userID,   94, 0, '2023-04-12 15:45:59', '2023-04-24 18:29:01', NULL),
// (:userID,   99, 0, '2023-04-12 15:45:59', '2023-04-24 18:29:01', NULL),
// (:userID,   126, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   117, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   121, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   87, 0, '2023-04-12 15:45:59', '2023-04-24 18:29:01', NULL),
// (:userID,   89, 0, '2023-04-12 15:45:59', '2023-04-24 18:29:01', NULL),
// (:userID,   91, 0, '2023-04-12 15:45:59', '2023-04-24 18:29:01', NULL),
// (:userID,   137, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   92, 0, '2023-04-12 15:45:59', '2023-04-24 18:29:01', NULL),
// (:userID,   93, 0, '2023-04-12 15:45:59', '2023-04-24 18:29:01', NULL),
// (:userID,   90, 0, '2023-04-12 15:45:59', '2023-04-24 18:29:01', NULL),
// (:userID,   95, 0, '2023-04-12 15:45:59', '2023-04-24 18:29:01', NULL),
// (:userID,   96, 0, '2023-04-12 15:45:59', '2023-04-24 18:29:02', NULL),
// (:userID,   97, 0, '2023-04-12 15:45:59', '2023-04-24 18:29:01', NULL),
// (:userID,   98, 0, '2023-04-12 15:45:59', '2023-04-24 18:29:01', NULL),
// (:userID,   100, 0, '2023-04-12 15:45:59', '2023-04-24 18:29:01', NULL),
// (:userID,   107, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   101, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:46', NULL),
// (:userID,   102, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:46', NULL),
// (:userID,   106, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   115, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   123, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   103, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   113, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   132, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   127, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   131, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   133, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   140, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   143, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   104, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   110, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   111, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   112, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   114, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:46', NULL),
// (:userID,   116, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   119, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   118, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   122, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   124, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   120, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   135, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   136, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   139, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   141, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   142, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   125, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   108, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:46', NULL),
// (:userID,   109, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   134, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   138, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   128, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   130, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   129, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   105, 0, '2023-04-12 15:45:59', '2023-04-24 18:30:47', NULL),
// (:userID,   174, 0, '2023-04-12 16:13:05', '2023-04-24 18:30:47', NULL),
// (:userID,   175, 0, '2023-04-12 16:13:05', '2023-04-24 18:30:47', NULL),
// (:userID,   176, 0, '2023-04-12 16:13:05', '2023-04-24 18:30:47', NULL),
// (:userID,   180, 0, '2023-04-12 16:13:05', '2023-04-24 18:30:47', NULL),
// (:userID,   178, 0, '2023-04-12 16:13:05', '2023-04-24 18:30:47', NULL),
// (:userID,   177, 0, '2023-04-12 16:13:05', '2023-04-24 18:30:47', NULL),
// (:userID,   179, 0, '2023-04-12 16:13:05', '2023-04-24 18:30:47', NULL),
// (:userID,   181, 1, '2023-04-20 17:51:08', '2023-04-20 17:51:08', NULL),
// (:userID,   182, 1, '2023-04-20 17:51:08', '2023-04-20 17:51:08', NULL),
// (:userID,   183, 1, '2023-04-20 17:51:08', '2023-04-20 17:51:08', NULL),
// (:userID,   184, 1, '2023-04-20 17:51:08', '2023-04-20 17:51:08', NULL),
// (:userID,   185, 1, '2023-04-20 17:51:08', '2023-04-20 17:51:08', NULL),
// (:userID,   186, 1, '2023-04-20 17:51:08', '2023-04-20 17:51:08', NULL),
// (:userID,   187, 1, '2023-04-20 17:51:08', '2023-04-20 17:51:08', NULL),
// (:userID,  188, 1, '2023-04-20 17:51:08', '2023-04-20 17:51:08', NULL),
// (:userID,  193, 1, '2023-04-20 17:51:08', '2023-04-20 17:51:08', NULL),
// (:userID,  189, 1, '2023-04-20 17:51:08', '2023-04-20 17:51:08', NULL),
// (:userID,  195, 1, '2023-04-20 17:51:08', '2023-04-20 17:51:08', NULL),
// (:userID,  197, 1, '2023-04-20 17:51:08', '2023-04-20 17:51:08', NULL),
// (:userID,  198, 1, '2023-04-20 17:51:08', '2023-04-20 17:51:08', NULL),
// (:userID,  190, 1, '2023-04-20 17:51:08', '2023-04-20 17:51:08', NULL),
// (:userID,  191, 1, '2023-04-20 17:51:08', '2023-04-20 17:51:08', NULL),
// (:userID,  192, 1, '2023-04-20 17:51:08', '2023-04-20 17:51:08', NULL),
// (:userID,  194, 1, '2023-04-20 17:51:08', '2023-04-20 17:51:08', NULL),
// (:userID,  196, 1, '2023-04-20 17:51:08', '2023-04-20 17:51:08', NULL),
// (:userID,  199, 1, '2023-04-20 17:51:08', '2023-04-20 17:51:08', NULL),
// (:userID,  200, 1, '2023-04-20 17:51:08', '2023-04-20 17:51:08', NULL),
// (:userID,  201, 1, '2023-04-20 17:51:08', '2023-04-20 17:51:08', NULL),
// (:userID,  202, 1, '2023-04-20 17:51:08', '2023-04-20 17:51:08', NULL),
// (:userID,  203, 0, '2023-04-21 12:37:12', '2023-04-24 18:31:25', NULL),
// (:userID,  204, 0, '2023-04-21 12:37:12', '2023-04-24 18:31:25', NULL),
// (:userID,  205, 0, '2023-04-21 12:37:12', '2023-04-24 18:31:25', NULL),
// (:userID,  207, 0, '2023-04-21 12:37:12', '2023-04-24 18:31:25', NULL),
// (:userID,  206, 0, '2023-04-21 12:37:12', '2023-04-24 18:31:25', NULL),
// (:userID,  208, 0, '2023-04-21 12:37:12', '2023-04-24 18:31:25', NULL),
// (:userID,  209, 0, '2023-04-21 12:37:12', '2023-04-24 18:31:25', NULL),
// (:userID,  210, 0, '2023-04-21 12:37:48', '2023-04-24 18:31:25', NULL),
// (:userID,  211, 0, '2023-04-21 12:37:48', '2023-04-24 18:31:25', NULL),
// (:userID,  216, 0, '2023-04-21 12:37:48', '2023-04-24 18:31:25', NULL),
// (:userID,  215, 0, '2023-04-21 12:37:48', '2023-04-24 18:31:25', NULL),
// (:userID,  212, 0, '2023-04-21 12:37:48', '2023-04-24 18:31:25', NULL),
// (:userID,  213, 0, '2023-04-21 12:37:48', '2023-04-24 18:31:25', NULL),
// (:userID,  217, 0, '2023-04-21 12:37:48', '2023-04-24 18:31:25', NULL),
// (:userID,  218, 0, '2023-04-21 12:37:48', '2023-04-24 18:31:25', NULL),
// (:userID,  214, 0, '2023-04-21 12:37:48', '2023-04-24 18:31:25', NULL),
// (:userID,  219, 0, '2023-04-21 12:37:48', '2023-04-24 18:31:25', NULL),
// (:userID,  220, 0, '2023-04-21 12:37:48', '2023-04-24 18:31:25', NULL),
// (:userID,  221, 0, '2023-04-21 12:37:48', '2023-04-24 18:31:25', NULL),
// (:userID, 222, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 223, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 224, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 225, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 226, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 227, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 228, 1, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 229, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 230, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 231, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 232, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 233, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 234, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 235, 1, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 236, 1, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 237, 1, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 238, 1, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 239, 1, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 240, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 241, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 242, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 243, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 244, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 245, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 246, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 247, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 248, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 249, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 250, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 251, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 252, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 253, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 254, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 255, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 256, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 257, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 258, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 259, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 260, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 261, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL),
// (:userID, 262, 0, '2023-04-21 12:37:48', '2023-04-21 12:37:48', NULL);`