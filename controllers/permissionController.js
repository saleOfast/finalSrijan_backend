const { Sequelize, QueryTypes, where, Op } = require("sequelize");
const { responseError, responseSuccess } = require('../helper/responce');
const { sequelize } = require("../model");
const { middle } = require("../connectionResolver/middleConnection.js");

// role wise permission
exports.givePermission = async (req, res) => {
    try {
        let permissionData = req.body
        let db_name = req.headers.db;

        for (let i = 0; i < permissionData.length; i++) {
            const item = permissionData[i];
            const findRolePermission = await req.config.role_permissions.findOne({
                where: {
                    role_id: req.query.id,
                    menu_id: item.menu_id
                },
                paranoid: false
            });

            if (findRolePermission == null) {
                await req.config.role_permissions.create({
                    role_id: req.query.id,
                    menu_id: item.menu_id,
                    actions: item.actions
                });
            } else {
                const result = await req.config.sequelize.query(
                    `UPDATE ${db_name}.db_role_permissions SET actions = :is_active WHERE permission_id = :permission_id`,
                    {
                        replacements: { is_active: item.actions, permission_id: findRolePermission.permission_id },
                        type: req.config.Sequelize.QueryTypes.UPDATE
                    }
                );

                // await req.config.role_permissions.update({
                //     actions: item.actions ? 1 : 0
                // }, {
                //     where: {
                //         permission_id: findRolePermission.permission_id
                //     }
                // });
            }
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
              db_role_permissions AS r1 ON m1.menu_id = r1.menu_id AND r1.role_id = ${req.user.role_id} where m1.menu_type = '${menu_type}' and m1.is_active = true and m1.is_task = 0 and r1.actions = true and m1.deletedAt IS NULL ORDER BY m1.menu_order ASC`, {
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
