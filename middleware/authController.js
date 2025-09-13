const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const { responseError } = require("../helper/responce")
const model = require('../model')


// declare model index
const superAdmin = model.supers

exports.protect = async (req, res, next) => {
    try {
        let token;
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer")
        ) {
            token = req.headers.authorization.split(" ")[1];
        }
        if (!token) return responseError(req, res, "No token Found")

        // token verifintg
        const decoded = await promisify(jwt.verify)(token, process.env.CLIENT_SECRET);
        const currentUser = await req.config.users.findByPk(decoded.id);
        if (!currentUser) return responseError(req, res, "user not found")
        req.user = currentUser.dataValues;
        next();

    } catch (error) {
        logErrorToFile(error)
        return responseError(req, res, "please login again token expired")
    }
};

exports.supreProtect = async (req, res, next) => {
    try {
        let token;
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer")
        ) {
            token = req.headers.authorization.split(" ")[1];
        }
        if (!token) {
            return res.status(404).json({
                status: 404,
                mesage: 'token not found',
                data: null
            })
        }

        // token verifintg
        const decoded = await promisify(jwt.verify)(token, process.env.CLIENT_SECRET);
        const currentUser = await superAdmin.findOne({
            where: {
                superCode: decoded.id
            }
        });

        if (!currentUser) {
            return res.status(404).json({
                status: 404,
                mesage: 'token not valid',
                data: null
            })
        }
        req.user = currentUser.dataValues;
        next();

    } catch (error) {
        logErrorToFile(error)

        return res.status(404).json({
            status: 404,
            mesage: 'token not valid',
            data: null
        })
    }
};

exports.rolePermission = async (req, res, next,) => {
    try {
        // for pass the permission
        if (req.headers.pass == 'pass') {
            next()
        }
        else {
            // Special case: Allow platform fetching without m_id for role management setup
            if (req.originalUrl.includes('/roles/platforms') && req.method === 'GET') {
                console.log('Platform fetching detected - bypassing m_id requirement');
                next();
                return;
            }
            
            // for admin permission
            if (req.user.isDB == true) {
                console.log(req.headers,"=======>>req.headers")
                console.log(req.headers.m_id,"=======>>req.headers.m_id")
                console.log(!req.headers.m_id,"=======>>req.headers.m_idbool")
                // if no menu id then respond with not authorised
                if (!req.headers.m_id) {
                    return responseError(req, res, "not authorised")
                }
                // find client permission in permission menu
                let clientdata = await req.config.menus.findOne({
                    where: {
                        menu_id: req.headers.m_id,
                        is_active: true
                    }
                })
                if (clientdata == null) {
                    return responseError(req, res, "Admin User not authorised for this action")
                }
                else {
                    next();
                }
            } else {

                // if no menu id then respond with not authorised
                if (!req.headers.m_id) {
                    return responseError(req, res, "not authorised. No m_id found")
                }
                // find client permission in permission menu and then check role permission in role

                let clientdata = await req.config.menus.findOne({
                    where: {
                        menu_id: req.headers.m_id,
                        is_active: true
                    }
                })

                if (clientdata == null) {
                    return responseError(req, res, "User not authorised for this action")
                }

                let findUserPermissionInProgram = await req.config.sequelize.query(
                    `SELECT * FROM db_role_permissions WHERE role_id = ${req.user.role_id} and menu_id = ${Number(req.headers.m_id)};`,
                    {
                        type: QueryTypes.SELECT,
                    }
                )
                let arr = findUserPermissionInProgram.flat()

                // const findUserPermissionInProgram = await req.config.role_permissions.findOne({
                //     where: {
                //         role_id: req.user.role_id,
                //         menu_id: req.headers.m_id,
                //         actions: true
                //     }
                // })

                if (findUserPermissionInProgram.length <= 0) {
                    return responseError(req, res, "User not authorised for this action")
                }
                else {
                    if (Number(arr[0].actions) == 1) {
                        next();
                    } else {
                        return responseError(req, res, "User not authorised for this action")

                    }
                }
            }
        }

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return responseError(req, res, "Something Went Wrong")
    }
};