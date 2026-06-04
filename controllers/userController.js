const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const { responseError, responseSuccess } = require("../helper/responce");
const bcrypt = require("bcryptjs");
const db = require("../model");
const crypto = require("crypto");
const fileUpload = require("../common/imageExport");
const { first } = require("../connectionResolver/firstConnection");
const sendEmail = require("../common/mailer");
const moment = require("moment");
const jwt = require("jsonwebtoken");
const { BASE_URL } = require("../config/constant");
const path = require("path");
var fs = require("fs");
const { promisify } = require("util");
const { middle } = require("../connectionResolver/middleConnection");
const { first_small } = require("../connectionResolver/firstConnection_small");
const { admin } = require("./dbCreateController");
const {
    assignProjectsToChannelPartner,
    getCpAssignedProjectsView,
    getBstAssignedChannelPartnersView,
    getBstCpProjectMap,
} = require("../services/channel/channelPartnerProjectService");
const { log } = require("console");
const axios = require("axios");
require("dotenv").config();

const CHANNEL_LICENSE_MIN_LIMIT = 10000;


function getCurrentWeekStartDate() {
    let now = new Date();
    let dayOfWeek = now.getDay(); // 0 (monday) to 6 (Sunday)
    let diff = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    let startDate = new Date(now);
    startDate.setDate(startDate.getDate() + diff);
    return startDate.toISOString().split('T')[0]; // Format as yyyy-mm-dd
}

function getCurrentWeekEndDate() {
    let now = new Date();
    let dayOfWeek = now.getDay(); // 0 (monday) to 6 (Sunday)
    let diff = (dayOfWeek === 0 ? 0 : 7) - dayOfWeek;
    let endDate = new Date(now);
    endDate.setDate(endDate.getDate() + diff);
    return endDate.toISOString().split('T')[0]; // Format as yyyy-mm-dd
}

const randomCodeGenrator = (name) => {
    var result = "";
    result = Math.floor(10000000 + Math.random() * 90000000);
    var code = name + result;
    return code;
};

const randomSixCodeGenrator = () => {
    var result = "";
    result = Math.floor(100000 + Math.random() * 900000);
    return result;
};

const buildTree = (auth, parentId, dashNavArr) => {
    const children = AllData.filter((item) => item.parent_id == parentId);
    children.forEach((child) => {
        if (auth && child.is_active == 1) {
            dashNavArr.push(child);
        } else {
            if (child.actions == 1) {
                dashNavArr.push(child);
            }
        }
        if (dashNavArr.length > 0) {
            return dashNavArr;
        } else {
            return dashNavArr.concat(buildTree(auth, child.menu_id, dashNavArr)); // Recursive call without assigning to a variable
        }
    });
    return dashNavArr;
};

exports.totalUser = async (req, res) => {
    try {
        const count = await req.config.users.count({
            where: {
                isDB: false,
            },
        });

        let clientAdmin = await db.clients.findOne({
            where: {
                db_name: db_name,
                isDB: true,
            },
        });

        const countData = {
            userCount: count,
            no_of_license: clientAdmin.no_of_license,
        };

        return await responseSuccess(req, res, "user list count", countData);
    } catch (error) {
        logErrorToFile(error)
        return await responseError(req, res, "Something Went Wrong");
    }
};

exports.checkplatformPermission = async (req, res) => {
    try {
        let platform_id = 1;
        let result = false
        if (req.body.type === 'crm') {
            platform_id = 1
        } else if (req.body.type === 'dms') {
            platform_id = 2

        } else if (req.body.type === 'sales') {
            platform_id = 3

        } else if (req.body.type === 'media') {
            platform_id = 5

        } else {
            platform_id = 4

        }
        let getData = await req.config.userPlatform.count({
            attributes: ['platform_id', 'actions'],
            where: {
                platform_id,
                actions: true
            },
        })

        let userAdminSubscriptionData = await db.clients.findOne({
            attributes: ['no_of_license', 'no_of_channel_license', 'no_of_dms_license', 'no_of_sales_license', 'no_of_media_license'],
            where: {
                isDB: 1,
                db_name: req.user.db_name
            },
        });
        const effectiveChannelLicenseLimit = Math.max(
            Number(userAdminSubscriptionData?.no_of_channel_license || 0),
            CHANNEL_LICENSE_MIN_LIMIT
        );

        if (req.body.type === 'crm' && userAdminSubscriptionData.no_of_license > getData) {
            result = true
        } else if (req.body.type === 'dms' && userAdminSubscriptionData.no_of_dms_license > getData) {
            result = true
        } else if (req.body.type === 'sales' && userAdminSubscriptionData.no_of_sales_license > getData) {
            result = true
        } else if (req.body.type === 'partner' && effectiveChannelLicenseLimit > getData) {
            result = true
        } else if (req.body.type === 'media' && userAdminSubscriptionData.no_of_media_license > getData) {
            result = true
        } else {
            result = false
        }

        return await responseSuccess(req, res, "check result data", result);

    } catch (error) {
        logErrorToFile(error)
        console.log("error", error)
        return await responseError(req, res, "check permission failed", error);
    }
}

exports.createUser = async (req, res) => {
    const processClient = await req.config.sequelize.transaction();
    const DBprocess = await db.sequelize.transaction();
    try {
        let { email, role_id, isCRM, isDMS, isSALES, isCHANNEL, isMEDIA, cpt_id } = req.body;
        const parsePlatformFlag = (value) => value === true || value === 1 || value === "1" || value === "true";
        let crmEnabled = parsePlatformFlag(isCRM);
        let dmsEnabled = parsePlatformFlag(isDMS);
        let salesEnabled = parsePlatformFlag(isSALES);
        let channelEnabled = parsePlatformFlag(isCHANNEL);
        let mediaEnabled = parsePlatformFlag(isMEDIA);

        // Validate channel partner type id against current tenant DB
        if (cpt_id !== undefined && cpt_id !== null) {
            const parsedCptId = Number(cpt_id);
            if (Number.isNaN(parsedCptId)) {
                req.body.cpt_id = null;
            } else {
                const cptExists = await req.config.channelPartnerType.findOne({ where: { cpt_id: parsedCptId } });
                if (!cptExists) {
                    req.body.cpt_id = null; // avoid FK violation; FK is ON DELETE SET NULL
                } else {
                    req.body.cpt_id = parsedCptId;
                }
            }
        }

        // find cliend admin db
        let clientAdmin = await db.clients.findOne(
            {
                where: {
                    db_name: req.user.db_name,
                    isDB: true,
                },
            },
            { transaction: processClient }
        );

        // if (clientAdmin.dataValues.domain != null) {
        //   if (clientAdmin.domain.split("@")[1] != email.split("@")[1]) {
        //     await processClient.cleanup();
        //     await DBprocess.cleanup();
        //     return res
        //       .status(400)
        //       .json({ status: 400, message: "domain does not match" });
        //   }
        // }

        let userCode = randomCodeGenrator("USER");
        let userPassword = await bcrypt.hash(userCode, 10);
        let data = req.body;
        data.zone = req.body.zone ?? null;
        data.password = userPassword;
        data.isDB = false;
        data.user_code = userCode;
        let userData;
        userData = await req.config.users.findOne(
            {
                where: {
                    // db_name: req.user.db_name,
                    email: email,
                },
            },
            { transaction: processClient }
        );

        if (userData) {

            await processClient.rollback();
            await DBprocess.rollback();
            await processClient.cleanup();
            await DBprocess.cleanup();

            return res.status(400).json({ status: 400, message: "user existed in this db", userData });
        } else {
            // check if licese exxced or not

            // const count = await req.config.users.count({
            //   where: {
            //     isDB: false,
            //   },
            // });

            async function giveCount(platformId) {
                let count = await req.config.userPlatform.count({
                    where: {
                        platform_id: platformId,
                        actions: true
                    },
                });
                return count
            }
            // const count = await req.config.users.count({
            //   where: {
            //     isDB: false,
            //   },
            // });

            async function checkLicenseAvailability(type, limit, limitName) {
                const normalizedLimit = Number(limit) || 0;
                let availableLicenses = await giveCount(type);
                if (availableLicenses >= normalizedLimit) {
                    await processClient.rollback();
                    await DBprocess.rollback();
                    await processClient.cleanup();
                    await DBprocess.cleanup();
                    await responseError(req, res, `Cannot add more user, user count exceeds the license count. Current limit for ${limitName} is ${normalizedLimit}`);
                    return false;
                }
                return true;
            }

            if (crmEnabled && !(await checkLicenseAvailability(1, clientAdmin.no_of_license, "CRM"))) {
                return;
            }

            if (dmsEnabled && !(await checkLicenseAvailability(2, clientAdmin.no_of_dms_license, "DMS"))) {
                return;
            }

            if (salesEnabled && !(await checkLicenseAvailability(3, clientAdmin.no_of_sales_license, "SALES"))) {
                return;
            }

            const effectiveChannelLicenseLimit = Math.max(
                Number(clientAdmin?.no_of_channel_license || 0),
                CHANNEL_LICENSE_MIN_LIMIT
            );

            if (channelEnabled && !(await checkLicenseAvailability(4, effectiveChannelLicenseLimit, "CHANNEL"))) {
                return;
            }

            if (mediaEnabled && !(await checkLicenseAvailability(5, clientAdmin.no_of_media_license, "MEDIA"))) {
                return;
            }


            // if (count >= clientAdmin.no_of_license) {
            //   await processClient.rollback();
            //   await DBprocess.rollback();
            //   await processClient.cleanup();
            //   await DBprocess.cleanup();
            //   return await responseError(
            //     req,
            //     res,
            //     "cannot add more user, user count exceed the license count"
            //   );
            // }

            data.subscription_start_date = clientAdmin.dataValues.subscription_start_date;
            (data.subscription_end_date = clientAdmin.dataValues.subscription_end_date),
                (data.no_of_months = clientAdmin.dataValues.no_of_months);
            data.domain = clientAdmin.dataValues.domain;
            data.no_of_license = clientAdmin.dataValues.no_of_license;
            data.no_of_channel_license = clientAdmin.dataValues.no_of_channel_license;
            data.no_of_dms_license = clientAdmin.dataValues.no_of_dms_license;
            data.no_of_sales_license = clientAdmin.dataValues.no_of_sales_license;
            data.no_of_media_license = clientAdmin.dataValues.no_of_media_license;
            data.sidebar_color = clientAdmin.dataValues.sidebar_color;
            data.button_color = clientAdmin.dataValues.button_color;
            data.text_color = clientAdmin.dataValues.text_color;
            data.top_nav_color = clientAdmin.dataValues.top_nav_color;
            data.db_name = req.user.db_name;

            if (role_id == 2 || role_id == 3) {
                data.doc_verification = 2;
                data.isCHANNEL = 1
                channelEnabled = true
            }
            else if (role_id == 10) {
                data.doc_verification = 0;
                data.isDMS = 1
                dmsEnabled = true
            }
            else if (role_id == 1) {
                data.doc_verification = 0;
                data.isCHANNEL = 1
                channelEnabled = true
            } else {
                data.doc_verification = 2;
            }


            // createing db users and common db users
            userData = await db.clients.create(data, {
                transaction: DBprocess,
            });

            let dbUserData = await req.config.users.create(data, {
                transaction: processClient,
            });

            // create platform permission
            let userPTdata = {
                CRM: crmEnabled,
                DMS: dmsEnabled,
                SALES: salesEnabled,
                CHANNEL: channelEnabled,
                MEDIA: mediaEnabled,
            };

            // update client permission at client side
            const Userentries = Object.entries(userPTdata);
            for (const [index, [key, value]] of Userentries.entries()) {
                await req.config.userPlatform.create(
                    {
                        actions: value,
                        platform_id: index + 1,
                        user_id: dbUserData?.user_id || dbUserData?.dataValues?.user_id,
                    },
                    { transaction: processClient }
                );
            }

            // Only include fields that belong to userProfile model
            let profileData = {
                user_id: dbUserData.user_id,
            };
            
            // Only add profile-specific fields if they exist in data
            const profileFields = ['div_id', 'dep_id', 'des_id', 'aadhar_no', 'aadhar_file', 
                'pan_no', 'pan_file', 'dl_no', 'dl_file', 'rera_no', 'rera_file', 
                'c_cheque', 'c_cheque_file', 'user_image_file', 'bank_name', 
                'account_holder_name', 'account_no', 'bank_ifsc_code', 'branch',
                'contact_person', 'credit_limit', 'incorporation_certificate', 
                'payment_method', 'distributor_rating', 'address_proof', 
                'gst_registration', 'banking_details'];
            
            profileFields.forEach(field => {
                if (data[field] !== undefined && data[field] !== null) {
                    profileData[field] = data[field];
                }
            });

            let userProfileData = await req.config.usersProfiles.create(profileData, {
                transaction: processClient,
            });

            let option = {};

            if (role_id == 10) {

                let registrationToken = jwt.sign(
                    { id: dbUserData.user_id, db_name: req.user.db_name },
                    process.env.CLIENT_SECRET,
                    {
                        expiresIn: process.env.CP_SIGNUP_EXPIRES,
                    }
                );
                // const htmlTemplatePath = path.join(
                //     __dirname,
                //     "..",
                //     "mail",
                //     "dms",
                //     "signup.html"
                // );

                // const htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");

                const htmlTemplate = await req.config.emailTemplates.findOne({ where: { template_id: 10 } }) // Distributor Creation Template
                const template = htmlTemplate.template

                const signupLink = `${req.admin.client_url}/dms/DistributorOnboardingProcess?token=${registrationToken}`;
                let company_name
                let company = await req.config.organisationInfo.findOne({
                    attributes: ['company_name']
                })
                if (company) {
                    company_name = company.company_name || 'Srijan Bandhan'
                }
                else {
                    company_name = 'Srijan Bandhan'
                }
                let htmlContent = template.replace(/{{signupLink}}/g, signupLink).replace(/{{UsersName}}/g, `${req.body.user + (" " + req.body.user_l_name || null)}`).replace(/{{CompanyName}}/g, company_name);
                option = {
                    email: email,
                    subject: company_name,
                    message: htmlContent,
                };
            }
            else if (role_id == 1) {

                let registrationToken = jwt.sign(
                    { id: dbUserData.user_id, db_name: req.user.db_name },
                    process.env.CLIENT_SECRET,
                    {
                        expiresIn: process.env.CP_SIGNUP_EXPIRES,
                    }
                );

                // const htmlTemplatePath = path.join(
                //     __dirname,
                //     "..",
                //     "mail",
                //     "cp",
                //     "signup.html"
                // );

                // const htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");

                const emailTemplate = await req.config.emailTemplates.findOne({ where: { template_id: 8 } })  // Channel Partner Reg Link Template
                let htmlTemplate = emailTemplate.template

                let BdData = {
                    user: "",
                    user_l_name: "",
                    contact_number: "",
                    email: ""
                };
                if (req.body.report_to) {
                    BdData = await req.config.users.findOne({
                        where: { user_id: req.body.report_to },
                        attributes: ['user', 'user_l_name', 'email', 'contact_number'],
                    })
                }

                const signupLink = `${req.admin.client_url}/partner/Signup?token=${registrationToken}`;

                let company_name
                let company = await req.config.organisationInfo.findOne({
                    attributes: ['company_name']
                })
                if (company) {
                    company_name = company.company_name || 'Srijan Bandhan'
                }
                else {
                    company_name = 'Srijan Bandhan'
                }

                const htmlContent = htmlTemplate
                    .replace(/{{signupLink}}/g, signupLink)
                    .replace(/{{UserName}}/g, userData.user ? userData.user : "Partner")
                    .replace(/{{CompanyName}}/g, company_name)
                    .replace(/{{BDName}}/g, `${BdData.user ?? ""} ${BdData.user_l_name ?? ""}`)
                    .replace(/{{PhoneNo}}/g, BdData.contact_number ?? "")
                    .replace(/{{EmailID}}/g, BdData.email ?? "")

                option = {
                    email: email,
                    subject: "Srijan Bandhan",
                    message: htmlContent,
                };

                // Update CP lead stage to "LINK SENT" when registration link is sent
                try {
                    // Find CP lead by email or contact
                    const cpLead = await req.config.channelPartnerLeads.findOne({
                        where: {
                            [Op.or]: [
                                { email: email },
                                { contact: req.body.contact_number || req.body.contact }
                            ]
                        }
                    });

                    if (cpLead) {
                        // Update stage to "LINK SENT"
                        await cpLead.update({ stage: 'LINK SENT' });
                        
                        // Also insert a new entry into db_channel_partner_lead_details
                        const now = new Date();
                        const updatedAt = now.toISOString().slice(0, 19).replace('T', ' ');
                        await req.config.channelPartnerLeadsDetails.create({
                            cpl_id: cpLead.cpl_id,
                            stage: 'LINK SENT',
                            follow_up_date: null,
                            remarks: 'Registration link sent to CP',
                            status: true,
                            createdAt: updatedAt,
                            updatedAt: updatedAt
                        }).catch(err => {
                            console.error('Error creating CP lead details:', err);
                        });
                    }
                } catch (leadUpdateError) {
                    // Don't fail the request if lead update fails
                    console.error('Error updating CP lead stage:', leadUpdateError);
                }
            }
            else {
                const resetToken = crypto.randomBytes(32).toString("hex");
                data.password_reset_token = crypto
                    .createHash("sha256")
                    .update(resetToken)
                    .digest("hex");

                const resetLink = `${req.admin.client_url}/ChangePassword?tkn=u$34${data.password_reset_token}`;

                // const htmlTemplatePath = path.join(
                //     __dirname,
                //     "..",
                //     "mail",
                //     "cp",
                //     "resetPassword.html"
                // );
                // const htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");

                const emailTemplate = await req.config.emailTemplates.findOne({ where: { template_id: 28 } })  // Password Reset Template
                let htmlTemplate = emailTemplate.template

                let company_name
                let company = await req.config.organisationInfo.findOne({
                    attributes: ['company_name']
                })
                if (company) {
                    company_name = company.company_name || 'Srijan Bandhan'
                }
                else {
                    company_name = 'Srijan Bandhan'
                }

                let htmlContent = htmlTemplate.replace(/{{resetLink}}/g, resetLink).replace(/{{CompanyName}}/g, company_name).replace(/{{UsersName}}/, dbUserData.user ? dbUserData.user : "User");

                option = {
                    email: email,
                    subject: "Password Reset Link",
                    message: htmlContent,
                };

                let userUpdate = await db.clients.findByPk(userData.dataValues.user_id);
                // await userUpdate.update({
                //   password_reset_token: data.password_reset_token,
                //   password_reset_expires: moment(new Date()).add(1, "d").toDate(),

                // })

                userData = await userData.update({
                    password_reset_token: data.password_reset_token,
                    password_reset_expires: moment(new Date()).add(1, "d").toDate(),
                }, {
                    transaction: DBprocess,
                });
            }
            await sendEmail(option);

            await processClient.commit();
            await DBprocess.commit();

            let send = {
                dbUserData,
                userProfileData,
            };
            return await responseSuccess(req, res, "user created successfully", send);
        }
    } catch (error) {
        logErrorToFile(error)
        await processClient.rollback();
        await DBprocess.rollback();
        await processClient.cleanup();
        await DBprocess.cleanup();
        console.log(error);
        return await responseError(req, res, "Something Went Wrong");
    }
};

exports.uploadsUserImages = async (req, res) => {
    try {
        let { path } = req.body;
        let updateData = req.body;
        const data = await fileUpload.imageExport(req, res, path);
        if (!data.message) {
            if (path === "adh") {
                updateData.aadhar_file = data;
            } else if (path === "pan") {
                updateData.pan_file = data;
            } else if (path === "dl") {
                updateData.dl_file = data;
            } else if (path === "lsUser") {
                updateData.user_image_file = data;
            } else if (path === "cheque") {
                updateData.c_cheque_file = data;
            } else if (path === "rera") {
                updateData.rera_file = data;
            }

            let see = await req.config.usersProfiles.update(updateData, {
                where: {
                    user_id: updateData.user_id,
                },
            });
            return await responseSuccess(
                req,
                res,
                "document uploaded successfully",
                see
            );
        } else {
            return await responseError(req, res, "Something Went Wrong");
        }
    } catch (error) {
        logErrorToFile(error)
        return await responseError(req, res, "Something Went Wrong");
    }
};

exports.getAllUserByRole = async (req, res) => {
    try {
        const AlluserRoleWiseCount = await req.config.sequelize.query(
            `SELECT db_users.role_id, db_roles.role_name,COUNT(*) as 'count' from db_roles INNER JOIN db_users ON db_users.role_id = db_roles.role_id WHERE db_users.deletedAt is null GROUP by db_users.role_id`,
            {
                type: QueryTypes.SELECT,
            }
        );
        return await responseSuccess(
            req,
            res,
            "Role wise count",
            AlluserRoleWiseCount
        );
    } catch (error) {
        logErrorToFile(error)
        return await responseError(req, res, "Something Went Wrong");
    }
};

// exports.getUsersByRoleID = async (req, res) => {
//     try {
//         let whereClause = {};
//         if (req.query.f_date) {
//             whereClause.createdAt = {
//                 [Op.gte]: req.query.f_date, // Greater than or equal to current date at midnight
//                 [Op.lt]: req.query.t_date// Less than current date + 1 day at midnight
//             }

//         } else {
//             let weekStartDate = getCurrentWeekStartDate();
//             let weekEndDate = getCurrentWeekEndDate();
//             whereClause.createdAt = {
//                 [Op.gte]: weekStartDate, // Greater than or equal to current date at midnight
//                 [Op.lt]: weekEndDate// Less than current date + 1 day at midnight
//             }
//         }

//         if (req.user.role_id == 2 || req.user.role_id == 3) {
//             whereClause.report_to = req.user.user_id
//         }

//         if (req.query.role_id == 1 && req.user.role_id == 3) {
//             const bstUser = await req.config.users.findAll({
//                 where: { report_to: req.user.user_id, role_id: 2 },
//                 attributes: ['user_id']
//             });

//             const bstUserIds = bstUser.map(user => user.user_id);

//             if (bstUserIds.length > 0) {
//                 whereClause.report_to = {
//                     [Op.in]: bstUserIds
//                 };
//             } else {
//                 whereClause.report_to = [];
//             }
//         }

//         let roleId = req.query.role_id;

//         // Adjust the where clause for admin or role-specific users
//         let userWhereClause = { doc_verification: 2 };
//         if (req.query.role_id == 1) {
//             userWhereClause.role_id = roleId;
//         } else if (req.query.role_id == 2) {
//             // Admin: fetch managers (role_id=2) and their assigned users (role_id=1)
//             userWhereClause.role_id = { [Op.in]: [1, 2] };
//         } else if (req.query.role_id == 3) {
//             userWhereClause.role_id = { [Op.in]: [1, 2, 3] };
//         }

//         let userData = await req.config.users.findAll({
//             where: {
//                 ...whereClause,
//                 ...userWhereClause
//             },
//             attributes: [
//                 "user_id", "user", "user_code", "createdAt", "report_to", "organisation", "user_l_name", "email", "contact_number", "organisation", "db_name", "isDB", "user_status", "doc_verification", "reject_reason", "role_id", "address", "pincode", "cpt_id",
//                 [req.config.sequelize.fn('COUNT', req.config.sequelize.fn('DISTINCT', req.config.sequelize.col('db_leads.lead_id'))), 'lead_count'],
//                 [req.config.sequelize.fn('COUNT', req.config.sequelize.fn('DISTINCT', req.config.sequelize.col('db_leads->visitList.visit_id'))), 'visit_count'],
//                 [req.config.sequelize.fn('COUNT', req.config.sequelize.fn('DISTINCT', req.config.sequelize.col('db_leads->BookingLeadList.booking_id'))), 'booking_count']
//             ],
//             include: [
//                 {
//                     model: req.config.users,
//                     as: 'reportToUser', // Manager data
//                     attributes: ['user_id', 'user'],
//                 },
//                 {
//                     model: req.config.usersProfiles,
//                     include: [
//                         {
//                             model: req.config.departments,
//                             attributes: {
//                                 exclude: ["createdAt", "updatedAt", "deletedAt"],
//                             },
//                         },
//                         {
//                             model: req.config.designations,
//                             attributes: {
//                                 exclude: ["createdAt", "updatedAt", "deletedAt"],
//                             },
//                         },
//                     ],
//                 },
//                 {
//                     model: req.config.leads,
//                     attributes: [],
//                     include: [
//                         { model: req.config.leadVisit, as: 'visitList', attributes: [] },
//                         { model: req.config.leadBooking, as: 'BookingLeadList', attributes: [] },
//                     ],
//                 },
//             ],
//             group: ['report_to', 'user_id'], // Group users by manager (`report_to`)
//             order: [["report_to", "ASC"], ["user_id", "DESC"]],
//         });

//         const result = await req.config.channelPartnerLeads.findAll({
//             attributes: [
//                 'asssigned_to',
//                 [req.config.sequelize.fn('COUNT', req.config.sequelize.col('cpl_id')), 'cp_lead_count']
//             ],
//             group: ['asssigned_to'],
//             order: [["asssigned_to", "DESC"]],
//             raw: true,
//         });

//         const resultMap = new Map(result.map(({ asssigned_to, cp_lead_count }) => [asssigned_to, cp_lead_count]));

//         userData = userData.map((user) => {
//             const cp_lead_count = resultMap.get(user.user_id) || 0;
//             return { ...user.dataValues, cp_lead_count };
//         });

//         // if (roleId == "3") { // Director
//         //     // Get all directors
//         //     const directors = userData
//         //         .filter(user => user.dataValues.role_id === 3)
//         //         .map(director => director.get({ plain: true })); // Convert to plain object

//         //     // Extract all director user IDs
//         //     const directorUserIds = directors.map(director => director.user_id);

//         //     // Fetch all managers reporting to these directors from the database
//         //     const assignedManagers = await req.config.users.findAll({
//         //         where: {
//         //             report_to: { [Op.in]: directorUserIds },
//         //             role_id: 2, // Ensure only managers are fetched
//         //         },
//         //         attributes: ['user_id', 'user', 'user_l_name', 'report_to']
//         //     });

//         //     const plainAssignedManagers = assignedManagers.map(manager => manager.get({ plain: true }));

//         //     // Process director data
//         //     const directorData = directors.map(director => {
//         //         // Filter managers reporting to the current director
//         //         const managersForDirector = plainAssignedManagers.filter(manager => manager.report_to === director.user_id);
//         //         console.log({ managersForDirector })
//         //         // Process each manager to fetch their assigned users
//         //         const managersWithUsers = managersForDirector.map(manager => {
//         //             const assignedUsers = userData
//         //                 .filter(user => ((user?.dataValues?.report_to == manager?.user_id) || (user?.report_to == manager?.user_id)) )
//         //                 .map(user => user.get({ plain: true })); // Convert to plain object
//         //             console.log({ assignedUsers, userData })

//         //             return {
//         //                 ...manager,
//         //                 assigned_users: assignedUsers,
//         //                 lead_count: assignedUsers.length,
//         //                 visit_count: assignedUsers.reduce((sum, user) => sum + Number(user.visit_count || 0), 0),
//         //                 booking_count: assignedUsers.reduce((sum, user) => sum + Number(user.booking_count || 0), 0),
//         //             };
//         //         });

//         //         return {
//         //             ...director,
//         //             assigned_managers: managersWithUsers,
//         //             lead_count: managersWithUsers.reduce((sum, manager) => sum + manager.lead_count, 0),
//         //             visit_count: managersWithUsers.reduce((sum, manager) => sum + manager.visit_count, 0),
//         //             booking_count: managersWithUsers.reduce((sum, manager) => sum + manager.booking_count, 0),
//         //         };
//         //     });

//         //     return await responseSuccess(req, res, "Director-wise Data", directorData);
//         // }
//         // else if (roleId == "2") { // Manager
//         //     const managers = userData
//         //         .filter(user => (user?.dataValues?.role_id === 2) || (user?.role_id === 2))
//         //         .map(manager => manager.get({ plain: true })); // Convert to plain object

//         //     const managerData = managers.map(manager => {
//         //         const assignedUsers = userData
//         //             .filter(user => user.dataValues.report_to === manager.user_id)
//         //             .map(user => user.get({ plain: true })); // Convert to plain object

//         //         return {
//         //             ...manager,
//         //             assigned_users: assignedUsers,
//         //             lead_count: assignedUsers.length,
//         //             visit_count: assignedUsers.reduce((sum, user) => sum + Number(user.visit_count || 0), 0),
//         //             booking_count: assignedUsers.reduce((sum, user) => sum + Number(user.booking_count || 0), 0),
//         //         };
//         //     });

//         //     return await responseSuccess(req, res, "Manager-wise Data", managerData);
//         // }

//         // Return user data for other roles or admin
//         return await responseSuccess(req, res, "Role-wise Data", userData);
//     } catch (error) {
//         logErrorToFile(error);
//         console.log("error", error);
//         return await responseError(req, res, "Something Went Wrong");
//     }
// };

// exports.getUsersByRoleID = async (req, res) => {
//     try {
//         let whereClause = {}
//         if (req.query.f_date) {
//             whereClause.createdAt = {
//                 [Op.gte]: req.query.f_date, // Greater than or equal to current date at midnight
//                 [Op.lt]: req.query.t_date// Less than current date + 1 day at midnight
//             }

//         } else {
//             let weekStartDate = getCurrentWeekStartDate();
//             let weekEndDate = getCurrentWeekEndDate();
//             whereClause.createdAt = {
//                 [Op.gte]: weekStartDate, // Greater than or equal to current date at midnight
//                 [Op.lt]: weekEndDate// Less than current date + 1 day at midnight
//             }
//         }

//         if (req.user.role_id == 2 || req.user.role_id == 3) {
//             whereClause.report_to = req.user.user_id
//         }

//         if (req.query.role_id == 1 && req.user.role_id == 3) {
//             const bstUser = await req.config.users.findAll({
//                 where: { report_to: req.user.user_id, role_id: 2 },
//                 attributes: ['user_id']
//             });

//             const bstUserIds = bstUser.map(user => user.user_id);

//             if (bstUserIds.length > 0) {
//                 whereClause.report_to = {
//                     [Op.in]: bstUserIds
//                 };
//             } else {
//                 whereClause.report_to = [];
//             }
//         }

//         let userData = await req.config.users.findAll({
//             where: {
//                 ...whereClause,
//                 role_id: req.query.role_id,
//                 doc_verification: 2,
//             },
//             attributes: ["user_id", "user", "user_code", "createdAt", "report_to", "organisation", "user_l_name", "email", "contact_number", "organisation", "db_name", "isDB", "user_status", "doc_verification", "reject_reason", "role_id", "address", "pincode", "cpt_id",
//                 [req.config.sequelize.fn('count', req.config.sequelize.col('db_leads.lead_id')), 'lead_count'],
//                 [req.config.sequelize.fn('count', req.config.sequelize.col('db_leads->visitList.visit_id')), 'visit_count'],
//                 [req.config.sequelize.fn('count', req.config.sequelize.col('db_leads->BookingLeadList.booking_id')), 'booking_count'],

//             ],
//             include: [
//                 {
//                     model: req.config.usersProfiles,
//                     include: [
//                         {
//                             model: req.config.divisions,
//                             attributes: {
//                                 exclude: ["createdAt", "updatedAt", "deletedAt"],
//                             },
//                         },
//                         {
//                             model: req.config.departments,
//                             attributes: {
//                                 exclude: ["createdAt", "updatedAt", "deletedAt"],
//                             },
//                         },
//                         {
//                             model: req.config.designations,
//                             attributes: {
//                                 exclude: ["createdAt", "updatedAt", "deletedAt"],
//                             },
//                         },
//                     ],
//                 },
//                 {
//                     model: req.config.user_role,
//                     attributes: {
//                         exclude: ["createdAt", "updatedAt", "deletedAt"],
//                     },
//                 },
//                 {
//                     model: req.config.country,
//                     attributes: {
//                         exclude: ["createdAt", "updatedAt", "deletedAt"],
//                     },
//                 },
//                 {
//                     model: req.config.states,
//                     attributes: {
//                         exclude: ["createdAt", "updatedAt", "deletedAt"],
//                     },
//                 },
//                 {
//                     model: req.config.city,
//                     attributes: {
//                         exclude: ["createdAt", "updatedAt", "deletedAt"],
//                     },
//                 },
//                 {
//                     model: req.config.users,
//                     as: 'reportToUser',
//                     attributes: ['user_id', 'user']
//                 },
//                 {
//                     model: req.config.leads,
//                     attributes: ['lead_id', 'lead_name'],

//                     include: [
//                         {
//                             model: req.config.leadVisit,
//                             as: 'visitList',
//                             attributes: ["visit_id",],

//                         },
//                         {
//                             model: req.config.leadBooking,
//                             as: 'BookingLeadList',
//                             attributes: ["booking_id",],

//                         },
//                     ],
//                     group: ['leadAssignedBy.lead_id'],
//                 },
//             ],
//             group: ['user_id'],
//             order: [["user_id", "DESC"]],
//         });

//         return await responseSuccess(req, res, "Role wise Data", userData);
//     } catch (error) {
//         logErrorToFile(error)
//         console.log("error", error)
//         return await responseError(req, res, "Something Went Wrong");
//     }
// };

exports.getUsersByRoleID = async (req, res) => {
    try {
        let whereClause = {}
        if (req.query.f_date) {
            let startDate = new Date(req.query.f_date); // Start Date (00:00:00)
            let endDate = new Date(req.query.t_date);   // End Date (00:00:00 by default)
            endDate.setDate(endDate.getDate() + 1);

            whereClause[Op.or] = [
                {
                    createdAt: {
                        [Op.gte]: startDate,
                        [Op.lt]: endDate  // Use [Op.lt] since endDate is already +1 day
                    }
                },
                {
                    onboarding_date: {
                        [Op.gte]: startDate,
                        [Op.lt]: endDate  // Use [Op.lt] since endDate is already +1 day
                    }
                }
            ];

            // whereClause.createdAt = {
            //     [Op.gte]: startDate,  // Start from f_date 00:00:00
            //     [Op.lte]: endDate      // Less than (but not including) next day's 00:00:00
            // };
            // whereClause.onboarding_date = {
            //     [Op.gte]: startDate,  // Start from f_date 00:00:00
            //     [Op.lte]: endDate      // Less than (but not including) next day's 00:00:00
            // };
        }
        else if (req.query.role_id != 1) {
            // Only apply default week filtering for non-CP users
            // For CP users (role_id = 1), show all onboarded CPs regardless of creation/onboarding date
            // This ensures onboarded CPs are visible even if they were created weeks/months ago
            
            // Get week dates as Date objects for proper datetime comparison
            let weekStartDateStr = getCurrentWeekStartDate();
            let weekEndDateStr = getCurrentWeekEndDate();
            
            // Convert to Date objects and set proper times
            let weekStartDate = new Date(weekStartDateStr); // Start of week at 00:00:00
            let weekEndDate = new Date(weekEndDateStr);     // End of week date
            weekEndDate.setDate(weekEndDate.getDate() + 1); // Add 1 day to include full end day
            weekEndDate.setHours(0, 0, 0, 0); // Set to start of next day for [Op.lt] comparison
            
            whereClause[Op.or] = [
                {
                    createdAt: {
                        [Op.gte]: weekStartDate,
                        [Op.lt]: weekEndDate  // Use [Op.lt] (less than) to include full end day
                    }
                },
                {
                    onboarding_date: {
                        [Op.gte]: weekStartDate,
                        [Op.lt]: weekEndDate  // Use [Op.lt] (less than) to include full end day
                    }
                }
            ];
        }
        // If role_id = 1 (CP users) and no date filters, don't apply any date filtering
        // This ensures all onboarded CPs are visible regardless of when they were created or onboarded

        // BST users: Only see CP users assigned to them (report_to = BST user_id)
        if (req.user.role_id == 2 && Number(req.query.role_id) !== 1) {
            whereClause.report_to = req.user.user_id
        }

        // Director: See only CP users that report to BST users assigned to this Director
        if (req.query.role_id == 1 && req.user.role_id == 3) {
            // Find all BST users that report to this Director
            const bstUsers = await req.config.users.findAll({
                where: { 
                    report_to: req.user.user_id, 
                    role_id: 2,
                    user_status: true,
                    deletedAt: null
                },
                attributes: ['user_id']
            });

            const bstUserIds = bstUsers.map(user => user.user_id);

            if (bstUserIds.length > 0) {
                // Show CP users that report to BST users under Director
                whereClause.report_to = {
                    [Op.in]: bstUserIds
                };
            } else {
                // If no BST users under Director, show empty list
                whereClause.user_id = -1; // Impossible condition - returns empty list
            }
        } else if (req.user.role_id == 3) {
            // For Directors viewing other roles, filter by direct reports
            whereClause.report_to = req.user.user_id;
        }

        let userData = await req.config.users.findAll({
            where: {
                ...whereClause,
                role_id: req.query.role_id,
                doc_verification: 2,
            },
            attributes: ["user_id", "user", "user_code", "createdAt", "report_to", "organisation", "user_l_name", "email", "contact_number", "organisation", "db_name", "isDB", "user_status", "doc_verification", "reject_reason", "role_id", "address", "pincode", "cpt_id", "cp_category", "onboarding_date", "city_id", "state_id", "country_id",
                // [req.config.sequelize.literal(`CASE 
                //     WHEN "onboarding_date" IS NOT NULL THEN "onboarding_date"
                //     ELSE "createdAt"
                // END`), 'sortingDate'],
                [req.config.sequelize.literal(`(SELECT COUNT(DISTINCT l.lead_id) FROM db_leads l WHERE l.assigned_lead = db_user.user_id AND l.deletedAt IS NULL)`), 'lead_count'],
                [req.config.sequelize.literal(`(SELECT COUNT(DISTINCT lv.visit_id) FROM db_lead_visits lv INNER JOIN db_leads l ON lv.lead_id = l.lead_id WHERE l.assigned_lead = db_user.user_id AND lv.deletedAt IS NULL AND l.deletedAt IS NULL)`), 'visit_count'],
                [req.config.sequelize.literal(`(SELECT COUNT(DISTINCT lb.booking_id) FROM db_lead_bookings lb INNER JOIN db_leads l ON lb.lead_id = l.lead_id WHERE l.assigned_lead = db_user.user_id AND lb.deletedAt IS NULL AND l.deletedAt IS NULL)`), 'booking_count'],
            ],
            include: [
                {
                    model: req.config.usersProfiles,
                    include: [
                        {
                            model: req.config.divisions,
                            attributes: {
                                exclude: ["createdAt", "updatedAt", "deletedAt"],
                            },
                        },
                        {
                            model: req.config.departments,
                            attributes: {
                                exclude: ["createdAt", "updatedAt", "deletedAt"],
                            },
                        },
                        {
                            model: req.config.designations,
                            attributes: {
                                exclude: ["createdAt", "updatedAt", "deletedAt"],
                            },
                        },
                    ],
                },
                {
                    model: req.config.user_role,
                    attributes: {
                        exclude: ["createdAt", "updatedAt", "deletedAt"],
                    },
                },
                {
                    model: req.config.channelPartnerType,
                    attributes: {
                        exclude: ["createdAt", "updatedAt", "deletedAt"],
                    },
                },
                {
                    model: req.config.country,
                    attributes: {
                        exclude: ["createdAt", "updatedAt", "deletedAt"],
                    },
                },
                {
                    model: req.config.states,
                    attributes: {
                        exclude: ["createdAt", "updatedAt", "deletedAt"],
                    },
                },
                {
                    model: req.config.city,
                    attributes: {
                        exclude: ["createdAt", "updatedAt", "deletedAt"],
                    },
                },
                {
                    model: req.config.users,
                    as: 'reportToUser',
                    attributes: ['user_id', 'user']
                },
            ],
            // No GROUP BY needed since counts are calculated via subqueries in attributes
            order: [["onboarding_date", "DESC"], ["createdAt", "DESC"]],
        });

        const result = await req.config.channelPartnerLeads.findAll({
            attributes: [
                'asssigned_to',
                [req.config.sequelize.fn('COUNT', req.config.sequelize.col('cpl_id')), 'cp_lead_count']
            ],
            group: ['asssigned_to'],
            order: [["asssigned_to", "DESC"]],
            raw: true,
        });

        const resultMap = new Map(result.map(({ asssigned_to, cp_lead_count }) => [asssigned_to, cp_lead_count]));

        userData = userData.map((user) => {
            const cp_lead_count = resultMap.get(user.user_id) || 0;
            const sortingDate = user.dataValues.onboarding_date || user.dataValues.createdAt
            return { ...user.dataValues, cp_lead_count, sortingDate };
        });

        // For CP role-wise list, include project assignments.
        if (Number(req.query.role_id) === 1 && userData.length) {
            const cpUserIds = userData.map((u) => Number(u.user_id)).filter((id) => Number.isInteger(id) && id > 0);

            if (cpUserIds.length) {
                const projectMap = new Map();
                if (req.user.role_id == 2) {
                    const bstProjectMap = await getBstCpProjectMap(req.config, req.user.user_id, cpUserIds);
                    bstProjectMap.forEach((value, key) => projectMap.set(key, value));
                    userData = userData.filter((u) => (projectMap.get(Number(u.user_id)) || []).length > 0);
                } else {
                    const assignedRows = await req.config.sequelize.query(
                        `
                            SELECT
                                cp.user_id AS cp_user_id,
                                p.project_id,
                                p.project,
                                p.state_id,
                                p.city_id,
                                p.zone
                            FROM db_users cp
                            LEFT JOIN db_channel_partner_leads l
                                ON l.deletedAt IS NULL
                                AND (
                                    (cp.email IS NOT NULL AND cp.email <> '' AND l.email = cp.email)
                                    OR (
                                        cp.contact_number IS NOT NULL
                                        AND l.contact IS NOT NULL
                                        AND RIGHT(CAST(l.contact AS CHAR), 10) = RIGHT(CAST(cp.contact_number AS CHAR), 10)
                                    )
                                )
                            LEFT JOIN cp_lead_projects clp
                                ON clp.cpl_id = l.cpl_id
                                AND clp.deletedAt IS NULL
                            LEFT JOIN db_channel_projects p
                                ON p.project_id = clp.project_id
                                AND p.deletedAt IS NULL
                            WHERE cp.user_id IN (:cp_user_ids)
                            ORDER BY cp.user_id DESC, p.project ASC
                        `,
                        {
                            replacements: { cp_user_ids: cpUserIds },
                            type: QueryTypes.SELECT,
                        }
                    );

                    assignedRows.forEach((row) => {
                        const key = Number(row.cp_user_id);
                        if (!projectMap.has(key)) projectMap.set(key, []);
                        if (row.project_id) {
                            const list = projectMap.get(key);
                            if (!list.some((p) => Number(p.project_id) === Number(row.project_id))) {
                                list.push({
                                    project_id: row.project_id,
                                    project: row.project,
                                    state_id: row.state_id,
                                    city_id: row.city_id,
                                    zone: row.zone,
                                });
                            }
                        }
                    });
                }

                userData = userData.map((u) => ({
                    ...u,
                    assigned_projects: projectMap.get(Number(u.user_id)) || [],
                }));
            }
        }

        userData.sort((a, b) => new Date(b.sortingDate) - new Date(a.sortingDate));
        return await responseSuccess(req, res, "Role wise Data", userData);
    } catch (error) {
        logErrorToFile(error)
        console.log("error", error)
        return await responseError(req, res, "Something Went Wrong");
    }
};

exports.deleteUserByID = async (req, res) => {
    try {
        const userIds = req.body.user_ids;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return responseError(req, res, "Users not Selected");
        }

        const usersToDelete = await req.config.users.findAll({
            where: {
                user_id: {
                    [Op.in]: userIds,
                },
            },
        });

        if (usersToDelete.length === 0) {
            return responseError(req, res, "No users found with the specified IDs");
        }

        await Promise.all(usersToDelete.map((user) => user.destroy()));

        return responseSuccess(req, res, "Users deleted successfully");
    } catch (error) {
        logErrorToFile(error);
        console.error("Error:", error);
        return responseError(req, res, "Something Went Wrong");
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        let userData = [];

        // Role-based assignment view for CP/BST as requested.
        if (!req.query.id && !req.user.isDB && req.user.role_id === 1) {
            const cpView = await getCpAssignedProjectsView(req.config, req.user);
            return await responseSuccess(req, res, "CP assigned projects", cpView);
        }

        if (!req.query.id && !req.user.isDB && req.user.role_id === 2) {
            const bstView = await getBstAssignedChannelPartnersView(req.config, req.user);
            return await responseSuccess(req, res, "BST assigned channel partners with projects", bstView);
        }

        // for specific user detail
        if (req.query.id) {
            userData = await req.config.users.findOne({
                where: {
                    user_code: req.query.id,

                },
                attributes: {
                    exclude: [
                        "password",
                        "password_reset_token",
                        "password_reset_expires",
                        "deletedAt",
                    ],
                },
                include: [
                    {
                        model: req.config.usersProfiles,
                        include: [
                            {
                                model: req.config.divisions,
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                            {
                                model: req.config.departments,
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                            {
                                model: req.config.designations,
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                        ],
                    },
                    {
                        model: req.config.user_role,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.country,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.states,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.city,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.userFieldModel,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.users,
                        as: 'reportToUser',
                        attributes: ['user_id', 'user']
                    },
                    {
                        model: req.config.userPlatform,
                        required: false
                    }
                ],
            });

            // check if user has master role permission

            let RolePermissionData = await req.config.sequelize.query(
                `SELECT m1.menu_id,
               m1.menu_name,
               m1.parent_id,
               m1.menu_order,
               m1.is_active,
               m1.link,
               r1.permission_id,
               r1.role_id,
               m1.is_task,
               m1.icon_path,
               IFNULL(r1.actions, 0) as "actions"
           FROM
               db_menus AS m1
               LEFT JOIN db_role_permissions AS r1 ON m1.menu_id = r1.menu_id AND r1.role_id = ${req.user.role_id} where m1.is_active = true`,
                {
                    type: QueryTypes.SELECT,
                }
            );

            AllData = RolePermissionData;

            const rootNodes = AllData.filter((item) => item.menu_id == 173);
            let dashNavArr = [];
            const tree = rootNodes.map((rootNode) => {
                if (req.user.isDB && rootNode.is_active == 1) {
                    dashNavArr.push(rootNode);
                } else {
                    if (rootNode.actions == 1) {
                        dashNavArr.push(rootNode);
                    }
                }
                if (dashNavArr.length > 0) {
                    return dashNavArr;
                } else {
                    dashNavArr.concat(
                        buildTree(req.user.isDB, rootNode.menu_id, dashNavArr)
                    );
                }
            });

            dashNavArr.length > 0
                ? (userData.dataValues.hasMaster = true)
                : (userData.dataValues.hasMaster = false);
        } else {
            // if mode == ul and login by admin then all user will shown except the admin
            let whereCaluse = { doc_verification: 2 };
            if (req.query.mode && req.query.mode == "ul") {
                whereCaluse = {
                    isDB: false,
                    doc_verification: 2,
                };
            }

            // BST users: Only see users assigned to them (report_to = BST user_id)
            if (!req.user.isDB && req.user.role_id == 2) {
                whereCaluse = {
                    doc_verification: 2,
                    isDB: false,
                    [Op.or]: [
                        { user_id: req.user.user_id },
                        { report_to: req.user.user_id },
                    ],
                };
            }
            
            // Director: See only CP users that report to BST users assigned to this Director
            if (!req.user.isDB && req.user.role_id == 3) {
                // Get all BST users reporting to Director
                const bstUsers = await req.config.users.findAll({
                    where: { 
                        report_to: req.user.user_id, 
                        role_id: 2,
                        user_status: true,
                        deletedAt: null
                    },
                    attributes: ['user_id']
                });

                const bstUserIds = bstUsers.map(user => user.user_id);

                if (bstUserIds.length > 0) {
                    // Show CP users (role_id = 1) that report to BST users under Director
                    whereCaluse = {
                        ...whereCaluse,
                        role_id: 1, // Only CP users
                        doc_verification: 2, // Only approved CPs
                        report_to: {
                            [Op.in]: bstUserIds
                        }
                    };
                } else {
                    // If no BST under Director, show empty list
                    whereCaluse = {
                        ...whereCaluse,
                        role_id: 1,
                        doc_verification: 2,
                        user_id: -1 // Impossible condition - returns empty list
                    };
                }
            }

            userData = await req.config.users.findAll({
                where: whereCaluse,
                attributes: {
                    exclude: [
                        "password",
                        "password_reset_token",
                        "password_reset_expires",
                        "deletedAt",
                    ],
                },
                include: [
                    {
                        model: req.config.usersProfiles,
                        include: [
                            {
                                model: req.config.divisions,
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                            {
                                model: req.config.departments,
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                            {
                                model: req.config.designations,
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                        ],
                    },
                    {
                        model: req.config.user_role,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.country,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.states,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.city,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.users,
                        as: 'reportToUser',
                        attributes: ['user_id', 'user']
                    },
                ],
                order: [["user_id", "DESC"]],
            });
        }

        return await responseSuccess(req, res, "All Users", userData);
    } catch (error) {
        logErrorToFile(error)
        console.log("err", error)
        return await responseError(req, res, "Something Went Wrong");
    }
};

// exports.updateUser = async (req, res) => {
//     try {
//         let dbUserData = req.body;
//         if (!dbUserData.report_to) {
//             dbUserData.report_to = null
//         }
//         let message = 'user data updated'
//         let data

//         // find user in admin
//         let userData = await db.clients.findOne({
//             where: {
//                 user_code: dbUserData.user_code,
//             },
//         });

//         // if user not found send error user not found
//         if (!userData) {
//             return res.status(400).json({ status: 400, message: "user not found" });
//         }

//         // if password then hash it
//         if (dbUserData.password) {
//             dbUserData.password = await bcrypt.hash(dbUserData.password, 10);
//         }


//         // find user the update its profile
//         let userDataInDB = await req.config.users.findOne({
//             where: {
//                 user_code: dbUserData.user_code,
//             },
//         });

//         if (dbUserData.report_to && userDataInDB.report_to != dbUserData.report_to) {
//             const user = await req.config.users.findOne({
//                 where: {
//                     user_id: dbUserData.report_to,
//                 },
//             });
//             if (user) {
//                 message = `The Channel Partner's request has been successfully Assigned to ${user.user} ${user.user_l_name || ''}`
//             } else {
//                 message = `The Channel Partner's request has been successfully.`
//             }
//         }

//         // update user
//         data = await userDataInDB.update(dbUserData);

//         await req.config.usersProfiles.update(dbUserData, {
//             where: {
//                 user_id: userDataInDB.user_id,
//             },
//         });

//         if (dbUserData.isAssigned == true) {
//             return res.status(200).json({ status: 200, message, data });
//         }

//         //Update user permissions

//         let userPTdata = {
//             CRM: dbUserData.isCRM || false,
//             DMS: dbUserData.isDMS || false,
//             SALES: dbUserData.isSALES || false,
//             CHANNEL: dbUserData.isCHANNEL || false,
//             MEDIA: dbUserData.isMEDIA || false,
//         };

//         const Userentries = Object.entries(userPTdata);
//         for (const [index, [key, value]] of Userentries.entries()) {
//             await req.config.userPlatform.update(
//                 {
//                     actions: value
//                 },
//                 {
//                     where: {
//                         user_id: userDataInDB.user_id,
//                         platform_id: index + 1,
//                     }
//                 }
//             );
//         }

//         // if accept onboarding user
//         if (userData.doc_verification !== dbUserData.doc_verification && dbUserData.doc_verification == 2) {

//             if (userData.bst_response || userData.director_response) {
//                 message = "You have already responded to this request.";
//             }
//             else {
//                 // Admin case (isDB)
//                 if (req.user.isDB) {
//                     dbUserData.bst_response = dbUserData.bst_approval = dbUserData.director_response = dbUserData.director_approval = true;
//                 }
//                 // BST role (role_id == 2)
//                 else if (req.user.role_id == 2) {
//                     dbUserData.bst_response = dbUserData.bst_approval = true;

//                     if (!userData.director_approval) {
//                         message = `The Channel Partner's request has been accepted by BST, waiting for Director's approval.`;
//                     } else {
//                         dbUserData.director_response = dbUserData.director_approval = true;
//                         message = `The Channel Partner's request has been successfully accepted by both BST and Director.`;
//                     }
//                 }
//                 // Director role (role_id == 3)
//                 else if (req.user.role_id == 3) {
//                     dbUserData.director_response = dbUserData.director_approval = dbUserData.bst_response = dbUserData.bst_approval = true;
//                     message = `The Channel Partner's request has been successfully accepted by both BST and Director.`;
//                 }
//                 const resetToken = crypto.randomBytes(32).toString("hex");
//                 let passwordResetToken = crypto
//                     .createHash("sha256")
//                     .update(resetToken)
//                     .digest("hex");

//                 await userData.update({
//                     password_reset_token: passwordResetToken,
//                     password_reset_expires: moment(new Date()).add(1, "d").toDate(),
//                 });

//                 await userData.save();

//                 const resetLink = `${req.admin.client_url}/partner/ResetViaMail?tkn=u$34${passwordResetToken}`;
//                 const htmlTemplatePath = path.join(
//                     __dirname,
//                     "..",
//                     "mail",
//                     "cp",
//                     "resetPassword.html"
//                 );

//                 let { company_name } = await req.config.organisationInfo.findOne({
//                     attributes: ['company_name']
//                 })
//                 company_name = company_name || "Srijan Bandhan"

//                 const htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");
//                 let htmlContent = htmlTemplate.replace(
//                     /{{resetLink}}/g,
//                     resetLink
//                 ).replace(
//                     /{{CompanyName}}/g,
//                     company_name
//                 ).replace(
//                     /{{UsersName}}/,
//                     userData.user
//                 );
//                 option = {
//                     email: userData.email,
//                     subject: "Srijan Bandhan",
//                     message: htmlContent,
//                 };

//                 await sendEmail(option);

//                 if (dbUserData?.isDMS) {
//                     message = `The Distributor's request has been successfully Accepted`
//                 }
//                 return res.status(200).json({ status: 200, message, data });
//             }
//         }

//         // if reject onboarding user
//         if (userData.doc_verification !== dbUserData.doc_verification && dbUserData.doc_verification == 3) {

//             if (dbUserData.bst_response || dbUserData.director_response) {
//                 message = "You have already responded to this request.";
//             }
//             else {
//                 // Admin case (isDB)
//                 if (req.user.isDB) {
//                     dbUserData.bst_response = dbUserData.director_response = dbUserData.director_approval = true;
//                     dbUserData.bst_approval = dbUserData.director_approval = false;
//                 }
//                 // BST role (role_id == 2)
//                 else if (req.user.role_id == 2) {
//                     dbUserData.bst_response = dbUserData.bst_approval = true;
//                     dbUserData.bst_approval = false;

//                     if (!userData.director_approval) {
//                         message = `The Channel Partner's request has been rejected by BST, waiting for Director's rejection.`;
//                     } else {
//                         dbUserData.director_response = dbUserData.director_approval = true;
//                         message = `The Channel Partner's request has been rejected by both BST and Director.`;
//                     }
//                 }
//                 // Director role (role_id == 3)
//                 else if (req.user.role_id == 3) {
//                     dbUserData.director_response = dbUserData.director_approval = true;
//                     dbUserData.bst_approval = false;
//                     message = `The Channel Partner's request has been rejected by both BST and Director.`;
//                 }

//                 const htmlTemplatePath = path.join(
//                     __dirname,
//                     "..",
//                     "mail",
//                     "cp",
//                     "reject.html"
//                 );

//                 let { company_name } = await req.config.organisationInfo.findOne({
//                     attributes: ['company_name']
//                 })
//                 company_name = company_name || "Srijan Bandhan"

//                 const htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");
//                 let htmlContent = htmlTemplate
//                     .replace(/{{reject_reason}}/g, dbUserData.reject_reason)
//                     .replace(/{{CompanyName}}/g, company_name)
//                     .replace(/{{UsersName}}/, userData.user);

//                 option = {
//                     email: userData.email,
//                     subject: "Srijan Bandhan",
//                     message: htmlContent,
//                 };

//                 await sendEmail(option);
//                 return res.status(200).json({ status: 200, message, data });
//             }
//         }

//         // close connection
//         // change user id according to admin db  and then update admin db

//         dbUserData.user_id = userData.user_id;
//         await db.clients.update(dbUserData, {
//             where: {
//                 user_code: dbUserData.user_code,
//             },
//         });

//         return res.status(200).json({ status: 200, message, data });
//     } catch (error) {
//         logErrorToFile(error)
//         console.log("error", error)

//         return res
//             .status(400)
//             .json({ status: 400, message: "Something Went Wrong" });
//     }
// };

exports.updateUser = async (req, res) => {
    try {
        let dbUserData = req.body;
        let message = 'User data updated';
        let data;

        // If forApproval key is present, handle only the approval/rejection logic
        if (dbUserData.forApproval) {
            // find user in admin
            let userData = await db.clients.findOne({
                where: {
                    user_code: dbUserData.user_code,
                },
            });

            if (!userData) {
                return res.status(400).json({ status: 400, message: "User not found" });
            }

            // Perform the accept or reject onboarding user process
            if (dbUserData.doc_verification == 2) { // Accept case
                if (userData.doc_verification !== dbUserData.doc_verification) {
                    message = await handleAcceptProcess(req, userData, dbUserData);
                    // Check if BST tried to approve CP request (error message returned)
                    if (message && message.includes("BST cannot approve")) {
                        return res.status(403).json({ status: 403, message: message });
                    }
                }
            } else if (dbUserData.doc_verification == 3) { // Reject case
                if (userData.doc_verification != dbUserData.doc_verification) {
                    message = await handleRejectProcess(req, userData, dbUserData);
                    // Check if BST tried to reject CP request (error message returned)
                    if (message && message.includes("BST cannot reject")) {
                        return res.status(403).json({ status: 403, message: message });
                    }
                }
            }

            return res.status(200).json({ status: 200, message });
        }

        if (dbUserData.forDMSApproval) {
            // find user in admin
            let userData = await db.clients.findOne({
                where: {
                    user_code: dbUserData.user_code,
                },
            });

            if (!userData) {
                return res.status(400).json({ status: 400, message: "User not found" });
            }

            // Perform the accept or reject onboarding user process
            if (dbUserData.doc_verification == 2) { // Accept case
                if (userData.doc_verification !== dbUserData.doc_verification) {
                    message = await handleAcceptProcess(req, userData, dbUserData);
                }
            } else if (dbUserData.doc_verification == 3) { // Reject case
                if (userData.doc_verification !== dbUserData.doc_verification) {
                    message = await handleRejectProcess(req, userData, dbUserData);
                }
            }

            return res.status(200).json({ status: 200, message });
        }

        // Regular user data update flow if forApproval is not present
        if (!dbUserData.report_to) {
            dbUserData.report_to = null;
        }

        // Find user in admin
        let userData = await db.clients.findOne({
            where: {
                user_code: dbUserData.user_code,
            },
        });

        if (!userData) {
            return res.status(400).json({ status: 400, message: "User not found" });
        }

        // Hash password if provided
        if (dbUserData.password) {
            dbUserData.password = await bcrypt.hash(dbUserData.password, 10);
        }

        // Find user in the config DB and update profile
        let userDataInDB = await req.config.users.findOne({
            where: { user_code: dbUserData.user_code },
        });
        if (!userDataInDB) {
            return res.status(400).json({ status: 400, message: "User not found in tenant database" });
        }

        // Channel partner project assignment mode:
        // PUT /api/v1/db/users with { user_code, project_ids: [] }
        if (Object.prototype.hasOwnProperty.call(dbUserData, "project_ids")) {
            const assignment = await assignProjectsToChannelPartner(req.config, {
                user_code: dbUserData.user_code,
                project_ids: dbUserData.project_ids,
            });
            if (!assignment.ok) {
                return await responseError(req, res, assignment.message);
            }
            return await responseSuccess(req, res, "Channel Partner projects assigned successfully", assignment.data);
        }

        if (dbUserData.report_to && userDataInDB.report_to != dbUserData.report_to) {
            const assignedUser = await req.config.users.findOne({
                where: { user_id: dbUserData.report_to },
            });
            message = assignedUser
                ? `The Channel Partner has been successfully assigned to ${assignedUser.user} ${assignedUser.user_l_name || ''}`
                : `The Channel Partner's request has been successfully assigned.`;
        }

        // Update user profile - only include profile-specific fields
        data = await userDataInDB.update(dbUserData);

        // Filter to only include profile fields
        const profileFields = ['div_id', 'dep_id', 'des_id', 'aadhar_no', 'aadhar_file', 
            'pan_no', 'pan_file', 'dl_no', 'dl_file', 'rera_no', 'rera_file', 
            'c_cheque', 'c_cheque_file', 'user_image_file', 'bank_name', 
            'account_holder_name', 'account_no', 'bank_ifsc_code', 'branch',
            'contact_person', 'credit_limit', 'incorporation_certificate', 
            'payment_method', 'distributor_rating', 'address_proof', 
            'gst_registration', 'banking_details'];
        
        let profileUpdateData = {};
        profileFields.forEach(field => {
            if (dbUserData[field] !== undefined && dbUserData[field] !== null) {
                profileUpdateData[field] = dbUserData[field];
            }
        });

        if (Object.keys(profileUpdateData).length > 0) {
            await req.config.usersProfiles.update(profileUpdateData, {
                where: { user_id: userDataInDB.user_id },
            });
        }

        if (dbUserData.isAssigned == true) {
            return res.status(200).json({ status: 200, message, data });
        }

        // Update user permissions
        await updateUserPermissions(req, userDataInDB.user_id, dbUserData);

        // Close connection and update admin DB
        dbUserData.user_id = userData.user_id;
        await db.clients.update(dbUserData, {
            where: { user_code: dbUserData.user_code },
        });

        return res.status(200).json({ status: 200, message, data });
    } catch (error) {
        logErrorToFile(error);
        console.log("error", error);
        return res.status(400).json({ status: 400, message: "Something went wrong" });
    }
};

// Function to push CP data to ERP
const pushCPToERP = async (req, userDataInDB, userData) => {
    try {
        const traceId = `ERP_CP_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        console.error(`[${traceId}] pushCPToERP invoked`, {
            user_code: userDataInDB?.user_code,
            user_id: userDataInDB?.user_id,
            role_id: userDataInDB?.role_id
        });

        // Only push CP (role_id == 1) to ERP
        if (userDataInDB.role_id !== 1) {
            console.error(`[${traceId}] Skipping ERP push: User is not a CP (role_id: ${userDataInDB.role_id})`);
            return;
        }

        // Fetch state and city names - ensure they're never null
        let stateName = "";
        let cityName = "";
        let countryName = "India"; // Default

        if (userDataInDB.state_id) {
            const state = await req.config.states.findByPk(userDataInDB.state_id);
            if (state && state.state_name) {
                stateName = String(state.state_name);
            }
        }

        if (userDataInDB.city_id) {
            const city = await req.config.city.findByPk(userDataInDB.city_id);
            if (city && city.city_name) {
                cityName = String(city.city_name);
            }
        }

        if (userDataInDB.country_id) {
            const country = await req.config.country.findByPk(userDataInDB.country_id);
            if (country && country.country_name) {
                countryName = String(country.country_name);
            }
        }

        // Build name: use only CP's personal name (user + user_l_name), no fallback
        let cpName = "";
        if (userDataInDB.user) {
            cpName = userDataInDB.user;
            if (userDataInDB.user_l_name) {
                cpName += ` ${userDataInDB.user_l_name}`;
            }
        }

        // Build RERA details array - Hardcoded value
        const reraDetails = [
            {
                reraNumber: "7372274478598",
                registrationDate: "2025-12-18",
                state: "West Bengal"
            }
        ];

        // Extract mobile country code and number
        let mobileCountryCode = "91"; // Default for India
        let mobileNumber = userDataInDB.contact_number ? String(userDataInDB.contact_number) : "";
        const accountType = "Broker/Agent";
        const brokerType = "Individual";

        // Prepare ERP payload (defined outside try-catch for error logging)
        // Ensure all fields are strings (never null) - ERP rejects null values
        let erpPayload = {
            code: String(userDataInDB.user_code || ""),
            accountType: String(accountType),
            brokerType: String(brokerType),
            name: String(cpName || ""),
            addressLine1: String(userDataInDB.address || ""),
            addressLine2: "",
            city: String(cityName || ""),
            state: String(stateName || ""),
            country: String(countryName || "India"),
            pincode: userDataInDB.pincode ? String(userDataInDB.pincode) : "700001", // Use DB pincode, fallback to hardcoded
            mobileCountryCode: String(mobileCountryCode || "91"),
            mobileNumber: String(mobileNumber || ""),
            email: String(userDataInDB.email || ""),
            ledgerSetting: 2,
            reraDetails: Array.isArray(reraDetails) ? reraDetails.map(item => ({
                reraNumber: String(item.reraNumber || ""),
                registrationDate: String(item.registrationDate || ""),
                state: String(item.state || "")
            })) : []
        };
        
        // Deep clean: Remove any null/undefined values recursively and ensure proper types
        const cleanPayload = (obj) => {
            if (obj === null || obj === undefined) {
                return "";
            }
            if (Array.isArray(obj)) {
                const cleaned = obj.map(item => cleanPayload(item)).filter(item => {
                    // Keep all items, but ensure they're not null/undefined
                    return item !== null && item !== undefined;
                });
                return cleaned;
            }
            if (typeof obj === 'object') {
                const cleaned = {};
                Object.keys(obj).forEach(key => {
                    const value = obj[key];
                    if (value === null || value === undefined) {
                        // For string fields, use empty string; for numbers, keep as is
                        cleaned[key] = "";
                    } else if (Array.isArray(value)) {
                        cleaned[key] = value.map(item => cleanPayload(item));
                    } else if (typeof value === 'object') {
                        cleaned[key] = cleanPayload(value);
                    } else {
                        // Ensure numbers stay as numbers, strings as strings
                        cleaned[key] = value;
                    }
                });
                return cleaned;
            }
            return obj;
        };
        
        erpPayload = cleanPayload(erpPayload);
        
        // Final validation: Ensure no null/undefined values exist
        const validatePayload = (obj, path = '') => {
            if (obj === null || obj === undefined) {
                throw new Error(`Null/undefined value found at path: ${path}`);
            }
            if (Array.isArray(obj)) {
                obj.forEach((item, index) => {
                    validatePayload(item, `${path}[${index}]`);
                });
            } else if (typeof obj === 'object') {
                Object.keys(obj).forEach(key => {
                    validatePayload(obj[key], path ? `${path}.${key}` : key);
                });
            }
        };
        
        try {
            validatePayload(erpPayload);
        } catch (validationError) {
            console.error(`❌ Payload validation failed: ${validationError.message}`);
            throw new Error(`Payload validation failed: ${validationError.message}`);
        }
        
        // Log payload for debugging BEFORE sending
        console.error(`\n[${traceId}] ========== ERP Payload for CP ${userDataInDB.user_code} ==========`);
        console.error(JSON.stringify(erpPayload, null, 2));
        console.error(`[${traceId}] ========================================================\n`);
        
        // Ensure reraDetails is always a valid array (never null)
        if (!Array.isArray(erpPayload.reraDetails)) {
            erpPayload.reraDetails = [];
        }
        // Ensure each reraDetails item has all required fields
        erpPayload.reraDetails = erpPayload.reraDetails.map(item => {
            if (!item || typeof item !== 'object') {
                return {
                    reraNumber: "",
                    registrationDate: "",
                    state: ""
                };
            }
            return {
                reraNumber: String(item.reraNumber || ""),
                registrationDate: String(item.registrationDate || ""),
                state: String(item.state || "")
            };
        });
        
        // Also log the actual data types to ensure nothing is null
        console.log(`Payload validation check:`, {
            code: typeof erpPayload.code,
            name: typeof erpPayload.name,
            reraDetails: Array.isArray(erpPayload.reraDetails) ? `Array(${erpPayload.reraDetails.length})` : typeof erpPayload.reraDetails,
            reraDetailsFirstItem: erpPayload.reraDetails && erpPayload.reraDetails[0] ? typeof erpPayload.reraDetails[0] : 'N/A'
        });
        
        // Final JSON stringify/parse to ensure clean serialization
        erpPayload = JSON.parse(JSON.stringify(erpPayload));

        // Call ERP API
        const erpEndpoint = process.env.ERP_CP_CREATE_ENDPOINT || "https://uat.farvisioncloud.com/CRM/odata/CreateChannelPartner";
        const erpApiKey = process.env.ERP_CP_API_KEY || "2699eba8977265f8eb26eee3a9a34478e0eedcd4e96fe10884ca213ffb54a738";
        
        console.error(`[${traceId}] Pushing CP to ERP: ${userDataInDB.user_code} (${cpName})`);
        console.error(`[${traceId}] ERP Endpoint: ${erpEndpoint}`);
        
        const response = await axios.post(erpEndpoint, erpPayload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `APIKEY ${erpApiKey}`
            },
            timeout: 30000 // 30 seconds timeout
        });

        const responseData = response.data;
        
        // Save response data to database (store as JSON string)
        try {
            await userDataInDB.update({
                erp_response_data: JSON.stringify(responseData)
            });
            console.log(`ERP response data saved to database for CP ${userDataInDB.user_code}`);
        } catch (dbError) {
            // Log but don't fail if database update fails
            console.error(`Failed to save ERP response to database for CP ${userDataInDB.user_code}:`, dbError.message);
        }
        
        // Check ERP response status
        if (responseData.status === true) {
            // Success response
            const outputList = responseData.outputList || {};
            console.error(`[${traceId}] ✅ ERP API Success for CP ${userDataInDB.user_code}:`, {
                erpId: outputList.id,
                ledgerId: outputList.ledgerId,
                addressesId: outputList.addressesId,
                communicationsId: outputList.communicationsId,
                accountId: outputList.accountId
            });

            return { 
                success: true, 
                response: responseData,
                payload: erpPayload, // Include payload for frontend debugging
                erpIds: {
                    id: outputList.id,
                    ledgerId: outputList.ledgerId,
                    addressesId: outputList.addressesId,
                    communicationsId: outputList.communicationsId,
                    accountId: outputList.accountId
                }
            };
        } else {
            // Error response from ERP (status === false)
            const outputList = responseData.outputList || {};

            // Normalize errorList to always be an array so .find() / .map() work safely
            // ERP sometimes returns errorList as a JSON string, so we need to parse it
            let rawErrorList = outputList.errorList;
            
            // If errorList is a string, try to parse it as JSON
            if (typeof rawErrorList === 'string') {
                try {
                    const parsed = JSON.parse(rawErrorList);
                    // If parsed successfully, check if it has nested structure
                    if (parsed.code && parsed.errors && Array.isArray(parsed.errors)) {
                        // ERP returns: {"code":"BadRequest","errors":[...]}
                        rawErrorList = parsed.errors;
                    } else if (Array.isArray(parsed)) {
                        rawErrorList = parsed;
                    } else {
                        rawErrorList = [parsed];
                    }
                } catch (e) {
                    // If parsing fails, treat as string error
                    rawErrorList = [rawErrorList];
                }
            }
            
            const errorList = Array.isArray(rawErrorList)
                ? rawErrorList
                : rawErrorList != null
                    ? [rawErrorList]
                    : [];
            
            // Check for duplicate record error or "BadRequest" with "PROSPECT ALREADY EXISTS"
            const duplicateError = errorList.find(err => {
                if (!err) return false;
                
                // Handle string errors (might be JSON string)
                if (typeof err === 'string') {
                    // Check if string contains duplicate indicators
                    if (err.includes("PROSPECT ALREADY EXISTS") || err.includes("DuplicateRecord")) {
                        return true;
                    }
                    // Try to parse as JSON
                    try {
                        const parsed = JSON.parse(err);
                        if (parsed.errors && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
                            const firstError = parsed.errors[0];
                            const errorCode = firstError.code || '';
                            return errorCode.includes("PROSPECT ALREADY EXISTS") || 
                                   errorCode === "DuplicateRecord";
                        }
                        if (parsed.code) {
                            return parsed.code.includes("PROSPECT ALREADY EXISTS") || 
                                   parsed.code === "DuplicateRecord";
                        }
                    } catch (e) {
                        // Not JSON, check string content
                        return err.includes("PROSPECT ALREADY EXISTS") || err.includes("DuplicateRecord");
                    }
                }
                
                // Handle object errors
                if (typeof err === 'object' && err !== null) {
                    const errCode = err.code || '';
                    const errMessage = err.message || err.code || '';
                    return errCode === "DuplicateRecord" || 
                           (typeof errMessage === 'string' && errMessage.includes("PROSPECT ALREADY EXISTS"));
                }
                
                return false;
            });
            
            if (duplicateError) {
                // Extract error details (handle both object and string formats)
                let errorCode = "DuplicateRecord";
                let errorMessage = "CP already exists in ERP";
                
                if (typeof duplicateError === 'string') {
                    try {
                        const parsed = JSON.parse(duplicateError);
                        if (parsed.errors && parsed.errors[0]) {
                            errorMessage = parsed.errors[0].code || errorMessage;
                        }
                    } catch (e) {
                        errorMessage = duplicateError;
                    }
                } else if (typeof duplicateError === 'object' && duplicateError !== null) {
                    errorCode = duplicateError.code || errorCode;
                    errorMessage = duplicateError.code || duplicateError.message || errorMessage;
                }
                
                console.error(`[${traceId}] ⚠️ ERP Duplicate Record for CP ${userDataInDB.user_code}:`, {
                    code: errorCode,
                    message: errorMessage,
                    existingId: outputList.id,
                    existingLedgerId: outputList.ledgerId,
                    existingAccountId: outputList.accountId
                });
                
                // Duplicate is not a critical error - CP already exists in ERP
                return { 
                    success: true, 
                    isDuplicate: true,
                    response: responseData,
                    payload: erpPayload, // Include payload for frontend debugging
                    erpIds: {
                        id: outputList.id,
                        ledgerId: outputList.ledgerId,
                        accountId: outputList.accountId
                    },
                    message: `CP already exists in ERP: ${errorMessage}`
                };
            } else {
                // Other errors
                console.error(`[${traceId}] ❌ ERP API Error for CP ${userDataInDB.user_code}:`, {
                    status: responseData.status,
                    errors: errorList,
                    fullResponse: responseData,
                    partialData: {
                        id: outputList.id,
                        ledgerId: outputList.ledgerId,
                        accountId: outputList.accountId
                    }
                });
                
                // Build a robust error message from errorList (handles objects or strings)
                const errorMessages = errorList && errorList.length > 0
                    ? errorList.map(err => {
                        if (typeof err === "object" && err !== null) {
                            const code = err.code || "UnknownCode";
                            const field = err.field ? ` (${err.field})` : "";
                            return `${code}${field}`;
                        }
                        return String(err);
                    }).join(", ")
                    : "Unknown error from ERP (empty errorList)";

                // Do NOT throw here: return structured error so caller can handle,
                // and keep the full ERP response already saved in erp_response_data.
                return {
                    success: false,
                    error: errorMessages,
                    response: responseData,
                    payload: erpPayload // Include payload for frontend debugging
                };
            }
        }
    } catch (error) {
        // Extract detailed error information
        const erpErrorDetails = error.response?.data || {};
        const erpStatus = error.response?.status;
        
        // Handle different error response formats from ERP
        let erpErrors = [];
        if (erpErrorDetails.errors) {
            erpErrors = Array.isArray(erpErrorDetails.errors) ? erpErrorDetails.errors : [erpErrorDetails.errors];
        } else if (erpErrorDetails.errorList) {
            // errorList might be a string or array
            let rawErrorList = erpErrorDetails.errorList;
            if (typeof rawErrorList === 'string') {
                try {
                    const parsed = JSON.parse(rawErrorList);
                    if (parsed.errors && Array.isArray(parsed.errors)) {
                        erpErrors = parsed.errors;
                    } else {
                        erpErrors = [parsed];
                    }
                } catch (e) {
                    erpErrors = [rawErrorList];
                }
            } else if (Array.isArray(rawErrorList)) {
                erpErrors = rawErrorList;
            } else {
                erpErrors = [rawErrorList];
            }
        } else if (erpErrorDetails.outputList?.errorList) {
            // Handle nested errorList in outputList
            let rawErrorList = erpErrorDetails.outputList.errorList;
            if (typeof rawErrorList === 'string') {
                try {
                    const parsed = JSON.parse(rawErrorList);
                    if (parsed.errors && Array.isArray(parsed.errors)) {
                        erpErrors = parsed.errors;
                    } else {
                        erpErrors = [parsed];
                    }
                } catch (e) {
                    erpErrors = [rawErrorList];
                }
            } else if (Array.isArray(rawErrorList)) {
                erpErrors = rawErrorList;
            } else {
                erpErrors = [rawErrorList];
            }
        }
        
        // Log detailed error information
        const errorLog = {
            message: error.message,
            httpStatus: erpStatus,
            erpErrorDetails: JSON.stringify(erpErrorDetails, null, 2),
            erpErrors: erpErrors,
            erpErrorsStringified: JSON.stringify(erpErrors, null, 2)
        };
        
        // Include payload if available (might not be accessible if error occurred before payload creation)
        if (typeof erpPayload !== 'undefined') {
            errorLog.payloadSent = JSON.stringify(erpPayload, null, 2);
        }
        
        console.error(`Error pushing CP ${userDataInDB?.user_code} to ERP:`, errorLog);
        
        // Check if this is a duplicate error even in HTTP 500 response
        const isDuplicateError = erpErrors.some(err => {
            const errStr = typeof err === 'string' ? err : JSON.stringify(err);
            return errStr.includes("PROSPECT ALREADY EXISTS") || 
                   errStr.includes("DuplicateRecord") ||
                   errStr.includes("already exists");
        });
        
        // Save error response to database if available
        if (userDataInDB && error.response?.data) {
            try {
                await userDataInDB.update({
                    erp_response_data: JSON.stringify({
                        status: false,
                        error: error.message,
                        response: error.response.data,
                        httpStatus: error.response.status,
                        ...(typeof erpPayload !== 'undefined' && { payloadSent: erpPayload })
                    })
                });
                console.log(`ERP error response data saved to database for CP ${userDataInDB.user_code}`);
            } catch (dbError) {
                console.error(`Failed to save ERP error response to database:`, dbError.message);
            }
        } else if (userDataInDB && error.message) {
            // Save error message even if no response data
            try {
                await userDataInDB.update({
                    erp_response_data: JSON.stringify({
                        status: false,
                        error: error.message,
                        timestamp: new Date().toISOString(),
                        ...(typeof erpPayload !== 'undefined' && { payloadSent: erpPayload })
                    })
                });
            } catch (dbError) {
                console.error(`Failed to save ERP error to database:`, dbError.message);
            }
        }
        
        logErrorToFile(error);
        
        // Build better error message
        let errorMessage = error.message;
        if (erpStatus === 500) {
            errorMessage = `ERP server error (500): ${error.message}`;
            if (erpErrors.length > 0) {
                const errorTexts = erpErrors.map(err => {
                    if (typeof err === 'object' && err !== null) {
                        return err.code || err.message || JSON.stringify(err);
                    }
                    // If it's a string, try to extract meaningful info
                    if (typeof err === 'string') {
                        try {
                            const parsed = JSON.parse(err);
                            if (parsed.errors && parsed.errors[0]) {
                                return parsed.errors[0].code || parsed.errors[0].message || err;
                            }
                            return parsed.code || err;
                        } catch (e) {
                            return err;
                        }
                    }
                    return String(err);
                });
                errorMessage += ` - ${errorTexts.join(', ')}`;
            }
        } else if (erpErrors.length > 0) {
            // For non-500 errors, extract error messages
            const errorTexts = erpErrors.map(err => {
                if (typeof err === 'object' && err !== null) {
                    return err.code || err.message || JSON.stringify(err);
                }
                if (typeof err === 'string') {
                    try {
                        const parsed = JSON.parse(err);
                        if (parsed.errors && parsed.errors[0]) {
                            return parsed.errors[0].code || parsed.errors[0].message || err;
                        }
                        return parsed.code || err;
                    } catch (e) {
                        return err;
                    }
                }
                return String(err);
            });
            errorMessage = errorTexts.join(', ');
        }
        
        // If it's a duplicate error, treat it as success (CP already exists)
        if (isDuplicateError) {
            console.log(`⚠️ ERP Duplicate Record detected in HTTP ${erpStatus} response for CP ${userDataInDB?.user_code}`);
            return {
                success: true,
                isDuplicate: true,
                error: errorMessage,
                response: erpErrorDetails,
                ...(typeof erpPayload !== 'undefined' && { payload: erpPayload }) // Include payload if available
            };
        }
        
        return { 
            success: false, 
            error: errorMessage,
            ...(typeof erpPayload !== 'undefined' && { payload: erpPayload }) // Include payload if available
        };
    }
};

// API to retry pushing CP data to ERP manually
exports.retryPushCPToERP = async (req, res) => {
    try {
        const { user_code, user_id } = req.body;
        console.error("[retryPushCPToERP] Request received", {
            user_code: user_code || null,
            user_id: user_id || null,
            timestamp: new Date().toISOString()
        });

        if (!user_code && !user_id) {
            return await responseError(req, res, "user_code or user_id is required to retry ERP push");
        }

        // Find CP user in tenant DB
        const whereClause = {};
        if (user_code) whereClause.user_code = user_code;
        if (user_id) whereClause.user_id = user_id;

        const userDataInDB = await req.config.users.findOne({ where: whereClause });

        if (!userDataInDB) {
            return await responseError(req, res, "Channel Partner not found");
        }

        if (userDataInDB.role_id !== 1) {
            return await responseError(req, res, "Selected user is not a Channel Partner");
        }

        // Call common ERP push function
        const result = await pushCPToERP(req, userDataInDB, null);
        console.error("[retryPushCPToERP] pushCPToERP completed", {
            user_code: userDataInDB.user_code,
            success: result?.success === true,
            isDuplicate: result?.isDuplicate === true,
            error: result?.error || null
        });

        if (!result || result.success === false) {
            const message = result && result.error
                ? `Failed to push CP to ERP: ${result.error}`
                : "Failed to push CP to ERP";
            return await responseError(req, res, message, result || null);
        }

        let message = "CP data pushed to ERP successfully";
        if (result.isDuplicate) {
            message = "CP already exists in ERP (duplicate record). Latest ERP response stored in database.";
        }

        return await responseSuccess(req, res, message, result);
    } catch (error) {
        logErrorToFile(error);
        console.error("Error in retryPushCPToERP:", error);
        return await responseError(req, res, "Something Went Wrong", error.message || error);
    }
};

// Function to handle accept onboarding user process
const handleAcceptProcess = async (req, userData, dbUserData) => {
    let message;
    let userDataInDB = await req.config.users.findOne({
        where: { user_code: dbUserData.user_code },
    });
    // Admin case
    if (req.user.isDB) {
        dbUserData.doc_verification = 2
        if (dbUserData.forDMSApproval) {
            message = `The Distributor's request has been successfully Accepted`;
        }
        else {
            dbUserData.bst_response = dbUserData.bst_approval = dbUserData.director_response = dbUserData.director_approval = true;
            message = `The Channel Partner's request has been accepted sucsessfully.`;
        }
    }
    else if (req.user.role_id == 2) { // BST role
        // BST should NOT be able to approve CP requests after form submission
        // Only Supervisor (role_id = 3) and Admin (isDB = true) can approve CP requests
        if (userData.role_id == 1 && (userData.doc_verification == 1 || dbUserData.doc_verification == 2)) {
            // CP has submitted form (doc_verification = 1) or is being approved, BST cannot approve
            return "BST cannot approve CP requests. Only Supervisor and Admin can approve after CP submits form.";
        }
        // For non-CP users or CPs that haven't submitted form, allow BST approval
        delete dbUserData.doc_verification
        dbUserData.bst_response = dbUserData.bst_approval = true;
        if (!userData.director_approval) {
            message = `The Channel Partner's request has been accepted by BST, waiting for Director's approval.`;
        } else {
            dbUserData.director_response = dbUserData.director_approval = true;
            message = `The Channel Partner's request has been accepted by both BST and Director.`;
        }
    }
    else if (req.user.role_id == 3) { // Director role
        dbUserData.doc_verification = 2
        dbUserData.director_response = dbUserData.director_approval = dbUserData.bst_response = dbUserData.bst_approval = true;
        message = `The Channel Partner's request has been accepted by both BST and Director.`;
    }

    const newDate = new Date();
    let data = await userDataInDB.update({ ...dbUserData, onboarding_date: newDate });

    if (data && dbUserData.doc_verification == 2) {
        let userExistInCPLeads = await req.config.channelPartnerLeads.findOne({
            where: { email: userData.email }
        })
        if (userExistInCPLeads) {
            await userExistInCPLeads.update({ stage: 'ONBOARDED' })
            
            // Transfer ownership: Set report_to from CP lead's assigned_to (BST user)
            // After onboarding, the same BST user who was assigned the lead becomes the CP's owner
            if (userExistInCPLeads.asssigned_to && userData.role_id == 1) {
                await userDataInDB.update({ report_to: userExistInCPLeads.asssigned_to });
                // Also update in admin DB
                await db.clients.update(
                    { report_to: userExistInCPLeads.asssigned_to },
                    { where: { user_code: dbUserData.user_code } }
                );
                console.log(`Ownership transferred: CP ${userData.user_id} now reports to BST ${userExistInCPLeads.asssigned_to}`);
            }
        }

        // Push CP data to ERP when doc_verification == 2 for CP users (role_id == 1)
        // Use tenant user role (data.role_id) instead of admin client role to avoid mismatches
        if (data && data.role_id == 1) {
            // Reload userDataInDB to get latest data including onboarding_date and verification status
            await data.reload();

            if (data.doc_verification == 2) {
                // Push to ERP (non-blocking - errors are logged but don't fail onboarding)
                pushCPToERP(req, data, userData)
                    .then((result) => {
                        console.error("[autoPushCPToERP] pushCPToERP completed", {
                            user_code: data.user_code,
                            success: result?.success === true,
                            isDuplicate: result?.isDuplicate === true,
                            error: result?.error || null,
                            payload: result?.payload || null
                        });
                    })
                    .catch(err => {
                        console.error(`Failed to push CP ${data.user_code} to ERP:`, err.message);
                    });
            }
        }
    }

    dbUserData.user_id = userData.user_id;
    await db.clients.update(dbUserData, {
        where: { user_code: dbUserData.user_code },
    });
    await sendResetPasswordEmail(req, userData, data);
    return message;
};

// Function to handle reject onboarding user process
const handleRejectProcess = async (req, userData, dbUserData) => {
    let message;
    // Admin case
    let userDataInDB = await req.config.users.findOne({
        where: { user_code: dbUserData.user_code },
    });
    if (req.user.isDB) {
        if (dbUserData.forDMSApproval) {
            message = `The Distributor's request has been successfully rejected`;
        }
        else {
            dbUserData.bst_response = dbUserData.director_response = dbUserData.director_approval = true;
            dbUserData.bst_approval = dbUserData.director_approval = false;
            message = `The Channel Partner's request has been rejected sucsessfully.`;
        }
    }
    else if (req.user.role_id == 2) { // BST role
        // BST should NOT be able to reject CP requests after form submission
        // Only Supervisor (role_id = 3) and Admin (isDB = true) can reject CP requests
        if (userData.role_id == 1 && (userData.doc_verification == 1 || dbUserData.doc_verification == 3)) {
            // CP has submitted form (doc_verification = 1) or is being rejected, BST cannot reject
            return "BST cannot reject CP requests. Only Supervisor and Admin can reject after CP submits form.";
        }
        // For non-CP users or CPs that haven't submitted form, allow BST rejection
        delete dbUserData.doc_verification
        dbUserData.bst_response = dbUserData.bst_approval = true;
        dbUserData.bst_approval = false;
        if (!userData.director_approval) {
            message = `The Channel Partner's request has been rejected by BST, waiting for Director's rejection.`;
        } else {
            dbUserData.director_response = dbUserData.director_approval = true;
            message = `The Channel Partner's request has been rejected by both BST and Director.`;
        }
    }
    else if (req.user.role_id == 3) { // Director role
        dbUserData.doc_verification = 3
        dbUserData.director_response = dbUserData.director_approval = true;
        dbUserData.bst_approval = false;
        message = `The Channel Partner's request has been rejected by both BST and Director.`;
    }

    await userDataInDB.update({ ...dbUserData, doc_verification: 3 });

    dbUserData.user_id = userData.user_id;
    await db.clients.update(dbUserData, {
        where: { user_code: dbUserData.user_code },
    });
    // Send rejection email
    await sendRejectionEmail(req, userData, dbUserData);
    return message;
};

// Function to update user permissions
const updateUserPermissions = async (req, user_id, dbUserData) => {
    let userPermissions = {
        CRM: dbUserData.isCRM || false,
        DMS: dbUserData.isDMS || false,
        SALES: dbUserData.isSALES || false,
        CHANNEL: dbUserData.isCHANNEL || false,
        MEDIA: dbUserData.isMEDIA || false,
    };

    const userEntries = Object.entries(userPermissions);
    for (const [index, [key, value]] of userEntries.entries()) {
        await req.config.userPlatform.update(
            { actions: value },
            { where: { user_id, platform_id: index + 1 } }
        );
    }
};

// Function to send reset password email (used in accept process)
const sendResetPasswordEmail = async (req, userData, userAssign) => {
    const resetToken = crypto.randomBytes(32).toString("hex");
    const passwordResetToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

    await userData.update({
        password_reset_token: passwordResetToken,
        password_reset_expires: moment(new Date()).add(1, "d").toDate(),
    });

    const resetLink = `${req.admin.client_url}/partner/ResetViaMail?tkn=u$34${passwordResetToken}`;
    const htmlTemplatePath = path.join(__dirname, "..", "mail", "cp", "resetPassword.html");
    const htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");
    // const emailTemplate = await req.config.emailTemplates.findOne({ where: { template_id: 29 } })  // Channel Partner Reg Link Template
    // let htmlTemplate = emailTemplate.template
    let company_name
    let company = await req.config.organisationInfo.findOne({
        attributes: ['company_name']
    })
    if (company) {
        company_name = company.company_name || 'Srijan Bandhan'
    }
    else {
        company_name = 'Srijan Bandhan'
    }

    let BdData = {
        user: "",
        user_l_name: "",
        contact_number: "",
        email: ""
    };
    if (userAssign.dataValues.report_to) {
        BdData = await req.config.users.findOne({
            where: { user_id: userAssign.dataValues.report_to },
            attributes: ['user', 'user_l_name', 'email', 'contact_number'],
        })
    }

    let htmlContent = htmlTemplate
        .replace(/{{resetLink}}/g, resetLink)
        .replace(/{{CompanyName}}/g, company_name ?? "")
        .replace(/{{UsersName}}/, userData.user ?? "")
        .replace(/{{BDName}}/g, `${BdData.user ?? ""} ${BdData.user_l_name ?? ""}`)
        .replace(/{{PhoneNo}}/g, BdData.contact_number ?? "")
        .replace(/{{EmailID}}/g, BdData.email ?? "")

    const options = {
        email: userData.email,
        subject: "Srijan Bandhan",
        message: htmlContent,
    };

    await sendEmail(options);
};

// Function to send rejection email (used in reject process)
const sendRejectionEmail = async (req, userData, dbUserData) => {
    const htmlTemplatePath = path.join(__dirname, "..", "mail", "cp", "reject.html");
    const htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");
    let company_name
    let company = await req.config.organisationInfo.findOne({
        attributes: ['company_name']
    })
    if (company) {
        company_name = company.company_name || 'Srijan Bandhan'
    }
    else {
        company_name = 'Srijan Bandhan'
    }

    let htmlContent = htmlTemplate
        .replace(/{{reject_reason}}/g, dbUserData.reject_reason)
        .replace(/{{CompanyName}}/g, company_name)
        .replace(/{{UsersName}}/, userData.user);

    const options = {
        email: userData.email,
        subject: "Srijan Bandhan",
        message: htmlContent,
    };

    await sendEmail(options);
};

exports.deleteUser = async (req, res) => {
    try {
        let user_code = req.query.id;
        let userData = await db.clients.findOne({
            where: {
                user_code: user_code,
            },
        });

        if (!userData) {
            return res.status(400).json({ status: 400, message: "user not found" });
        }

        await db.clients.destroy({
            where: {
                user_code: user_code,
            },
        });

        await req.config.users.destroy({
            where: {
                user_code: user_code,
            },
        });
        return res
            .status(200)
            .json({ status: 200, message: "user deleted successfully", data: null });
    } catch (error) {
        logErrorToFile(error)
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.getActiveBSTList = async (req, res) => {
    try {
        const where = {
            role_id: 2,
            user_status: true,
            doc_verification: 2,
            deletedAt: null,
        };

        if (req.query.state_id) where.state_id = req.query.state_id;
        if (req.query.city_id) where.city_id = req.query.city_id;

        const users = await req.config.users.findAll({
            where,
            attributes: [
                "user_id",
                "user",
                "user_l_name",
                "email",
                "contact_number",
                "report_to",
                "state_id",
                "city_id",
                "zone",
            ],
            order: [["user", "ASC"]],
        });

        return await responseSuccess(req, res, "Active BST list", users);
    } catch (error) {
        logErrorToFile(error);
        return await responseError(req, res, "Something Went Wrong");
    }
};

exports.getChannelPartnerProjectOptions = async (req, res) => {
    try {
        const { user_code, user_id } = req.query;

        const parseBstIds = (raw) => {
            if (raw === undefined || raw === null || raw === "") return [];
            let values = raw;
            if (typeof values === "string") {
                const trimmed = values.trim();
                if (!trimmed) return [];
                try {
                    values = JSON.parse(trimmed);
                } catch (_e) {
                    values = trimmed.split(",");
                }
            }
            if (!Array.isArray(values)) values = [values];
            return [...new Set(
                values
                    .map((v) => Number(String(v).trim()))
                    .filter((n) => Number.isInteger(n) && n > 0)
            )];
        };

        const projects = await req.config.sequelize.query(
            `
                SELECT project_id, project, state_id, city_id, zone, bst
                FROM db_channel_projects
                WHERE deletedAt IS NULL
                ORDER BY project ASC
            `,
            { type: QueryTypes.SELECT }
        );

        let cpUser = null;
        let selectedProjectIds = [];

        if (user_code || user_id) {
            const where = {
                role_id: 1,
                deletedAt: null,
            };
            if (user_code) where.user_code = user_code;
            if (user_id) {
                const parsedUserId = Number(user_id);
                if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
                    return await responseError(req, res, "user_id must be a valid number");
                }
                where.user_id = parsedUserId;
            }

            cpUser = await req.config.users.findOne({
                where,
                attributes: ["user_id", "user_code", "email", "contact_number"],
            });

            if (!cpUser) {
                return await responseError(req, res, "Channel Partner not found");
            }

            const directRows = await req.config.sequelize.query(
                `
                    SELECT project_id
                    FROM db_user_channel_projects
                    WHERE created_by = :cp_user_id
                      AND deletedAt IS NULL
                `,
                {
                    replacements: { cp_user_id: cpUser.user_id },
                    type: QueryTypes.SELECT,
                }
            );

            const leadRows = await req.config.sequelize.query(
                `
                    SELECT clp.project_id
                    FROM db_channel_partner_leads l
                    INNER JOIN cp_lead_projects clp
                        ON clp.cpl_id = l.cpl_id
                       AND clp.deletedAt IS NULL
                    WHERE l.deletedAt IS NULL
                      AND (
                        (:email <> '' AND l.email = :email)
                        OR (
                            :contact IS NOT NULL
                            AND l.contact IS NOT NULL
                            AND RIGHT(CAST(l.contact AS CHAR), 10) = RIGHT(CAST(:contact AS CHAR), 10)
                        )
                      )
                `,
                {
                    replacements: {
                        email: cpUser.email || "",
                        contact: cpUser.contact_number || null,
                    },
                    type: QueryTypes.SELECT,
                }
            );

            selectedProjectIds = [...new Set(
                [...directRows, ...leadRows]
                    .map((row) => Number(row.project_id))
                    .filter((id) => Number.isInteger(id) && id > 0)
            )];
        }

        const stateIds = [...new Set(
            projects
                .map((project) => Number(project.state_id))
                .filter((id) => Number.isInteger(id) && id > 0)
        )];
        const cityIds = [...new Set(
            projects
                .map((project) => Number(project.city_id))
                .filter((id) => Number.isInteger(id) && id > 0)
        )];
        const allBstIds = [...new Set(
            projects.flatMap((project) => parseBstIds(project.bst))
        )];

        const [stateRows, cityRows, bstUsers] = await Promise.all([
            stateIds.length
                ? req.config.states.findAll({
                    where: { state_id: { [Op.in]: stateIds } },
                    attributes: ["state_id", "state_name"],
                    raw: true,
                })
                : [],
            cityIds.length
                ? req.config.city.findAll({
                    where: { city_id: { [Op.in]: cityIds } },
                    attributes: ["city_id", "city_name"],
                    raw: true,
                })
                : [],
            allBstIds.length
                ? req.config.users.findAll({
                    where: {
                        user_id: { [Op.in]: allBstIds },
                        role_id: 2,
                        deletedAt: null,
                    },
                    attributes: ["user_id", "user", "user_l_name", "state_id", "city_id", "zone"],
                    raw: true,
                })
                : [],
        ]);

        const stateMap = new Map(stateRows.map((row) => [Number(row.state_id), row.state_name || null]));
        const cityMap = new Map(cityRows.map((row) => [Number(row.city_id), row.city_name || null]));

        const bstStateIds = [...new Set(
            bstUsers
                .map((user) => Number(user.state_id))
                .filter((id) => Number.isInteger(id) && id > 0 && !stateMap.has(id))
        )];
        const bstCityIds = [...new Set(
            bstUsers
                .map((user) => Number(user.city_id))
                .filter((id) => Number.isInteger(id) && id > 0 && !cityMap.has(id))
        )];

        if (bstStateIds.length || bstCityIds.length) {
            const [extraStateRows, extraCityRows] = await Promise.all([
                bstStateIds.length
                    ? req.config.states.findAll({
                        where: { state_id: { [Op.in]: bstStateIds } },
                        attributes: ["state_id", "state_name"],
                        raw: true,
                    })
                    : [],
                bstCityIds.length
                    ? req.config.city.findAll({
                        where: { city_id: { [Op.in]: bstCityIds } },
                        attributes: ["city_id", "city_name"],
                        raw: true,
                    })
                    : [],
            ]);

            extraStateRows.forEach((row) => {
                stateMap.set(Number(row.state_id), row.state_name || null);
            });
            extraCityRows.forEach((row) => {
                cityMap.set(Number(row.city_id), row.city_name || null);
            });
        }

        const bstMap = new Map();
        bstUsers.forEach((user) => {
            const id = Number(user.user_id);
            if (!Number.isInteger(id) || id <= 0) return;
            bstMap.set(id, {
                user_id: id,
                name: [user.user, user.user_l_name].filter(Boolean).join(" ").trim() || null,
                state: stateMap.get(Number(user.state_id)) || null,
                city: cityMap.get(Number(user.city_id)) || null,
                zone: user.zone || null,
            });
        });

        const selectedSet = new Set(selectedProjectIds);
        const project_options = projects.map((project) => {
            const ids = parseBstIds(project.bst);
            const bst_users = ids
                .map((id) => bstMap.get(Number(id)))
                .filter(Boolean);
            const bst_names = bst_users.map((u) => u.name).filter(Boolean);
            const { bst: _bstOmit, ...projectData } = project;
            return {
                ...projectData,
                state_name: stateMap.get(Number(project.state_id)) || null,
                city_name: cityMap.get(Number(project.city_id)) || null,
                is_selected: selectedSet.has(Number(project.project_id)),
                bst_ids: ids,
                bst_names,
                bst_users,
            };
        });

        return await responseSuccess(req, res, "Channel partner project options fetched successfully", {
            cp_user_id: cpUser ? Number(cpUser.user_id) : null,
            user_code: cpUser ? cpUser.user_code : null,
            project_ids: selectedProjectIds,
            project_options,
        });
    } catch (error) {
        logErrorToFile(error);
        console.log("error", error);
        return await responseError(req, res, "Something Went Wrong");
    }
};

exports.getOwnerList = async (req, res) => {
    try {
        let userData = await req.config.users.findAll({
            where: {
                isDB: false,
                [Op.or]: [
                    { user_id: req.user.user_id },
                    { report_to: req.user.user_id },
                ],
            },
            attributes: {
                exclude: [
                    "password",
                    "password_reset_token",
                    "password_reset_expires",
                    "deletedAt",
                ],
            },
        });

        return await responseSuccess(req, res, "Owner list", userData);
    } catch (error) {
        logErrorToFile(error)
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong", data: { error } });
    }
};

exports.sendOtp = async (req, res) => {
    try {
        const email = req.body.email;
        if (!email) {
            return res.status(400).json({
                status: 400,
                message: "Please provide email for forgot password",
                data: null,
            });
        }
        const user = await db.clients.findOne({ where: { email } });

        if (!user) {
            return res.status(404).json({
                status: false,
                message: "No user found with that email",
            });
        }

        if (user.doc_verification != 2) {
            return res.status(400).json({
                status: 400,
                message: "User Not Verified",
                data: null,
            });
        }

        const opt = randomSixCodeGenrator()

        await user.update({
            user_verify_otp: opt,
        });

        await user.save();
        // const htmlTemplatePath = path.join(
        //     __dirname,
        //     "..",
        //     "mail",
        //     "cp",
        //     "sendotp.html"
        // );
        // const htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");
        // Fetch organization name

        const [orgRecord] = await db.sequelize.query(`
            SELECT company_name FROM ${req.body.db_name || 'MULTI_USER39234554'}.db_organisation_infos LIMIT 1`, {
            type: db.sequelize.QueryTypes.SELECT
        });
        const organisationName = orgRecord?.company_name || "Srijan Bandhan";


        let company_name
        let company = organisationName
        if (company) {
            company_name = organisationName || 'Srijan Bandhan'
        }
        else {
            company_name = 'Srijan Bandhan'
        }

        // Fetch or use default email template
        let [templateRecord] = await db.sequelize.query(`
            SELECT template FROM ${req.body.db_name || 'MULTI_USER39234554'}.db_email_templates WHERE template_id = 7 LIMIT 1`, {
            type: db.sequelize.QueryTypes.SELECT
        });

        if (!templateRecord) {
            const templatePath = path.join(
                __dirname,
                "..",
                "mail",
                "cp",
                "sendotp.html"
            );
            try {
                templateRecord = { template: fs.readFileSync(templatePath, "utf-8") };
            } catch (err) {
                templateRecord = { template: "Hi {{UsersName}},\nWelcome to {{CompanyName}},\nThank you for showing interest in our channel partner programme.\nYour OTP is {{OTP}}" };
            }
        }

        let htmlContent = templateRecord.template.replace(/{{OTP}}/g, opt);
        htmlContent = htmlContent.replace(/{{UsersName}}/g, user.user).replace(/{{CompanyName}}/g, company_name);

        let option = {
            email: email,
            subject: "OTP verification for password reset",
            message: htmlContent,
        };

        await sendEmail(option);
        return res.status(200).json({
            status: 200,
            token: opt,
            message: `Mail sent to your mail id ${user.email}`,
        });

    } catch (error) {
        logErrorToFile(error)
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong", data: error });
    }
};

exports.otpVerification = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email) {
            return res.status(400).json({
                status: 400,
                message: "Please provide email for forgot password",
                data: null,
            });
        }
        const user = await db.clients.findOne({ where: { email } });

        if (!user) {
            return res.status(404).json({
                status: false,
                message: "No user found with that email",
            });
        }

        if (user.otp === '') {
            return res.status(200).json({
                status: false,
                message: "verification process isnt initiated",
            });
        }

        if (user.user_verify_otp !== otp) {
            return res.status(200).json({
                status: false,
                message: "incorrect OTP",
            });
        }

        const resetToken = crypto.randomBytes(32).toString("hex");
        let passwordResetToken = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");

        await user.update({
            password_reset_token: passwordResetToken,
            password_reset_expires: moment(new Date()).add(1, "d").toDate(),
        });

        await user.save();
        return res.status(200).json({
            status: 200,
            message: `succesfully verified`,
        });

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong", data: error });
    }
};

exports.resetChannelPassword = async (req, res) => {
    try {
        let body = req.body;
        if (!body.password) {
            return res.status(400).json({
                status: 400,
                message: "Please enter password",
            });
        }

        let user = await db.clients.findOne({
            where: { email: body.email },
        });


        if (!user) {
            return res.status(400).json({
                status: 400,
                message: "Unable to found user",
            });
        }

        if (user.doc_verification != 2) {
            return res.status(400).json({
                status: 400,
                message: "User Not Verified",
                data: null,
            });
        }

        if (!user.password_reset_expires) {
            return res.status(400).json({
                status: 400,
                message: "Token Expired",
            });
        }

        const tokenExpiry = new Date(user.password_reset_expires);
        const currentDateTime = new Date();

        if (currentDateTime > tokenExpiry) {
            return res.status(400).json({
                status: 400,
                message: "token is already expired",
            });
        }

        let newPassword = body.password;
        let newSavePassword = await bcrypt.hash(newPassword, 10);
        user.update({
            password: newSavePassword,
            password_reset_token: null,
            user_verify_otp: null,
            password_reset_expires: new Date(),
        });
        user.save();
        let userDB = await first(user.db_name);

        await userDB.users.update(
            { password: newSavePassword },
            {
                where: {
                    user_code: user.user_code,
                },
            }
        );
        userDB.sequelize.close();
        return res.status(200).json({
            status: 200,
            message: "password changed",
            data: user,
        });
    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong", data: error });
    }
};

exports.forgotpassword = async (req, res) => {
    try {
        const email = req.body.email;
        if (!email) {
            return res.status(400).json({
                status: 400,
                message: "Please provide email for forgot password",
                data: null,
            });
        }
        const user = await db.clients.findOne({ where: { email } });


        if (!user) {
            return res.status(404).json({
                status: false,
                message: "No user found with that email",
            });
        }

        if (user.doc_verification != 2) {
            return res.status(400).json({
                status: 400,
                message: "User Not Verified",
                data: null,
            });
        }

        const adminofDb = await db.clients.findOne({ where: { db_name: user.db_name, isDB: 1 } });
        if (!adminofDb) {
            return res.status(400).json({ status: 400, message: "Admin Not Found", data: error });
        }
        const resetToken = crypto.randomBytes(32).toString("hex");
        let passwordResetToken = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");

        await user.update({
            password_reset_token: passwordResetToken,
            password_reset_expires: moment(new Date()).add(1, "d").toDate(),
        });

        await user.save();

        const resetLink = `${adminofDb.client_url}/ChangePassword?tkn=u$34${passwordResetToken}`;
        console.log('resetLink', resetLink)

        const htmlTemplate = await db.emailTemplates.findOne({ where: { template_id: 6 } }) // Password Reset Template
        const template = htmlTemplate.template

        // const htmlTemplatePath = path.join(
        //     __dirname,
        //     "..",
        //     "mail",
        //     "cp",
        //     "forgot.html"
        // );
        // const htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");

        // let { company_name } = await req.config.organisationInfo.findOne({
        //     attributes: ['company_name']
        // })
        // company_name = company_name || 'Srijan Bandhan'

        let htmlContent = template.replace(/{{resetLink}}/g, resetLink);
        htmlContent = htmlContent.replace(/{{UsersName}}/, user.user).replace(/{{CompanyName}}/g, 'Srijan Bandhan');

        let option = {
            email: email,
            subject: "Your passowrd reset token only 1 day ",
            message: htmlContent,
        };
        await sendEmail(option);
        return res.status(200).json({
            status: 200,
            token: passwordResetToken,
            message: `Mail sent to your mail id ${user.email}`,
        });
    } catch (error) {
        logErrorToFile(error)
        console.log(error, error)
        return res.status(400).json({ status: 400, message: "Something Went Wrong", data: error });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        let body = req.body;
        if (!body.password) {
            return res.status(400).json({
                status: 400,
                message: "Please enter password",
            });
        }

        let user = await db.clients.findOne({
            where: { password_reset_token: body.token },
        });
        if (!user) {
            return res.status(400).json({
                status: 400,
                message: "Unable to found user",
            });
        }

        let newPassword = body.password;
        let newSavePassword = await bcrypt.hash(newPassword, 10);
        let userDB = await first_small(user.db_name);

        await userDB.users.update(
            { password: newSavePassword },
            {
                where: {
                    user_code: user.user_code,
                },
            }
        );
        userDB.sequelize.close();
        user.update({
            password: newSavePassword,
            password_reset_token: null,
            user_verify_otp: null,
            password_reset_expires: new Date(),
        });
        user.save();
        return res.status(200).json({
            status: 200,
            message: "password changed",
            data: user,
        });
    } catch (error) {
        logErrorToFile(error)
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong", data: error });
    }
};

exports.registerBulkUser = async (req, res) => {
    try {
        let userData = req.body;
        let depData = await req.config.departments.findAll();
        let divData = await req.config.divisions.findAll();
        let desData = await req.config.designations.findAll();
        let reportData = await req.config.users.findAll();

        let clientAdmin = await db.clients.findOne({
            where: {
                db_name: req.user.db_name,
                isDB: true,
            },
        });

        const count = await req.config.users.count({
            where: {
                isDB: false,
            },
        });

        if (count >= clientAdmin.no_of_license) {
            return await responseError(
                req,
                res,
                "cannot add more user, user count exceed the license count"
            );
        }

        if (
            parseInt(count) + parseInt(userData.length) >=
            clientAdmin.no_of_license
        ) {
            return await responseError(
                req,
                res,
                `can add bulk user ${parseInt(count) +
                parseInt(userData.length) -
                clientAdmin.no_of_license
                }`
            );
        }

        await Promise.all(
            userData.map(async (item, i) => {
                item.user = item["User Name"];
                item.user_code = randomCodeGenrator("USER");
                item.email = item["Email"] !== "" ? item["Email"] : null;
                item.contact_number =
                    item["Contact number"] !== "" ? item["Contact number"] : null;
                (item.password = await bcrypt.hash("12345", 10)),
                    (item.db_name = clientAdmin.db_name);
                item.country_id = 1;
                item.address = item["Address"] !== "" ? item["Address"] : null;
                item.pincode = item["Pincode"] !== "" ? item["Pincode"] : null;
                item.subscription_start_date = clientAdmin.subscription_start_date;
                item.subscription_end_date = clientAdmin.subscription_end_date;

                // divison map
                if (item["Divison"] !== "") {
                    await Promise.all(
                        divData.map((el, i) => {
                            if (item["Divison"] == el.dataValues.divison) {
                                item.div_id = el.dataValues.div_id;
                                return el;
                            }
                        })
                    );

                    if (item.div_id === undefined) {
                        item.div_id = null;
                    }
                } else {
                    item.div_id = null;
                }

                if (item["Department"] !== "") {
                    await Promise.all(
                        depData.map((el, i) => {
                            if (item["Department"] == el.dataValues.department) {
                                item.dep_id = el.dataValues.dep_id;
                                return el;
                            }
                        })
                    );

                    if (item.dep_id === undefined) {
                        item.dep_id = null;
                    }
                } else {
                    item.dep_id = null;
                }

                if (item["Designation"] !== "") {
                    await Promise.all(
                        desData.map((el, i) => {
                            if (item["Designation"] == el.dataValues.designation) {
                                item.des_id = el.dataValues.des_id;
                                return el;
                            }
                        })
                    );

                    if (item.des_id === undefined) {
                        item.des_id = null;
                    }
                } else {
                    item.des_id = null;
                }

                if (item["Report To"] !== "") {
                    await Promise.all(
                        reportData.map((el, i) => {
                            if (item["Report To"] == el.dataValues.user) {
                                item.report_to = el.dataValues.user_id;
                                return el;
                            }
                        })
                    );

                    if (item.report_to === undefined) {
                        item.report_to = null;
                    }
                } else {
                    item.report_to = null;
                }

                await db.clients.create(item);
                let dbUserData = await req.config.users.create(item);
                
                // Only include fields that belong to userProfile model
                let profileData = {
                    user_id: dbUserData.user_id,
                };
                
                const profileFields = ['div_id', 'dep_id', 'des_id', 'aadhar_no', 'aadhar_file', 
                    'pan_no', 'pan_file', 'dl_no', 'dl_file', 'rera_no', 'rera_file', 
                    'c_cheque', 'c_cheque_file', 'user_image_file', 'bank_name', 
                    'account_holder_name', 'account_no', 'bank_ifsc_code', 'branch',
                    'contact_person', 'credit_limit', 'incorporation_certificate', 
                    'payment_method', 'distributor_rating', 'address_proof', 
                    'gst_registration', 'banking_details'];
                
                profileFields.forEach(field => {
                    if (item[field] !== undefined && item[field] !== null) {
                        profileData[field] = item[field];
                    }
                });
                
                await req.config.usersProfiles.create(profileData);
                return item;
            })
        );

        return await responseSuccess(req, res, "Owner list", userData);
    } catch (error) {
        logErrorToFile(error)
        return await responseError(req, res, "Error", error);
    }
};

exports.registrationTokenVerification = async (req, res) => {
    try {
        const { token } = req.body;
        const decoded = await promisify(jwt.verify)(token, process.env.CLIENT_SECRET);
        const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
        if (decoded && decoded.exp < currentTime)
            return res
                .status(400)
                .json({ status: 400, message: "Token has expired" });
        //
        // console.log('decoded.db_name',decoded.db_name);
        let ud = await middle(decoded.db_name, req, res);

        if (!ud) {
            return res
                .status(400)
                .json({ status: 400, message: "Database not found" });
        }


        let user = await ud.users.findByPk(decoded.id);

        if (!user) {
            await ud.sequelize.close();
            return res
                .status(400)
                .json({ status: 400, message: "No  data found of channel partner" });
        }

        // Fetch CP lead data to auto-populate city and state
        let city_id = null;
        let state_id = null;
        let city_name = null;
        let state_name = null;

        try {
            // Find CP lead by email or contact number using raw SQL query
            const cpLeads = await ud.sequelize.query(`
                SELECT city_id, state_id, city, state 
                FROM db_channel_partner_leads 
                WHERE (email = :email OR contact = :contact)
                LIMIT 1
            `, {
                replacements: { 
                    email: user.email || '', 
                    contact: user.contact_number || null 
                },
                type: QueryTypes.SELECT
            });

            if (cpLeads && cpLeads.length > 0) {
                const cpLead = cpLeads[0];
                city_id = cpLead.city_id;
                state_id = cpLead.state_id;
                city_name = cpLead.city;
                state_name = cpLead.state;

                // If city_id/state_id exist but names don't, fetch them from database
                if (city_id && !city_name) {
                    const cityData = await ud.sequelize.query(`
                        SELECT city_name 
                        FROM db_city 
                        WHERE city_id = :city_id 
                        LIMIT 1
                    `, {
                        replacements: { city_id: city_id },
                        type: QueryTypes.SELECT
                    });
                    if (cityData && cityData.length > 0) {
                        city_name = cityData[0].city_name;
                    }
                }

                if (state_id && !state_name) {
                    const stateData = await ud.sequelize.query(`
                        SELECT state_name 
                        FROM db_states 
                        WHERE state_id = :state_id 
                        LIMIT 1
                    `, {
                        replacements: { state_id: state_id },
                        type: QueryTypes.SELECT
                    });
                    if (stateData && stateData.length > 0) {
                        state_name = stateData[0].state_name;
                    }
                }
            }
        } catch (leadError) {
            // Don't fail if CP lead lookup fails, just log it
            console.log('Error fetching CP lead data for auto-population:', leadError);
        }

        // Prepare response data with user info and auto-populated city/state
        const responseData = {
            ...user.dataValues,
            autoPopulatedCityId: city_id,
            autoPopulatedStateId: state_id,
            autoPopulatedCity: city_name,
            autoPopulatedState: state_name
        };

        // return res.send(user);
        await ud.sequelize.close();
        return res
            .status(200)
            .json({ status: 200, message: "User token verified.", data: responseData });
            console.log('User token verified.', responseData);
    } catch (error) {
        logErrorToFile(error)
        return res
            .status(400)
            .json({ status: 400, message: "Error", error: error });
    }
};

exports.cpCompleteRegistration = async (req, res) => {
    try {
        const { token, name, mobile, user_l_name, gst, organisation, address, city_id, state_id, city, state, cp_category } = req.body;
        const decoded = await promisify(jwt.verify)(token, process.env.CLIENT_SECRET);
        const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
        if (decoded && decoded.exp < currentTime)
            return res
                .status(400)
                .json({ status: 400, message: "Token has expired" });

        const hasState = (state && String(state).trim().length > 0) || state_id;
        const hasCity = (city && String(city).trim().length > 0) || city_id;

        if (!hasState) {
            return res.status(400).json({ status: 400, message: "State is mandatory for Channel Partner registration" });
        }

        if (!hasCity) {
            return res.status(400).json({ status: 400, message: "City is mandatory for Channel Partner registration" });
        }
        //
        // console.log('decoded.db_name',decoded.db_name);
        let ud = await first_small(decoded.db_name, req, res);
        if (!ud)
            return res
                .status(400)
                .json({ status: 400, message: "Database not found" });

        let user = await ud.users.findByPk(decoded.id);
        if (!user) {
            await ud.sequelize.close();
            return res.status(400).json({ status: 400, message: "No data found of channel partner" });
        }
        if (!req.files || !req.files.aadhar) {
            await ud.sequelize.close();
            return res
                .status(400)
                .json({ status: 400, message: "Aadhar is required." });
        }

        if (!req.files || !req.files.pan) {
            await ud.sequelize.close();
            return res.status(400).json({ status: 400, message: "Pan is required." });
        }
        if (!req.files || !req.files.rera) {
            await ud.sequelize.close();
            return res
                .status(400)
                .json({ status: 400, message: "Rera is required." });
        }


        var aadhar = "";
        var pan = "";
        var rera = "";
        var cheque = "";

        if (req.files && req.files.aadhar) {
            aadharName = await fileUpload.imageExport(req, res, "adh", "aadhar");
            aadhar = aadharName;
        }
        if (req.files && req.files.pan) {
            panName = await fileUpload.imageExport(req, res, "pan", "pan");
            pan = panName;
        }
        if (req.files && req.files.rera) {
            reraName = await fileUpload.imageExport(req, res, "rera", "rera");
            rera = reraName;
        }
        if (req.files && req.files.cheque) {
            chequeName = await fileUpload.imageExport(req, res, "cheque", "cheque");
            cheque = chequeName;
        }

        user.user = name;
        user.contact_number = mobile;
        user.doc_verification = 1;

        // Separate data for user table and userProfile table
        let userUpdateData = {};
        userUpdateData.user_l_name = user_l_name;
        userUpdateData.gst = gst;
        userUpdateData.organisation = organisation;
        userUpdateData.address = address;
        userUpdateData.country_id = 101;
        // Note: state and city fields removed from model - use state_id and city_id instead
        if (state_id) userUpdateData.state_id = state_id;
        if (city_id) userUpdateData.city_id = city_id;
        if (cp_category) userUpdateData.cp_category = cp_category;

        let profileUpdateData = {};
        profileUpdateData.aadhar_file = aadhar;
        profileUpdateData.pan_file = pan;
        profileUpdateData.rera_file = rera;
        profileUpdateData.c_cheque_file = cheque;
        profileUpdateData.user_id = decoded.id;

        let userProfile = await ud.usersProfiles.findOne({
            where: {
                user_id: decoded.id,
            },
        });

        if (userProfile) {
            // Update existing record
            await user.update(userUpdateData);
            await userProfile.update(profileUpdateData);
        } else {
            // Create new record
            await user.update(userUpdateData);
            userProfile = await ud.usersProfiles.create(profileUpdateData);
        }
        // First profile save then save user
        await user.save();

        // Send notification to Supervisor when CP submits onboarding form
        try {
            // Find all Supervisor users (role_id = 3) to notify them
            const supervisorUsers = await ud.users.findAll({
                where: {
                    role_id: 3, // Supervisor/Director role
                    user_status: true,
                    deletedAt: null
                },
                attributes: ['user_id', 'user', 'email', 'user_l_name']
            });

            if (supervisorUsers && supervisorUsers.length > 0) {
                // Get company name
                let company_name = 'Srijan Bandhan';
                const company = await ud.organisationInfo.findOne({
                    attributes: ['company_name']
                });
                if (company) {
                    company_name = company.company_name || 'Srijan Bandhan';
                }

                // Get email template (use template_id 9 for CP lead notification, or create a new one)
                let emailTemplate;
                try {
                    emailTemplate = await ud.emailTemplates.findOne({ where: { template_id: 9 } }); // New CP Lead Template
                } catch (err) {
                    console.log('Email template not found, using default');
                }

                // Prepare email content
                const cpName = `${name} ${user_l_name || ''}`.trim();
                const cpEmail = user.email || '';
                const cpContact = mobile || '';

                let htmlContent = '';
                if (emailTemplate && emailTemplate.template) {
                    htmlContent = emailTemplate.template
                        .replace(/{{UsersName}}/g, cpName)
                        .replace(/{{Name}}/g, cpName)
                        .replace(/{{BDName}}/g, cpName)
                        .replace(/{{PhoneNo}}/g, cpContact)
                        .replace(/{{EmailID}}/g, cpEmail)
                        .replace(/{{CompanyName}}/g, company_name);
                } else {
                    // Default email content if template not found
                    htmlContent = `
                        <p>Dear Supervisor,</p>
                        <p>A Channel Partner has submitted their onboarding form and is waiting for your approval.</p>
                        <p><strong>Channel Partner Details:</strong></p>
                        <ul>
                            <li>Name: ${cpName}</li>
                            <li>Email: ${cpEmail}</li>
                            <li>Contact: ${cpContact}</li>
                        </ul>
                        <p>Please review and approve the Channel Partner's request.</p>
                        <p>Best regards,<br>${company_name}</p>
                    `;
                }

                // Send email to each Supervisor
                for (const supervisor of supervisorUsers) {
                    if (supervisor.email) {
                        const emailOptions = {
                            email: supervisor.email,
                            subject: `Channel Partner Onboarding Request - ${cpName}`,
                            message: htmlContent,
                        };
                        await sendEmail(emailOptions).catch(err => {
                            console.error(`Failed to send email to supervisor ${supervisor.email}:`, err);
                        });
                    }
                }
            }
        } catch (notificationError) {
            // Don't fail the request if notification fails
            console.error('Error sending notification to Supervisor:', notificationError);
        }

        await ud.sequelize.close();
        return res.status(200).json({
            status: 200,
            message: "Channel partner document uploaded.",
            data: null
        });
    } catch (error) {
        logErrorToFile(error)
        return res
            .status(400)
            .json({ status: 400, message: "Error", error: error });
    }
};

exports.getPendingVerificationUser = async (req, res) => {
    try {
        let usersData = null;
        let whereClause = {
            doc_verification: {
                [Op.in]: [0, 1, 3],
            },
            role_id: 1,
        };
        if (req.query.id) {
            whereClause.user_code = req.query.id;
            usersData = await req.config.users.findOne({
                where: whereClause,
                attributes: {
                    exclude: [
                        "password",
                        "password_reset_token",
                        "password_reset_expires",
                        "deletedAt",
                    ],
                },
                include: [
                    {
                        model: req.config.users,
                        as: "reportToUser",
                        attributes: {
                            include: ["user", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.usersProfiles,
                        include: [
                            {
                                model: req.config.divisions,
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                            {
                                model: req.config.departments,
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                            {
                                model: req.config.designations,
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                        ],
                    },
                    {
                        model: req.config.user_role,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.country,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.states,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.city,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                ],
            });
        } else {
            // For CP (role_id = 1) with doc_verification = 1 (submitted form), only Supervisor and Admin can see them
            // BST (role_id = 2) should NOT see CP pending verifications after form submission
            if (req.user.isDB) {
                // Admin can see ALL CP pending verifications (no restrictions)
                // No need to modify whereClause - Admin sees everything
            } else if (req.user.role_id == 2) {
                // BST should NOT see CP pending verifications after form submission (doc_verification = 1)
                // Only show CPs with doc_verification = 0 (link sent but not submitted) or doc_verification = 3 (rejected)
                // Exclude doc_verification = 1 (submitted form, pending Supervisor/Admin approval)
                whereClause.doc_verification = {
                    [Op.in]: [0, 3] // Only show link sent or rejected, not submitted
                };
                whereClause.report_to = req.user.user_id;
            } else if (req.user.role_id == 3) {
                // Supervisor can see ALL CP pending verifications (including doc_verification = 1)
                // Find all BSTs that report to this Supervisor
                const bstUser = await req.config.users.findAll({
                    where: { report_to: req.user.user_id, role_id: 2 },
                    attributes: ['user_id']
                });

                const bstUserIds = bstUser.map(user => user.user_id);

                // Build report_to condition for Supervisor
                if (bstUserIds.length > 0) {
                    // Show CPs that report to BSTs under this Supervisor, OR CPs that report directly to Supervisor, OR CPs with no report_to
                    // Combine all user IDs (BSTs + Supervisor)
                    const allUserIds = [...bstUserIds, req.user.user_id];
                    whereClause.report_to = {
                        [Op.or]: [
                            { [Op.in]: allUserIds },
                            { [Op.is]: null }
                        ]
                    };
                } else {
                    // Show CPs that report to Supervisor or have no report_to
                    whereClause.report_to = {
                        [Op.or]: [
                            req.user.user_id,
                            { [Op.is]: null }
                        ]
                    };
                }
                // Supervisor can see all doc_verification statuses (0, 1, 3) - no change to doc_verification filter
            } else {
                // For other roles, use existing logic
                whereClause.report_to = req.user.user_id;
            }
        }
        usersData = await req.config.users.findAll({
                where: whereClause,
                attributes: {
                    exclude: [
                        "password",
                        "password_reset_token",
                        "password_reset_expires",
                        "deletedAt",
                    ],
                },
                include: [
                    {
                        model: req.config.users,
                        as: "reportToUser",
                        attributes: {
                            include: ["user", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.usersProfiles,
                        include: [
                            {
                                model: req.config.divisions,
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                            {
                                model: req.config.departments,
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                            {
                                model: req.config.designations,
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                        ],
                    },
                    {
                        model: req.config.user_role,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.country,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.states,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.city,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                ],
                order: [["user_id", "DESC"]],
            });
        return responseSuccess(req, res, "User list fetch successfully.", usersData);

    } catch (error) {
        logErrorToFile(error)
        console.log("error", error);
        return res
            .status(400)
            .json({ status: 400, message: "Error", error: error });
    }
};

exports.addCustomerPartnerType = async (req, res) => {
    try {
        const { name } = req.body
        let dbName = await req.config.channelPartnerType.findOne({
            where: { name: name }
        })
        await req.config.channelPartnerType.create({ name: name })
        return res.status(200).json({ status: 200, message: "Channel Partner Created Succesfully" });
    } catch (error) {
        console.log(error);
        return res.status(400).json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.editCustomerPartnerType = async (req, res) => {
    try {
        const { cpt_id, name } = req.body

        let dbName = await req.config.channelPartnerType.update(
            { name: name }, {
            where: { cpt_id: cpt_id }
        })
        return res.status(200).json({ status: 200, message: "Channel Partner Created Succesfully" });
    } catch (error) {
        console.log(error);
        return res.status(400).json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.deleteCustomerPartnerType = async (req, res) => {
    try {
        const { cpt_id } = req.query
        let dbName = await req.config.channelPartnerType.findOne({
            where: { cpt_id: cpt_id }
        })
        await dbName.destroy()
        return res.status(200).json({ status: 200, message: "Channel Partner Created Succesfully" });
    } catch (error) {
        console.log(error);
        return res.status(400).json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.getCustomerPartnerType = async (req, res) => {
    try {
        let data = await req.config.channelPartnerType.findAll({ attributes: ['cpt_id', 'name'] })
        return res.status(200).json({ status: 200, message: "Channel Partner Fetched Succesfully", data });
    } catch (error) {
        console.log(error);
        return res.status(400).json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.storeExtraUser = async (req, res) => {
    const process = await req.config.sequelize.transaction();
    try {
        const userExtraBody = req.body

        if (!userExtraBody || userExtraBody.length == 0) {
            return await responseSuccess(req, res, "User extra data submitted successfully")
        }

        const existingFieldsArrayInUsers = [
            "User Profile *", "Name *", "Last Name *", "User Profile", "Name", "Last Name", "Contact No", "Email *", "Email", "Division", "Department", "Designation", "Report/Assign To *", "Report/Assign To", "Assign To", "Report To", "Optional Detail", "Address", "Country", "State", "City", "Zip / Postal Code", "Aadhar Card", "Upload Aadhar Card", "Pan Card", "GST Number", "Organisation", "Upload Pan Card", "Driving License *", "Driving License", "Upload Driving License", "Bank Name", "Account Holder Name", "Account Number", "Bank IFSC Code", "Branch", "Bank Cancelled Cheque"
        ];

        const customDuplicateEntries = userExtraBody.filter(field => {
            return existingFieldsArrayInUsers.includes(field.field_lable);
        });

        if (customDuplicateEntries.length > 0) {
            return await responseError(req, res, `${customDuplicateEntries.length} fields are duplicates default fields.`);
        }

        const duplicateEntries = await req.config.userFieldModel.findAll({
            where: {
                [Op.in]: userExtraBody.map(field => ({
                    field_lable: field.field_lable.trim(),
                }))

            },
            attributes: ['field_lable']
        });

        if (duplicateEntries.length > 0) {
            return await responseError(req, res, `${duplicateEntries.length} fields are duplicate.`)
        }

        let userExtraData = await req.config.userFieldModel.bulkCreate(userExtraBody, { updateOnDuplicate: ["user_field_id", "field_lable", "user", "field_name", "field_order", "option", "input_value", "input_type", "field_type", "field_size"] })
        await process.commit();
        await responseSuccess(req, res, "User extra data submitted successfully", userExtraData)

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        await process.rollback();
        await responseError(req, res, "Something Went Wrong")
    }
}

exports.resendEmailToPendingUser = async (req, res) => {
    try {
        let { user_id } = req.body;

        let dbUserData = await req.config.users.findOne({ where: { user_id: user_id } });
        let clientDBUser = await db.clients.findOne({ where: { user_code: dbUserData.user_code, }, });
        let option = {};
        if (dbUserData.role_id === 1) {
            await dbUserData.update({ doc_verification: 0 })
            await clientDBUser.update({ doc_verification: 0 })
            let registrationToken = jwt.sign(
                { id: dbUserData.user_id, db_name: req.user.db_name },
                process.env.CLIENT_SECRET,
                {
                    expiresIn: process.env.CP_SIGNUP_EXPIRES,
                }
            );

            const signupLink = `${req.admin.client_url}/partner/Signup?token=${registrationToken}`;
            console.log("111",signupLink);
            

            // const htmlTemplatePath = path.join(
            //     __dirname,
            //     "..",
            //     "mail",
            //     "cp",
            //     "signup.html"
            // );
            // const htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");

            let BdData = {
                user: "",
                user_l_name: "",
                contact_number: "",
                email: ""
            };
            if (req.body.report_to) {
                BdData = await req.config.users.findOne({
                    where: { user_id: req.body.report_to },
                    attributes: ['user', 'user_l_name', 'email', 'contact_number'],
                })
            }

            const htmlTemplate = await req.config.emailTemplates.findOne({ where: { template_id: 8 } }) // Signup Link Send
            const template = htmlTemplate.template
            let company_name
            let company = await req.config.organisationInfo.findOne({
                attributes: ['company_name']
            })
            if (company) {
                company_name = company.company_name || 'Srijan Bandhan'
            }
            else {
                company_name = 'Srijan Bandhan'
            }
            const htmlContent = template
                .replace(/{{signupLink}}/g, signupLink)
                .replace(/{{CompanyName}}/g, company_name)
                .replace(/{{BDName}}/g, `${BdData.user ?? ""} ${BdData.user_l_name ?? ""}`)
                .replace(/{{PhoneNo}}/g, BdData.contact_number ?? "")
                .replace(/{{EmailID}}/g, BdData.email ?? "")
            // const htmlContent = template.replace(/{{signupLink}}/g, signupLink).replace(/{{CompanyName}}/g, company_name);
            option = {
                email: dbUserData.email,
                subject: "Srijan Bandhan",
                message: htmlContent,
            };

        } else {
            const resetToken = crypto.randomBytes(32).toString("hex");
            dbUserData.password_reset_token = crypto
                .createHash("sha256")
                .update(resetToken)
                .digest("hex");

            // const htmlTemplatePath = path.join(
            //     __dirname,
            //     "..",
            //     "mail",
            //     "cp",
            //     "welcome.html"
            // );
            // const htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");

            const resetLink = `${req.admin.client_url}/ChangePassword?tkn=u$34${dbUserData.password_reset_token}`;

            const htmlTemplate = await req.config.emailTemplates.findOne({ where: { template_id: 28 } }) // Password Reset Template
            const template = htmlTemplate.template

            let company_name
            let company = await req.config.organisationInfo.findOne({
                attributes: ['company_name']
            })
            if (company) {
                company_name = company.company_name || 'Srijan Bandhan'
            }
            else {
                company_name = 'Srijan Bandhan'
            }

            let htmlContent = template.replace(/{{resetLink}}/g, resetLink);
            htmlContent = htmlContent.replace(/{{UsersName}}/, dbUserData.user ? dbUserData.user : "User").replace(/{{CompanyName}}/g, company_name);
            option = {
                email: dbUserData.email,
                subject: "Srijan Bandhan",
                message: htmlContent,
            };
        }
        await sendEmail(option);
        return await responseSuccess(req, res, "Mail Sent successfully");
    } catch (error) {
        logErrorToFile(error)
        console.log(error);
        return await responseError(req, res, "Something Went Wrong");
    }
}

exports.dmsRegistrationTokenVerification = async (req, res) => {
    try {
        const { token } = req.body;
        const decoded = await promisify(jwt.verify)(token, process.env.CLIENT_SECRET);
        const currentTime = Math.floor(Date.now() / 1000);
        if (decoded && decoded.exp < currentTime)
            return res.status(400).json({ status: 400, message: "Token has expired" });

        let ud = await middle(decoded.db_name, req, res);

        if (!ud) {
            return res.status(400).json({ status: 400, message: "Database not found" });
        }

        let user = await ud.users.findOne({
            where: { user_id: decoded.id },
            include: [
                {
                    model: ud.usersProfiles, paranoid: false
                },

            ],
        });

        if (!user) {
            await ud.sequelize.close();
            return res
                .status(400)
                .json({ status: 400, message: "No data found of Distributor" });
        }

        await ud.sequelize.close();
        return res.status(200).json({ status: 200, message: "User token verified.", data: user });
    } catch (error) {
        logErrorToFile(error)
        return res.status(400).json({ status: 400, message: "Error", error: error });
    }
};

exports.getPendingVerificationMasturbators = async (req, res) => {
    try {
        let usersData = null;
        let whereClause = {
            doc_verification: {
                [Op.or]: [0, 1, 3],
            },
            role_id: 10,
        };
        if (req.query.id) {
            whereClause.user_code = req.query.id;
            usersData = await req.config.users.findOne({
                where: whereClause,
                attributes: {
                    exclude: [
                        "password",
                        "password_reset_token",
                        "password_reset_expires",
                        "deletedAt",
                    ],
                },
                include: [
                    {
                        model: req.config.usersProfiles,
                        include: [
                            {
                                model: req.config.divisions,
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                            {
                                model: req.config.departments,
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                            {
                                model: req.config.designations,
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                        ],
                    },
                    {
                        model: req.config.user_role,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.country,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.states,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.city,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                ],
            });
        } else {
            usersData = await req.config.users.findAll({
                where: {
                    doc_verification: {
                        [Op.or]: [0, 1, 3],
                    },
                    role_id: 10,
                },
                attributes: {
                    exclude: [
                        "password",
                        "password_reset_token",
                        "password_reset_expires",
                        "deletedAt",
                    ],
                },
                include: [
                    {
                        model: req.config.usersProfiles,
                        include: [
                            {
                                model: req.config.divisions,
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                            {
                                model: req.config.departments,
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                            {
                                model: req.config.designations,
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                        ],
                    },
                    {
                        model: req.config.user_role,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.country,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.states,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.city,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                ],
                order: [["user_id", "DESC"]],
            });
        }
        return responseSuccess(req, res, "User list fetch successfully.", usersData);

    } catch (error) {
        logErrorToFile(error)
        console.log("error", error);
        return res
            .status(400)
            .json({ status: 400, message: "Error", error: error });
    }
};

exports.dmsCompleteRegistration = async (req, res) => {
    try {
        const { token, name, mobile, user_l_name, gst, organisation, address, city_id, state_id } = req.body;
        const decoded = await promisify(jwt.verify)(token, process.env.CLIENT_SECRET);
        const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds

        if (decoded && decoded.exp < currentTime) {
            return res.status(400).json({ status: 400, message: "Token has expired" });
        }

        let ud = await first_small(decoded.db_name, req, res);

        if (!ud) {
            return res.status(400).json({ status: 400, message: "Database not found" });
        }

        let user = await ud.users.findByPk(decoded.id);

        if (!user) {
            await ud.sequelize.close();
            return res.status(400).json({ status: 400, message: "No data found of Distrubutor" });
        }
        if (!req.files || !req.files.banking_details) {
            await ud.sequelize.close();
            return res.status(400).json({ status: 400, message: "Banking Details is required." });
        }
        if (!req.files || !req.files.pan_file) {
            await ud.sequelize.close();
            return res.status(400).json({ status: 400, message: "Pan is required." });
        }
        if (!req.files || !req.files.incorporation_certificate) {
            await ud.sequelize.close();
            return res.status(400).json({ status: 400, message: "Certificate of Incorporation is required." });
        }
        if (!req.files || !req.files.address_proof) {
            await ud.sequelize.close();
            return res.status(400).json({ status: 400, message: "Address Proof is required." });
        }
        if (!req.files || !req.files.gst_registration) {
            await ud.sequelize.close();
            return res.status(400).json({ status: 400, message: "GST Registration is required." });
        }

        var aadhar = "";
        var pan = "";
        var inc_cer = "";
        var add_pr = "";
        var gst_reg = "";
        var banking_details = "";

        if (req.files && req.files.aadhar) {
            aadhar = await fileUpload.imageExport(req, res, "adh", "aadhar");
        }
        if (req.files && req.files.pan_file) {
            pan = await fileUpload.imageExport(req, res, "pan", "pan_file");
        }
        if (req.files && req.files.incorporation_certificate) {
            inc_cer = await fileUpload.imageExport(req, res, "incorporation_certificate", "incorporation_certificate");
        }
        if (req.files && req.files.address_proof) {
            add_pr = await fileUpload.imageExport(req, res, "address_proof", "address_proof");
        }
        if (req.files && req.files.gst_registration) {
            gst_reg = await fileUpload.imageExport(req, res, "gst_registration", "gst_registration");
        }
        if (req.files && req.files.banking_details) {
            banking_details = await fileUpload.imageExport(req, res, "banking_details", "banking_details");
        }

        user.user = req.body.user;
        user.contact_number = req.body.contact_number;
        user.doc_verification = 1;

        // Separate data for user table and userProfile table
        let userUpdateData = {};
        userUpdateData.user_l_name = user_l_name;
        userUpdateData.organisation = organisation;
        userUpdateData.address = address;
        userUpdateData.country_id = 101;
        if (city_id) userUpdateData.city_id = city_id;
        if (state_id) userUpdateData.state_id = state_id;

        let profileUpdateData = {};
        profileUpdateData.aadhar_file = aadhar;
        profileUpdateData.pan_file = pan;
        profileUpdateData.incorporation_certificate = inc_cer;
        profileUpdateData.address_proof = add_pr;
        profileUpdateData.banking_details = banking_details;
        profileUpdateData.gst_registration = gst_reg;
        profileUpdateData.user_id = decoded.id;

        let userProfile = await ud.usersProfiles.findOne({
            where: {
                user_id: decoded.id,
            },
        });

        if (userProfile) {
            await user.update(userUpdateData);
            await userProfile.update(profileUpdateData);
        } else {
            await user.update(userUpdateData);
            userProfile = await ud.usersProfiles.create(profileUpdateData);
        }

        await user.save();

        await ud.sequelize.close();
        return res.status(200).json({
            status: 200,
            message: "Distributor Documents Uploaded Successfully.",
            data: null
        });
    } catch (error) {
        logErrorToFile(error)
        return res
            .status(400)
            .json({ status: 400, message: "Error", error: error });
    }
};

exports.uploadsUserImagesDMS = async (req, res) => {
    try {
        let { path } = req.body;
        let updateData = req.body;
        const data = await fileUpload.imageExport(req, res, path);
        if (!data.message) {
            if (path === "adh") {
                updateData.aadhar_file = data;
            }
            else if (path === "pan") {
                updateData.pan_file = data;
            }
            else if (path === "dl") {
                updateData.dl_file = data;
            }
            else if (path === "lsUser") {
                updateData.user_image_file = data;
            }
            else if (path === "cheque") {
                updateData.c_cheque_file = data;
            }
            else if (path === "rera") {
                updateData.rera_file = data;
            }
            else if (path === "incorporation_certificate") {
                updateData.incorporation_certificate = data;
            }
            else if (path === "gst_registration") {
                updateData.gst_registration = data;
            }
            else if (path === "address_proof") {
                updateData.address_proof = data;
            }

            let see = await req.config.usersProfiles.update(updateData, {
                where: {
                    user_id: updateData.user_id,
                },
            });

            return await responseSuccess(
                req,
                res,
                "document uploaded successfully",
                see
            );
        } else {
            return await responseError(req, res, "Something Went Wrong");
        }
    } catch (error) {
        logErrorToFile(error)
        return await responseError(req, res, "Something Went Wrong");
    }
};

exports.sendMailToReportTos = async (req) => {
    try {
        console.log('Cron sendMailToReportTos Started ====>>', new Date())
        const admin = await req.users.findOne({ where: { isDB: 1 } })
        const adminEmail = admin.email
        if (!adminEmail) {
            console.log('No Admin Email Found.');
            return;
        }
        const pendingRequests = await req.users.findAll({
            where: {
                doc_verification: {
                    [Op.or]: [0, 1],
                },
                mailSent: { [Op.in]: [null, false] },
                role_id: 1,
                createdAt: {
                    [Op.lte]: moment().subtract(72, 'hours').toDate() // Reqests older than 72 hours
                }
            }
        });

        if (pendingRequests.length === 0) {
            console.log('No Requests found.');
            return;
        }

        const emailTemplate = await req.emailTemplates.findOne({ where: { template_id: 3 } }) // Pending Channel Partner Request Notification (72 Hrs)

        const htmlTemplatePath = path.join(
            __dirname,
            "..",
            "mail",
            "cp",
            "pendingCPRequests.html"
        );
        const htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");
        for (const request of pendingRequests) {

            let company_name
            let company = await req.config.organisationInfo.findOne({
                attributes: ['company_name']
            })
            if (company) {
                company_name = company.company_name || 'Srijan Bandhan'
            }
            else {
                company_name = 'Srijan Bandhan'
            }

            let htmlContent = htmlTemplate.replace("{{user}}", request.user ? request.user : request?.dataValues?.user);
            htmlContent = htmlContent.replace("{{contact_number}}", request.contact_number);
            htmlContent = htmlContent.replace("{{EmailID}}", request.email).replace(/{{CompanyName}}/g, company_name);

            let option = {
                email: adminEmail,
                subject: "Srijan Bandhan",
                message: htmlContent,
            };
            await sendEmail(option);

            let reportTo = await req.users.findByPk(request.report_to)

            if (!reportTo) {
                console.log(`No reporting manager for request ${request.user}`)
            }
            else {
                if (!reportTo.email) {
                    console.log(`No reporting manager email found for request ${request.user}`)
                }
                else {
                    let option = {
                        email: reportTo.email,
                        subject: "Srijan Bandhan",
                        message: htmlContent,
                    };
                    await sendEmail(option);
                }
            }
            await request.update({ mailSent: true })
        }
        console.log('Emails sent successfully');
        return
    } catch (error) {
        console.error('Error in cron requests:', error);
    }
}


