const { Sequelize, QueryTypes, where, Op } = require("sequelize");
const { responseError, responseSuccess } = require('../helper/responce');
const { sequelize } = require("../model");
const { middle } = require("../connectionResolver/middleConnection.js");

// role wise permission
exports.givePermission = async (req, res) => {
    try {
        let permissionData = req.body
        let db_name = req.headers.db;
        const role_id = req.query.id;

        if (!role_id) {
            return await responseError(req, res, "Role ID is required");
        }

        // Get menu_ids from request to identify which permissions should be processed
        const requestMenuIds = permissionData.map(item => item.menu_id);

        // Process each permission in the request
        for (let i = 0; i < permissionData.length; i++) {
            const item = permissionData[i];
            const actionsValue = item.actions === true || item.actions === 1 || item.actions === 'true' || item.actions === '1';
            
            const findRolePermission = await req.config.role_permissions.findOne({
                where: {
                    role_id: role_id,
                    menu_id: item.menu_id
                },
                paranoid: false
            });

            if (findRolePermission == null) {
                // Only create permission if actions is true
                if (actionsValue) {
                    await req.config.role_permissions.create({
                        role_id: role_id,
                        menu_id: item.menu_id,
                        actions: true
                    });
                }
                // If actions is false and permission doesn't exist, skip (don't create unnecessary records)
            } else {
                // Permission exists, update it
                if (actionsValue) {
                    // Set to true (1)
                    await req.config.sequelize.query(
                        `UPDATE ${db_name}.db_role_permissions SET actions = 1, updatedAt = NOW() WHERE permission_id = :permission_id`,
                        {
                            replacements: { permission_id: findRolePermission.permission_id },
                            type: req.config.Sequelize.QueryTypes.UPDATE
                        }
                    );
                } else {
                    // Set to false (0) or delete the permission
                    // Option 1: Set to false (maintains history)
                    await req.config.sequelize.query(
                        `UPDATE ${db_name}.db_role_permissions SET actions = 0, updatedAt = NOW() WHERE permission_id = :permission_id`,
                        {
                            replacements: { permission_id: findRolePermission.permission_id },
                            type: req.config.Sequelize.QueryTypes.UPDATE
                        }
                    );
                    // Option 2: Delete the permission (uncomment if you prefer to delete instead of setting to false)
                    // await findRolePermission.destroy();
                }
            }
        }

        // Optional: Remove permissions that exist in DB but are not in the request
        // This ensures that if a menu was previously granted but is not in the new request, it gets removed
        if (requestMenuIds.length > 0) {
            await req.config.role_permissions.destroy({
                where: {
                    role_id: role_id,
                    menu_id: { [Op.notIn]: requestMenuIds }
                }
            });
        }

        return await responseSuccess(req, res, "role permitted succesfully")
    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

let AllData = []; // store all Menu Data

const child = (item, i) => {
    let newobj = item;

    var countChild = AllData.filter((obj, j) => {
        return item.menu_id === obj.parent_id;
    });

    // invoking the call back function

    if (countChild.length > 0) {
        countChild.map((ele, i) => {
            let data = child(ele, i);
            if (newobj["children"] !== undefined) {
                newobj.children.push(data);
            } else {
                newobj.children = [data];
            }
        });
        return newobj;
    } else {
        newobj.children = [];
        return newobj;
    }
};

exports.ViewPermissionRoleWise = async (req, res) => {
    try {
        let menu_type = req.query.pf || 'CRM'

        let RolePermissionData = await req.config.sequelize.query(`SELECT m1.menu_id,
        m1.menu_name,
        m1.parent_id,
        m1.menu_order,
        m1.is_active,
        m1.link,
        r1.permission_id,
        r1.role_id,
        m1.is_task,
        m1.icon_path,
        m1.allais_menu,
        m1.menu_type,
        IFNULL(r1.actions, 0) as "actions"
    FROM
        db_menus AS m1
        LEFT JOIN db_role_permissions AS r1 ON m1.menu_id = r1.menu_id AND r1.role_id = ${req.query.id} where m1.menu_type = '${menu_type}' and m1.is_active = true and m1.deletedAt IS NULL ORDER BY m1.menu_order ASC `, {
            type: QueryTypes.SELECT,
        })

        AllData = RolePermissionData;
        const rootNodes = AllData.filter((item) => item.parent_id == 0);

        const tree = rootNodes.map((rootNode) => {
            const node = { ...rootNode, children: buildTree(rootNode.menu_id) };
            return node;
        });

        return await responseSuccess(req, res, "role permitted list", tree)



    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

const buildTree = (parentId) => {
    const children = AllData.filter((item) => item.parent_id == parentId);
    return children.map((child) => {
        const node = { ...child, children: buildTree(child.menu_id) };
        return node;
    });
};


exports.getDynamicDashboardNav = async (req, res) => {
    try {

        let dashboardNav = []
        let menu_type = req.query.pf || 'CRM'
        console.log(menu_type)
        if (req.user.isDB) {
            dashboardNav = await req.config.sequelize.query(`SELECT m1.menu_id, m1.menu_name, m1.parent_id, m1.menu_order, m1.is_active, m1.link, m1.is_task, m1.icon_path, m1.allais_menu, m1.menu_type FROM db_menus AS m1 where  m1.menu_type = '${menu_type}' and m1.is_active = true and m1.is_task = 0 and m1.deletedAt IS NULL ORDER BY m1.menu_order ASC`, {
                type: QueryTypes.SELECT,
            })
        } else {
            dashboardNav = await req.config.sequelize.query(`SELECT m1.menu_id, m1.menu_name, m1.parent_id, m1.menu_order, m1.is_active, m1.link, m1.is_task, m1.icon_path, m1.allais_menu, m1.menu_type, r1.permission_id, r1.role_id, IFNULL(r1.actions, 0) as "actions" FROM db_menus AS m1 LEFT JOIN db_role_permissions AS r1 ON m1.menu_id = r1.menu_id AND r1.role_id = ${req.user.role_id} where m1.menu_type = '${menu_type}' and  r1.actions = true and m1.is_task = 0 and m1.is_active = true and m1.deletedAt IS NULL ORDER BY m1.menu_order ASC`, {
                type: QueryTypes.SELECT,
            })
        }

        AllData = dashboardNav; // storing all the cats data
        // Dynamically find root menus (parent_id = 0) for the platform instead of hardcoding menu IDs
        var parent_data = dashboardNav.filter((obj, j) => {
            return obj.parent_id == 0;
        });

        var newArr = []; // storing tree data

        // initializing the child method first time

        parent_data.map((item, i) => {
            let finalData = child(item, i);
            newArr.push(finalData);
        });

        return await responseSuccess(req, res, "dashboardNav", newArr)


    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.updateMenuNav = async (req, res) => {
    try {

        const data = req.body
        let updatedData = await req.config.menus.update(data, {
            where: {
                menu_id: data.menu_id
            }
        })

        return await responseSuccess(req, res, "menu allias updated successfully", updatedData)
    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.getDynamicDashboardAdminNav = async (req, res) => {
    try {

        let menu_type = req.query.pf || 'CRM'
        let dashboardNav = [];

        if (req.user.isDB) {
            let db = req.user.db_name;
            dashboardNav = await req.config.sequelize.query(`SELECT m1.menu_id,
              m1.menu_name,
              m1.parent_id,
              m1.menu_order,
              m1.is_active,
              m1.link,
              m1.is_task,
              m1.icon_path,
              m1.allais_menu
          FROM
              ${db}.db_menus AS m1 where m1.menu_type = '${menu_type}' 
              and m1.is_active = true 
              and  m1.is_task = 0 
              and m1.deletedAt IS NULL
          ORDER BY
              m1.menu_order ASC`, {
                type: QueryTypes.SELECT,
            })
        } else {
            dashboardNav = await req.config.sequelize.query(`
              SELECT m1.menu_id,
              m1.menu_name,
              m1.parent_id,
              m1.menu_order,
              m1.is_active,
              m1.link,
              m1.is_task,
              m1.icon_path,
              m1.allais_menu,
              r1.permission_id,
              r1.role_id,
              IFNULL(r1.actions, 0) as "actions"
          FROM
              db_menus AS m1
          LEFT JOIN
              db_role_permissions AS r1 ON m1.menu_id = r1.menu_id AND r1.role_id = ${req.user.role_id} where m1.menu_type = '${menu_type}' and m1.is_active = true and m1.is_task = 0 and m1.deletedAt IS NULL ORDER BY m1.menu_order ASC`, {
                type: QueryTypes.SELECT,
            })
        }

        AllData = dashboardNav; // storing all the cats data
        // Dynamically find root menus (parent_id = 0) for the platform instead of hardcoding menu IDs
        var parent_data = dashboardNav.filter((obj, j) => {
            return obj.parent_id == 0;
        });

        var newArr = []; // storing tree data

        // initializing the child method first time

        parent_data.map((item, i) => {
            let finalData = child(item, i);
            newArr.push(finalData);
        });

        return await responseSuccess(req, res, "dashboardAdminNav", newArr)


    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.permissionCheckAtLogin = async (req, res) => {
    try {

        const connection = await middle(req.query.db_name, req, res)
        let menu_type = req.query.pf || 'CRM'

        let RolePermissionData = await connection.sequelize.query(`SELECT m1.menu_id,
        m1.menu_name,
        m1.parent_id,
        m1.menu_order,
        m1.is_active,
        m1.link,
        r1.permission_id,
        r1.role_id,
        m1.is_task,
        m1.icon_path,
        m1.allais_menu,
        m1.menu_type,
        IFNULL(r1.actions, 0) as "actions"
    FROM
        db_menus AS m1
        LEFT JOIN db_role_permissions AS r1 ON m1.menu_id = r1.menu_id AND r1.role_id = ${req.query.id} where m1.menu_type = '${menu_type}' and m1.is_active = true and m1.deletedAt IS NULL ORDER BY m1.menu_order ASC `, {
            type: QueryTypes.SELECT,
        })

        AllData = RolePermissionData;
        const rootNodes = AllData.filter((item) => item.parent_id == 0);

        const tree = rootNodes.map((rootNode) => {
            const node = { ...rootNode, children: buildTree(rootNode.menu_id) };
            return node;
        });

        return await responseSuccess(req, res, "role permitted list", tree)

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.getRolePermissionsFiltered = async (req, res) => {
    try {
        const role_id = req.query.role_id || req.params.role_id;

        if (!role_id) {
            return await responseError(req, res, "Role ID is required");
        }

        // Filter role permissions where role_id matches, actions = 1 (true), and deletedAt is null
        // Since paranoid: true is set in the model, findAll automatically excludes soft-deleted records
        const rolePermissions = await req.config.role_permissions.findAll({
            where: {
                role_id: role_id,
                actions: true // or 1, both work for BOOLEAN
            },
            attributes: ['permission_id', 'role_id', 'menu_id', 'actions', 'createdAt', 'updatedAt']
        });

        return await responseSuccess(req, res, "Role permissions filtered successfully", rolePermissions);

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}