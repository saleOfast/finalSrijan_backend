const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const { PREFIX } = require('../config/constant')
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../model");
const { promisify } = require('util');
const { first } = require("../connectionResolver/firstConnection");
const { first_small } = require("../connectionResolver/firstConnection_small.js");
const fileUpload = require("../common/imageExport");
const crypto = require("crypto");
const sendEmail = require("../common/mailer");
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const dbConfig = require("../config/db.config.js");
const { middle } = require("../connectionResolver/middleConnection.js");

const Client = db.clients;
const Super = db.supers;

const randomCodeGenrator = (name) => {
    var result = "";
    result = Math.floor(10000000 + Math.random() * 90000000);
    var code = name + result;
    return code;
};

exports.admin = async (req, res) => {
    try {
        let { email, password } = req.body;
        let userData = await Super.findOne({
            where: {
                email: email,
            },
        });
        if (!userData)
            return res.status(400).json({ status: 400, data: "email not found" });
        const isSame = await bcrypt.compare(password, userData.password);
        if (userData && isSame) {
            let token = jwt.sign({ id: userData.superCode }, process.env.CLIENT_SECRET, {
                expiresIn: process.env.expiresIn,
            });
            let obj = {
                user_id: userData.user_id,
                login_time: Date.now(),
                db_name: 'db_supers',
                IP_address: req.connection.remoteAddress,
                role_id: '0',
            }
            await db.loginLogger.create(obj)
            return res.status(200).json({ userData, token });
        } else {
            return res.status(400).json({ message: "Auth Failed" });
        }
    } catch (error) {
        logErrorToFile(error)
        console.log(error);
        return res.status(400).json({ message: "sonething went wrong" });
    }
};


exports.getSuperAdminDetail = async (req, res) => {
    try {
        let superAdminData = await Super.findByPk(1, {
            attributes: {
                exclude: ["password"],
            },
        });
        if (!superAdminData)
            return res
                .status(404)
                .json({ status: 404, message: "super admin not found" });
        return res
            .status(200)
            .json({ status: 200, message: "super admin data", data: superAdminData });
    } catch (error) {
        logErrorToFile(error)
        console.log(error);
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.editAdminProfile = async (req, res) => {
    try {
        let body = req.body;
        let userData = await Super.findByPk(body.user_id);
        if (!userData)
            return res
                .status(404)
                .json({ status: 404, message: "Something Went Wrong" });
        if (body.password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(body.password, salt);
            body.password = hashedPassword;
        }
        await userData.update(body);
        return res
            .status(200)
            .json({ status: 200, message: "profile updated successfully" });
    } catch (error) {
        logErrorToFile(error)
        console.log(error);
        return res
            .status(400)
            .json({ status: 400, message: "sonething went wrong" });
    }
};

exports.editAdminProfileIMG = async (req, res) => {
    try {
        let { path, user_id } = req.body;
        const data = await fileUpload.imageExport(req, res, path);
        if (!data.message) {
            let updatedIcon = await Super.update(
                { profile_img: data },
                {
                    where: {
                        user_id: user_id,
                    },
                }
            );
            return res
                .status(200)
                .json({
                    status: 200,
                    message: "profile image updated",
                    data: updatedIcon,
                });
        } else {
            return res
                .status(400)
                .json({ status: 400, message: "image cannot updated" });
        }
    } catch (error) {
        logErrorToFile(error)
        console.log(error, "error on send");
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.db_creater = async (req, res) => {
    const process = await db.sequelize.transaction();
    try {
        let {
            user,
            email,
            contact_number,
            subscription_start_date,
            subscription_end_date,
            subscription_start_date_channel,
            subscription_end_date_channel,
            subscription_start_date_dms,
            subscription_end_date_dms,
            subscription_start_date_sales,
            subscription_end_date_sales,
            subscription_start_date_media,
            subscription_end_date_media,
            country_id,
            state_id,
            district_id,
            city_id,
            domain,
            no_of_months,
            no_of_license,
            no_of_channel_license,
            no_of_dms_license,
            no_of_sales_license,
            no_of_media_license,
            sidebar_color,
            button_color,
            text_color,
            gst,
            pan,
            address,
            pincode,
            isCRM,
            isDMS,
            isSALES,
            isCHANNEL,
            isMEDIA,
            client_url,
            host_name
        } = req.body;
        let userCode = randomCodeGenrator("USER");
        let userPassword = await bcrypt.hash(userCode, 10);

        let hostURLExist = await Client.findOne({
            where: {
                host_name: host_name
            }
        })
        if (hostURLExist) {
            await process.cleanup();
            return res.status(400).json({ message: "Salesforce host name already exist" });
        }

        let clientURLExist = await Client.findOne({
            where: {
                client_url: client_url
            }
        })
        if (clientURLExist) {
            await process.cleanup();
            return res.status(400).json({ message: "Client URL already exist" });
        }

        console.log("alll", typeof subscription_start_date_dms,
            subscription_start_date_dms,
            subscription_end_date_dms,
            subscription_start_date_sales,
            subscription_end_date_sales,)

        // creating client data for super admin DB oin clinet table
        let data = {
            user,
            user_code: userCode,
            email,
            contact_number: contact_number,
            doc_verification: 2,
            password: userPassword,
            db_name: `${PREFIX}${userCode}`,
            report_to: null,
            domain: domain && domain != undefined && domain != null ? domain : null,
            no_of_months: 0,
            client_url,
            no_of_license: !no_of_license ? 0 : no_of_license,
            no_of_channel_license: !no_of_channel_license ? 0 : no_of_channel_license,
            no_of_dms_license: !no_of_dms_license ? 0 : no_of_dms_license,
            no_of_sales_license: !no_of_sales_license ? 0 : no_of_sales_license,
            no_of_media_license: !no_of_media_license ? 0 : no_of_media_license,
            sidebar_color: sidebar_color || '#405189',
            button_color: button_color || '#405189',
            text_color: text_color || '#405189',
            top_nav_color: text_color || '#405189',
            gst: gst && gst != undefined && gst != null ? gst : null,
            pan: pan && pan != undefined && pan != null ? pan : null,
            address: address && address != undefined && address != null ? address : null,
            host_name: host_name && host_name != undefined && host_name != null ? host_name : null,
        };

        if (subscription_start_date != "null" && subscription_start_date) {
            data.subscription_start_date = subscription_start_date
            data.subscription_end_date = subscription_end_date
        }

        if (subscription_start_date_channel != "null" && subscription_start_date_channel) {
            data.subscription_start_date_channel = subscription_start_date_channel
            data.subscription_end_date_channel = subscription_end_date_channel
        }

        if (subscription_start_date_dms != "null" && subscription_start_date_dms) {
            data.subscription_start_date_dms = subscription_start_date_dms
            data.subscription_end_date_dms = subscription_end_date_dms
        }

        if (subscription_start_date_sales != "null" && subscription_start_date_sales) {
            data.subscription_start_date_sales = subscription_start_date_sales
            data.subscription_end_date_sales = subscription_end_date_sales
        }

        if (subscription_start_date_media != "null" && subscription_start_date_media) {
            data.subscription_start_date_media = subscription_start_date_media
            data.subscription_end_date_media = subscription_end_date_media
        }


        if (data.client_url.endsWith('/')) {
            data.client_url = data.client_url.slice(0, -1);
        }

        // if (data.client_url) {
        //   if (data.client_url.charAt(data.client_url.length - 1) === '/') {

        //     data.client_url.splice(data.client_url.length - 1)
        //   }
        // }

        // find wether the db name exist or not in clinet table


        let userData = await Client.findOne(
            {
                where: {
                    db_name: `${PREFIX}${userCode}`,
                },
            },
            { transaction: process }
        );

        if (userData) {
            await process.cleanup();
            return res.status(400).json({ message: "DB existed" });
        } else {
            let isEmail = await Client.findOne(
                {
                    where: {
                        email: email,
                    },
                },
                { transaction: process }
            );

            if (isEmail) {
                await process.cleanup();
                return res.status(400).json({ message: "email already existed" });
            }

            await db.sequelize.query(`CREATE DATABASE ${PREFIX}${userCode};`, {
                transaction: process,
            });

            const resetToken = crypto.randomBytes(32).toString("hex");
            data.password_reset_token = crypto
                .createHash("sha256")
                .update(resetToken)
                .digest("hex");

            // const message = `Welcome to the NK Realtors. We are glad you became part of us .<br/> Click this link to reset your password : <a href="http://crm.cybermatrixsolutions.com/ChangePassword?tkn=u$34${data.password_reset_token}" target="_blank"><b> Click here </b></a>:`;
            const message = `Welcome to the NK Realtors. We are glad you became part of us .<br/> Click this link to reset your password : <a href="${client_url}/ChangePassword?tkn=u$34${data.password_reset_token}" target="_blank"><b> Click here </b></a>:`;
            console.log(message);

            let option = {
                email: email,
                subject: "NK Realtors",
                message: message,
            };
            await sendEmail(option);
            data.isDB = true;

            let logoImage = "";
            let client_image_1 = "";
            let client_image_2 = "";
            let client_image_3 = "";
            let client_image_4 = "";
            if (req.files && req.files.logo) {
                logoImage = await fileUpload.imageExport(req, res, "logo", "logo");
                data.logo = logoImage;
            }

            if (req.files && req.files.client_image_1) {
                client_image_1 = await fileUpload.imageExport(req, res, "clientdoc", "client_image_1");
                data.client_image_1 = client_image_1;
            }

            if (req.files && req.files.client_image_2) {
                client_image_2 = await fileUpload.imageExport(req, res, "clientdoc", "client_image_2");
                data.client_image_2 = client_image_2;
            }

            if (req.files && req.files.client_image_3) {
                client_image_3 = await fileUpload.imageExport(req, res, "clientdoc", "client_image_3");
                data.client_image_3 = client_image_3;
            }

            if (req.files && req.files.client_image_4) {
                client_image_4 = await fileUpload.imageExport(req, res, "clientdoc", "client_image_4");
                data.client_image_4 = client_image_4;
            }

            let UserData = await Client.create(data, { transaction: process });
            // create platform permission

            await db.sequelize.query(
                `Call proc_client_platform(:db_name, :client_id, :isCRM, :isDMS, :isSALES, :isCHANNEL, :isMEDIA, 'sup')`,
                {
                    replacements: {
                        db_name: dbConfig.DB,
                        client_id: UserData.user_id,
                        isCRM: !isCRM || isCRM == 'undefined' || isCRM == 'null' ? 0 : isCRM,
                        isDMS: !isDMS || isDMS == 'undefined' || isDMS == 'null' ? 0 : isDMS,
                        isSALES: !isSALES || isSALES == 'undefined' || isSALES == 'null' ? 0 : isSALES,
                        isMEDIA: !isMEDIA || isMEDIA == 'undefined' || isMEDIA == 'null' ? 0 : isMEDIA,
                        isCHANNEL: !isCHANNEL || isCHANNEL == 'undefined' || isCHANNEL == 'null' ? 0 : isCHANNEL,
                    },
                    type: QueryTypes.INSERT,
                    transaction: process,
                }
            );


            // crm
            if (no_of_license > 0) {
                await db.platformHistory.create({
                    user_id: UserData.user_id,
                    platform_id: 1,
                    platformHistory_count: no_of_license,
                    updated_by: req.user.user_id
                })
            }

            if (no_of_channel_license > 0) {
                await db.platformHistory.create({
                    user_id: UserData.user_id,
                    platform_id: 4,
                    platformHistory_count: no_of_channel_license,
                    updated_by: req.user.user_id
                })
            }

            if (no_of_dms_license > 0) {
                await db.platformHistory.create({
                    user_id: UserData.user_id,
                    platform_id: 2,
                    platformHistory_count: no_of_dms_license,
                    updated_by: req.user.user_id
                })
            }

            if (no_of_sales_license > 0) {
                await db.platformHistory.create({
                    user_id: UserData.user_id,
                    platform_id: 3,
                    platformHistory_count: no_of_sales_license,
                    updated_by: req.user.user_id
                })
            }

            if (no_of_media_license > 0) {
                await db.platformHistory.create({
                    user_id: UserData.user_id,
                    platform_id: 5,
                    platformHistory_count: no_of_media_license,
                    updated_by: req.user.user_id
                })
            }

            await db.sequelize.query(`Call proClientPermission(:userID)`, {
                replacements: { userID: UserData.user_id },
                type: QueryTypes.INSERT,
                transaction: process,
            });

            // first time sync db
            let nUserDB = await first(`${PREFIX}${userCode}`, req, res);

            await db.sequelize.query(`SET FOREIGN_KEY_CHECKS=0;`, {
                type: QueryTypes.RAW,
                transaction: process,
            });

            await db.sequelize.query(`
                DELETE FROM ${PREFIX}${userCode}.db_email_templates;
                `, {
                type: QueryTypes.DELETE,
                transaction: process,
            });

            await db.sequelize.query(`
                INSERT INTO ${PREFIX}${userCode}.db_email_templates(template_id, template_name, template, platform_id, createdAt, updatedAt, deletedAt)
                SELECT * FROM daily_crm.db_email_templates;
                `, {
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`
                DELETE FROM ${PREFIX}${userCode}.db_countries;
            `, {
                type: QueryTypes.DELETE,
                transaction: process,
            });

            await db.sequelize.query(`
                DELETE FROM ${PREFIX}${userCode}.db_states;
            `, {
                type: QueryTypes.DELETE,
                transaction: process,
            });

            await db.sequelize.query(`
                DELETE FROM ${PREFIX}${userCode}.db_cities;
            `, {
                type: QueryTypes.DELETE,
                transaction: process,
            });

            await db.sequelize.query(`
                INSERT INTO ${PREFIX}${userCode}.db_countries(country_id, country_code, country_name, code, createdAt, updatedAt, deletedAt)
                SELECT * FROM daily_crm.db_countries;
            `, {
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`
                INSERT INTO ${PREFIX}${userCode}.db_states(state_id, state_name, country_id, createdAt, updatedAt, deletedAt)
                SELECT * FROM daily_crm.db_states;
            `, {
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`
                INSERT INTO ${PREFIX}${userCode}.db_cities(city_id, city_name, state_id, createdAt, updatedAt, deletedAt)
                SELECT * FROM daily_crm.db_cities;
            `, {
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`Call procCurrency(:db_name)`, {
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(
                `Call proc_platform(:db_name, :isCRM, :isDMS, :isSALES, :isCHANNEL, :isMEDIA )`,
                {
                    replacements: {
                        db_name: `${PREFIX}${userCode}`,
                        isCRM: isCRM && isCRM != "null" ? isCRM : 0,
                        isDMS: isDMS && isDMS != "null" ? isDMS : 0,
                        isSALES: isSALES && isSALES != "null" ? isSALES : 0,
                        isCHANNEL: isCHANNEL && isCHANNEL != "null" ? isCHANNEL : 0,
                        isMEDIA: isMEDIA && isMEDIA != "null" ? isMEDIA : 0,
                    },
                    type: QueryTypes.INSERT,
                    transaction: process,
                }
            );

            const query = `INSERT INTO ${PREFIX}${userCode}.db_users (user, email, contact_number, password, db_name, isDB, user_status, user_code, role_id, password_reset_token, password_reset_expires, country_id, state_id, city_id, district_id, address, pincode, report_to, domain , no_of_months ,no_of_license, gst, nda, remarks,logo, createdAt, updatedAt, deletedAt, doc_verification, client_url) VALUES (:user, :email, :contact_number, :password, :db_name, :isDB, :user_status, :user_code, :role_id, :password_reset_token, :password_reset_expires, :country_id, :state_id, :city_id, :district_id, :address, :pincode, :report_to, :domain, :no_of_months,
            :no_of_license, :gst, :nda, :remarks,:logo, :createdAt, :updatedAt, :deletedAt, :doc_verification, :client_url);`;

            await db.sequelize.query(query, {
                replacements: {
                    user,
                    email,
                    contact_number: contact_number,
                    password: userPassword,
                    db_name: `${PREFIX}${userCode}`,
                    isDB: true,
                    user_status: true,
                    user_code: userCode,
                    role_id: null,
                    password_reset_token: null,
                    password_reset_expires: null,
                    country_id:
                        country_id && country_id != undefined && country_id != null
                            ? country_id
                            : null,
                    state_id:
                        state_id && state_id != undefined && state_id != null
                            ? state_id
                            : null,
                    city_id:
                        city_id && city_id != undefined && city_id != null ? city_id : null,
                    district_id:
                        district_id && district_id != undefined && district_id != null
                            ? district_id
                            : null,
                    address:
                        address && address != undefined && address != null ? address : null,
                    pincode:
                        pincode && pincode != undefined && pincode != null ? pincode : null,
                    report_to: null,
                    domain:
                        domain && domain != undefined && domain != null ? domain : null,
                    no_of_months: 0,

                    no_of_license:
                        no_of_license && no_of_license != undefined && no_of_license != null
                            ? no_of_license
                            : null,
                    gst: gst && gst != undefined && gst != null ? gst : null,
                    nda: 0,
                    remarks: null,
                    logo: logoImage,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    deletedAt: null,
                    doc_verification: 2,
                    client_url: client_url
                },
                transaction: process,
                type: Sequelize.QueryTypes.INSERT,
            });

            const queryData = await db.sequelize.query(
                `Select * from ${PREFIX}${userCode}.db_users where db_users.user_code = "${userCode}"`,
                {
                    type: QueryTypes.SELECT,
                    transaction: process,
                }
            );

            const profileQuery = `INSERT INTO ${PREFIX}${userCode}.db_user_profiles (user_id, div_id, dep_id, des_id, aadhar_no, aadhar_file, pan_no, pan_file, dl_no, dl_file, user_image_file, bank_name, account_holder_name, account_no, bank_ifsc_code, branch, createdAt, updatedAt, deletedAt) VALUES (:user_id, :div_id, :dep_id, :des_id, :aadhar_no, :aadhar_file, :pan_no, :pan_file, :dl_no, :dl_file, :user_image_file, :bank_name, :account_holder_name, :account_no, :bank_ifsc_code, :branch, :createdAt, :updatedAt, NULL)`;

            let profileQueryData = await db.sequelize.query(profileQuery, {
                replacements: {
                    user_id: queryData[0].user_id,
                    div_id: null,
                    dep_id: null,
                    des_id: null,
                    aadhar_no: null,
                    aadhar_file: null,
                    pan_no: pan && pan != undefined && pan != null ? pan : null,
                    pan_file: null,
                    dl_no: null,
                    dl_file: null,
                    user_image_file: null,
                    bank_name: null,
                    account_holder_name: null,
                    account_no: null,
                    bank_ifsc_code: null,
                    branch: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    deletedAt: null,
                },
                transaction: process,
                type: Sequelize.QueryTypes.INSERT,
            });

            await db.sequelize.query(`Call procMenu(:db_name, "create_menu")`, { // Need to change
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`Call procLeadStatus(:db_name)`, {
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`Call procRole(:db_name)`, {
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`Call procOpprType(:db_name)`, {
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`Call proc_opp_stage(:db_name)`, {
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`Call procLeadSources(:db_name)`, {
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });
            await db.sequelize.query(`Call procLeadRate(:db_name)`, {
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });
            await db.sequelize.query(`Call proc_lead_stage(:db_name)`, {
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });
            await db.sequelize.query(`Call procLeadIndustry(:db_name)`, {
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`Call procTaskStatus(:db_name)`, {
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`Call procAccType(:db_name)`, {   // Need to change
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`Call procTax(:db_name)`, {
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`Call procSettings(:db_name)`, {
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });

            try {
                await db.sequelize.query(`Call proc_lead_locations(:db_name)`, {
                    replacements: { db_name: `${PREFIX}${userCode}` },
                    type: QueryTypes.INSERT,
                    transaction: process,
                });
            } catch (error) {
                // Handle the datetime error from stored procedure
                if (error.original && error.original.code === 'ER_TRUNCATED_WRONG_VALUE') {
                    console.log('Warning: proc_lead_locations has invalid datetime values. This stored procedure needs to be updated at the database level.');
                    // Continue with the process despite the error
                } else {
                    throw error; // Re-throw if it's a different error
                }
            }

            //Media Procs
            // if (isMEDIA) {
            await db.sequelize.query(`Call procSiteCategory(:db_name)`, {
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`Call procMediaType(:db_name)`, {
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`Call procRating(:db_name)`, {
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`Call procAvailabilityStatus(:db_name)`, {
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`Call procSiteStatus(:db_name)`, {
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`Call procCampaignBusinessType(:db_name)`, {
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`Call procCampaignProof(:db_name)`, {
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`Call procCampaignStatus(:db_name)`, {
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`Call procEstimationStatus(:db_name)`, {
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`Call procMediaFormat(:db_name)`, {
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`Call procPrintingMaterial(:db_name)`, {
                replacements: { db_name: `${PREFIX}${userCode}` },
                type: QueryTypes.INSERT,
                transaction: process,
            });

            await db.sequelize.query(`SET FOREIGN_KEY_CHECKS=1;`, {
                type: QueryTypes.RAW,
                transaction: process,
            });
            // }
            await nUserDB.sequelize.close();

            process.commit();
            return res.status(200).json({ message: "DB created", data: UserData });
        }


    } catch (error) {
        logErrorToFile(error)
        process.rollback();
        console.log(error);
        return res.status(400).json({ message: error });
    }
}


exports.downloadExcelData = async (req, res) => {
    try {
        let ClientData = await Client.findAll({
            where: {
                isDB: true,
            },
            attributes: [
                ["user", "User"],
                ["email", "Email"],
                ["contact_number", "Contact no"],
                ["db_name", "Database name"],
                ["user_code", "User Code"],
                ["subscription_start_date", "Subscription start date"],
                ["subscription_end_date", "Subscription end date"],
                ["no_of_months", "No of Months"],
                ["domain", "Domain"],
                ["no_of_license", "No of License"],
                ["gst", "GST"],
                ["pan", "Pan no"],
                ["address", "Address"],
            ],
        });
        if (ClientData.length > 0) {
            let excelClientData = ClientData.map((item) => item.dataValues);
            const workbook = xlsx.utils.book_new();
            const worksheet = xlsx.utils.json_to_sheet(excelClientData);
            // Add the worksheet to the workbook
            xlsx.utils.book_append_sheet(workbook, worksheet, "Sheet1");

            // Generate a temporary file path to save the Excel workbook
            const tempFilePath = path.join(
                __dirname,
                `../uploads/temp`,
                "temp.xlsx"
            );

            // Write the workbook to a file
            xlsx.writeFile(workbook, tempFilePath);

            // Set the response headers
            res.setHeader("Content-Type", "application/vnd.ms-excel");
            res.setHeader("Content-Disposition", "attachment; filename=example.xlsx");

            // Stream the file to the response
            const stream = fs.createReadStream(tempFilePath);
            stream.pipe(res);

            // Delete the temporary file after sending the response
            stream.on("end", () => {
                fs.unlinkSync(tempFilePath);
            });
            return;
        } else {
            return res
                .status(200)
                .json({ status: 404, message: "No Client Founds" });
        }

    } catch (error) {
        logErrorToFile(error)
        console.log(error);
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.db_login = async (req, res) => {
    try {
        let { email, password, type, client_url } = req.body;
        console.log(req.body.email,"1111111");
        
        let userData = await Client.findOne({
            where: {
                email: email,
            },
        });
        console.log(userData,"111");

        if (!userData) {
            return res.status(400).json({ status: 400, message: "Email does not exist", data: null });
        }

        if (!userData.user_status) {
            return res.status(400).json({ status: 400, message: "Your account is diabled, please contact NK Realtors Team", data: null });
        }

        // get profile of admin
        const Logo = await Client.findAll({
            where: {
                isDB: true,
                db_name: userData.db_name
            },
            attributes: ['logo', 'sidebar_color', 'button_color', 'top_nav_color', 'client_url']
        });
        if (!Logo) {
            return res.status(400).json({ status: 400, message: "Admin of this user not found", data: null });
        }

        if (client_url) {
            const normalizedClientUrl = client_url.replace(/\/+$/, '');
            const normalizedLogoUrl = Logo[0]?.dataValues?.client_url.replace(/\/+$/, '');
            if (normalizedLogoUrl !== normalizedClientUrl && client_url != "http://crm.cybermatrixsolutions.com") {
                return res.status(403).json({ status: 403, message: "Bad Request", data: null });
            }
        }

        if (userData.doc_verification != 2) {
            return res.status(400).json({
                status: 400,
                message: "User Not Verified",
                data: null,
            });
        }

        let userDb = await middle(userData.db_name, req, res);
        const isSame = await bcrypt.compare(password, userData.password);
        let platformData = [];
        if (userData && isSame) {
            userData = await userDb.users.findOne({
                where: {
                    email: email,
                },
            });

            if (userData.isDB) {
                // user is admin
                if (type !== 'common') {
                    let platformID = type == 'crm' ? 1 : type == 'dms' ? 2 : type == 'sales' ? 3 : 4
                    let checkpermissionData = await userDb.platform.findOne({
                        where: {
                            is_active: true,
                            platform_id: platformID
                        },
                    });
                    if (!checkpermissionData) return res.status(400).json({ status: 401, message: "user not authorized" });
                }

                platformData = await userDb.platform.findAll({
                    where: {
                        is_active: true,
                    },
                });

            } else {

                // for other user 
                if (type !== 'common') {
                    let platformID = type == 'crm' ? 1 : type == 'dms' ? 2 : type == 'sales' ? 3 : 4
                    checkpermissionData = await userDb.userPlatform.findOne({
                        where: {
                            platform_id: platformID,
                            actions: true,
                            user_id: userData.user_id,
                        },
                    });
                    if (!checkpermissionData) return res.status(400).json({ status: 401, message: "user not authorized" });

                }

                platformData = await userDb.platform.findAll({
                    where: {
                        is_active: true,
                    },
                    include: [
                        {
                            model: userDb.userPlatform,
                            where: {
                                actions: true,
                                user_id: userData.user_id,
                            },
                            required: true,
                        },
                    ],
                });
            }

            // creating token
            let token = jwt.sign(
                {
                    id: userData.user_id,
                    db_name: userData.db_name,
                    user_code: userData.user_code,
                },
                process.env.CLIENT_SECRET,
                {
                    expiresIn: process.env.expiresIn,
                }
            );


            let userAdminSubscriptionData = await Client.findOne({
                attributes: ['subscription_start_date', 'subscription_end_date', 'subscription_start_date_channel', 'subscription_end_date_channel', 'subscription_start_date_dms', 'subscription_end_date_dms', 'subscription_start_date_sales', 'subscription_end_date_sales', 'subscription_start_date_media', 'subscription_end_date_media'],
                where: {
                    isDB: 1,
                    db_name: userData.db_name
                },
            });

            await userDb.sequelize.close();
            let obj = {
                user_id: userData.user_id,
                login_time: Date.now(),
                db_name: userData.db_name,
                IP_address: req.connection.remoteAddress,
                role_id: userData.role_id,
            }
            // await db.loginLogger.create(obj)
            return res.status(200).json({ userData, token, platformData, Logo, userAdminSubscriptionData });
        } else {
            return res.status(400).json({ status: 400, message: "Email or password is invalid" });
        }
    } catch (error) {
        logErrorToFile(error)
        console.log(error);
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.game = async (req, res) => {
    try {
        let { game_name } = req.body;
        let gameData = await req.config.games.create({ game_name });
        if (gameData) {
            return res.status(200).json({ status: 200, message: "game list", data: gameData });
        } else {

            return res.status(400).json({ status: 400, message: "Auth Failed" });
        }
    } catch (error) {
        logErrorToFile(error)

        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.getGame = async (req, res) => {
    try {
        let gameData = await req.config.games.findAll();
        if (gameData) {

            return res.status(200).json({ gameData });
        } else {

            return res.status(400).json({ status: 400, message: "Auth Failed" });
        }
    } catch (error) {
        logErrorToFile(error)

        return res.status(400).json({ message: error });
    }
};

exports.getClients = async (req, res) => {
    try {
        let ClientData;
        if (req.query.id) {
            ClientData = await Client.findOne({
                where: {
                    user_id: req.query.id,
                },
                include: [
                    {
                        model: db.clientPlatform,
                        attributes: ["client_id", "actions", "c_p_id"], // Changed to array
                        where: {
                            client_id: req.query.id,
                        },
                        include: {
                            model: db.platform,
                            attributes: ["platform_name", "platform_id"], // Changed to array
                        },
                        raw: true,
                    },
                ],
                attributes: {
                    exclude: ["password"],
                },
            });
        } else {
            ClientData = await Client.findAll({
                where: {
                    isDB: true,
                },
                order: [["user_id", "DESC"]],
            });
        }

        return res
            .status(200)
            .json({ status: 200, message: "client list", data: ClientData });
    } catch (error) {
        logErrorToFile(error)
        console.log(error);
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.givePermission = async (req, res) => {
    try {
        let data = req.body.permissionData;

        data.map((item, i) => {
            item.user_id = req.body.user_id;
        });

        let user_id = req.body.user_id;


        for (let index = 0; index < data.length; index++) {
            const element = data[index];
            const findClientPermission = await db.clientPermissions.findOne({
                where: {
                    user_id: element.user_id,
                    menu_id: element.menu_id,
                },
            });

            if (findClientPermission == null) {
                const UserPermissionInProgramData = await db.clientPermissions.create(
                    {
                        menu_id: element.menu_id,
                        user_id: element.user_id,
                        actions: element.actions,
                        menu_name: element.menu_name,
                        parent_id: element.parent_id,
                    }
                );
            } else {
                const UserPermissionInProgramData = await db.clientPermissions.update(
                    {
                        actions: element.actions,
                    },
                    {
                        where: {
                            user_id: element.user_id,
                            menu_id: element.menu_id,
                        },
                    }
                );
            }
        }


        // Promise.allSettled(
        //   data.map(async (item, i) => {
        //     const findClientPermission = await db.clientPermissions.findOne({
        //       where: {
        //         user_id: req.body.user_id,
        //         menu_id: item.menu_id,
        //       },
        //     });

        //     if (findClientPermission == null) {
        //       const UserPermissionInProgramData = await db.clientPermissions.create(
        //         {
        //           menu_id: item.menu_id,
        //           user_id: user_id,
        //           actions: item.is_active,
        //           menu_name: item.menu_name,
        //           parent_id: item.parent_id,
        //         }
        //       );
        //     } else {
        //       const UserPermissionInProgramData = await db.clientPermissions.update(
        //         {
        //           actions: item.actions,
        //         },
        //         {
        //           where: {
        //             user_id: user_id,
        //             menu_id: item.menu_id,
        //           },
        //         }
        //       );
        //     }
        //   })
        // );

        //open connection the close  after the work done

        let Userdb = await middle(req.body.db_name, req, res);
        let clientD = [];
        for (let i = 0; i < data.length; i++) {
            const element = data[i];
            const found = await Userdb.menus.findOne({
                where: {
                    menu_id: element.menu_id
                }
            })

            const result = await Userdb.sequelize.query(
                `UPDATE ${req.body.db_name}.db_menus SET is_active = :is_active WHERE menu_id = :menu_id`,
                {
                    replacements: { is_active: element.is_active, menu_id: element.menu_id },
                    type: Userdb.Sequelize.QueryTypes.UPDATE
                }
            );

            // const result = await Userdb.menus.update(
            //   {
            //     is_active: element.is_active?1:0
            //   },
            //   {
            //     where: {
            //       menu_id: element.menu_id
            //     }
            //   }
            // );
            //console.log('element.menu_id',element.menu_id,element.is_active)
            clientD.push(result);
        }
        // let clientData = await Userdb.menus.bulkCreate(data, {
        //   updateOnDuplicate: [
        //     "menu_id",
        //     "is_active",
        //     "menu_name",
        //     "parent_id",
        //     "link",
        //     "icon_path",
        //     "menu_type",
        //   ],
        // });

        await Userdb.sequelize.close();
        return res
            .status(200)
            .json({ status: 200, message: "permission granted", data: clientD });
    } catch (error) {
        logErrorToFile(error)
        console.log("error", error);
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

let AllData = []; // store all Menu Data

const child = (item, i) => {
    let newobj = item;

    var countChild = AllData.filter((obj, j) => {
        return item.menu_id == obj.parent_id;
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

exports.ViewPermissionOfClients = async (req, res) => {
    try {
        let menu_type = req.query.pf || "CRM";

        let client = await db.clients.findOne({
            where: { user_id: req.query.id }
        })

        let ClientMenuData = await db.sequelize.query(
            `SELECT 
                m.menu_id, 
                m.menu_name, 
                m.parent_id, 
                m.menu_order, 
                m.is_active, 
                m.link, 
                p.permission_id, 
                p.user_id, 
                m.is_task, 
                m.icon_path, 
                m.allais_menu, 
                IFNULL(p.actions, 0) AS "actions"
            FROM 
                ${client.db_name}.db_menus AS m 
            LEFT JOIN 
                db_client_permissions AS p 
            ON 
                m.menu_id = p.menu_id 
                AND p.user_id = ${req.query.id} 
            WHERE 
                m.menu_type = '${menu_type}'
                AND m.deletedAt IS NULL 
            ORDER BY 
                m.menu_id ASC;`,
            {
                type: QueryTypes.SELECT,
            }
        );

        if (ClientMenuData.length > 0) {
            AllData = ClientMenuData; // storing all the cats data
            var parent_data = ClientMenuData.filter((obj, j) => {
                return obj.parent_id == 0;
            });

            var newArr = []; // storing tree data

            // initializing the child method first time

            parent_data.map((item, i) => {
                let finalData = child(item, i);
                newArr.push(finalData);
            });
        }

        return res.status(200).json({ status: 200, message: "client Data", data: newArr });
    } catch (error) {
        logErrorToFile(error)
        console.log(error);
        return res.status(400).json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.viewMenu = async (req, res) => {
    try {
        let menu_type = req.query.id || "CRM";
        let menuData = await db.sequelize.query(
            `Call procClientMenu(:client_id , 'viewMenu' , 'aa', :menu_type)`,
            {
                replacements: { client_id: 0, menu_type },
                type: QueryTypes.INSERT,
            }
        );

        if (menuData.length > 0) {
            AllData = menuData; // storing all the cats data
            var parent_data = menuData.filter((obj, j) => {
                return obj.parent_id == 0;
            });

            var newArr = []; // storing tree data

            // initializing the child method first time

            parent_data.map((item, i) => {
                let finalData = child(item, i);
                newArr.push(finalData);
            });
        }

        return res
            .status(200)
            .json({ status: 200, message: "menu Data", data: newArr });
    } catch (error) {
        logErrorToFile(error)
        console.log(error);
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.addMenuInSuperAdmin = async (req, res) => {
    try {
        let { menuBody } = req.body;
        let menuData = await db.menus.create(menuBody);
        return res
            .status(200)
            .json({ status: 200, message: "menu Data", data: menuData });
    } catch (error) {
        logErrorToFile(error)
        console.log(error);
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.addMenuIconInSuperAdmin = async (req, res) => {
    try {
        let { path, m_id } = req.body;
        const data = await fileUpload.imageExport(req, res, path);
        if (!data.message) {
            let updatedIcon = await db.menus.update(
                { icon_path: data },
                {
                    where: {
                        menu_id: m_id,
                    },
                }
            );
            return res
                .status(200)
                .json({ status: 200, message: "menu Data", data: updatedIcon });
        } else {
            return res
                .status(400)
                .json({ status: 400, message: "Something Went Wrong" });
        }
    } catch (error) {
        logErrorToFile(error)
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.updateMenu = async (req, res) => {
    try {
        let { menuBody } = req.body;
        let menuData = await db.menus.update(menuBody, {
            where: {
                menu_id: menuBody.menu_id,
            },
        });
        return res
            .status(200)
            .json({
                status: 200,
                message: "menu Data updated successfully",
                data: [],
            });
    } catch (error) {
        logErrorToFile(error)
        console.log(error);
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.clientUpdate = async (req, res) => {
    try {
        const process = await db.sequelize.transaction();
        let clientData = req.body;

        let userData = await db.clients.findOne({
            where: {
                user_code: clientData.user_code,
            },
        });

        if (!userData) {
            return res.status(400).json({ status: 400, message: "admin not found" });
        }

        let clientURLExist = await Client.findOne({
            where: {
                client_url: clientData.client_url,
                user_id: { [Op.ne]: [clientData.user_id] }
            }
        })

        if (clientURLExist) {
            await process.cleanup();
            return res.status(400).json({ message: "Client URL already exist" });
        }

        let hostURLExist = await Client.findOne({
            where: {
                host_name: clientData.host_name,
                user_id: { [Op.ne]: [clientData.user_id] }
            }
        })

        if (hostURLExist) {
            await process.cleanup();
            return res.status(400).json({ message: "Salesforce host name already exist" });
        }

        let userDb = await first_small(userData.db_name, req, res);

        if (clientData.password) {
            clientData.password = await bcrypt.hash(clientData.password, 10);
        }

        if (clientData.email) {
            let emailExist = await db.clients.findOne({
                where: {
                    email: clientData.email,
                    user_id: {
                        [Op.ne]: userData.user_id
                    }
                },
            }, { transaction: process });

            if (emailExist) {
                await process.cleanup()
                return res.status(400).json({ status: 400, message: "Email Already Exists" })
            };
        }

        let data = {
            CRM: clientData.isCRM || true,
            DMS: clientData.isDMS || false,
            SALES: clientData.isSALES || false,
            CHANNEL: clientData.isCHANNEL || false,
            MEDIA: clientData.isMEDIA || false,
        };

        // update client permission at superadmin
        const entries = Object.entries(data);
        for (const [index, [key, value]] of entries.entries()) {

            let platformCheck = await userDb.platform.findOne({ where: { platform_name: `${key}` } })

            if (!platformCheck) {
                let userPlatformCheck = await userDb.platform.create({ platform_id: index + 1, platform_name: `${key}`, is_active: value })
            }

            let check = await db.clientPlatform.findOne({ where: { client_id: userData.user_id, platform_id: index + 1 } })

            if (check) {
                let updateclientPlatform = await db.clientPlatform.update(
                    { actions: value },
                    { where: { client_id: userData.user_id, platform_id: index + 1 } }
                );
            }
            else {
                let createclientPlatform = await db.clientPlatform.create({
                    client_id: userData.user_id,
                    actions: value,
                    platform_id: index + 1
                });

                await db.sequelize.query(`Call procRecreateMenu(:db_name)`, {
                    replacements: { db_name: `${userData.db_name}` },
                    type: QueryTypes.RAW
                });

                await db.sequelize.query(`Call procSiteCategory(:db_name)`, {
                    replacements: { db_name: `${userData.db_name}` },
                    type: QueryTypes.INSERT,
                });

                await db.sequelize.query(`Call procMediaType(:db_name)`, {
                    replacements: { db_name: `${userData.db_name}` },
                    type: QueryTypes.INSERT,
                });

                await db.sequelize.query(`Call procRating(:db_name)`, {
                    replacements: { db_name: `${userData.db_name}` },
                    type: QueryTypes.INSERT,
                });

                await db.sequelize.query(`Call procAvailabilityStatus(:db_name)`, {
                    replacements: { db_name: `${userData.db_name}` },
                    type: QueryTypes.INSERT,
                });

                await db.sequelize.query(`Call procSiteStatus(:db_name)`, {
                    replacements: { db_name: `${userData.db_name}` },
                    type: QueryTypes.INSERT,
                });

                await db.sequelize.query(`Call procCampaignBusinessType(:db_name)`, {
                    replacements: { db_name: `${userData.db_name}` },
                    type: QueryTypes.INSERT,
                });

                await db.sequelize.query(`Call procCampaignProof(:db_name)`, {
                    replacements: { db_name: `${userData.db_name}` },
                    type: QueryTypes.INSERT,
                });

                await db.sequelize.query(`Call procCampaignStatus(:db_name)`, {
                    replacements: { db_name: `${userData.db_name}` },
                    type: QueryTypes.INSERT,
                });

                await db.sequelize.query(`Call procMediaFormat(:db_name)`, {
                    replacements: { db_name: `${userData.db_name}` },
                    type: QueryTypes.INSERT,
                });

                await db.sequelize.query(`Call procPrintingMaterial(:db_name)`, {
                    replacements: { db_name: `${userData.db_name}` },
                    type: QueryTypes.INSERT,
                });
            }
        }

        // update client permission at superadmin
        const Userentries = Object.entries(data);
        for (const [index, [key, value]] of Userentries.entries()) {
            let check = await userDb.platform.findOne({ where: { platform_id: index + 1 } })
            if (check) {
                await userDb.platform.update(
                    { is_active: value },
                    { where: { platform_id: index + 1 } }
                );
            } else {
                await userDb.platform.create(
                    { platform_id: index + 1, is_active: value, platform_id: index + 1, platform_name: key, },
                );
            }
        }

        // crm
        const licenses = [
            { type: 'license', platformId: 1 },
            { type: 'channel_license', platformId: 4 },
            { type: 'dms_license', platformId: 2 },
            { type: 'sales_license', platformId: 3 },
            { type: 'media_license', platformId: 5 }
        ];

        for (const license of licenses) {
            const clientLicenseKey = `no_of_${license.type}`;
            if (clientData[clientLicenseKey] > 0 && userData[clientLicenseKey] != clientData[clientLicenseKey]) {
                await db.platformHistory.create({
                    user_id: userData.user_id,
                    platform_id: license.platformId,
                    platformHistory_count: clientData[clientLicenseKey],
                    updated_by: req.user.user_id
                });
            }
        }

        for (const license of licenses) {
            const clientLicenseKey = `no_of_${license.type}`;
            if (clientData[clientLicenseKey] == null || Number(clientData[clientLicenseKey]) == NaN || clientData[clientLicenseKey] == 'null') {
                clientData[clientLicenseKey] = 0
                delete clientData[clientLicenseKey]
            }
        }

        const files = [
            { key: 'logo', folder: 'logo' },
            { key: 'client_image_1', folder: 'clientdoc' },
            { key: 'client_image_2', folder: 'clientdoc' },
            { key: 'client_image_3', folder: 'clientdoc' },
            { key: 'client_image_4', folder: 'clientdoc' }
        ];

        for (const file of files) {
            if (req.files && req.files[file.key]) {
                req.body._imageName = userData[file.key] || 0;
                let imageName = await fileUpload.imageExport(req, res, file.folder, file.key);
                clientData[file.key] = imageName;
            }
        }

        const subscriptions = [
            'subscription_start_date_sales',
            'subscription_end_date_sales',
            'subscription_start_date_media',
            'subscription_end_date_media',
            'subscription_start_date_dms',
            'subscription_end_date_dms',
            'subscription_start_date_channel',
            'subscription_end_date_channel',
            'subscription_start_date',
            'subscription_end_date'
        ];

        subscriptions.forEach(key => {
            const startKey = `subscription_start_date_${key.split('_')[3]}`;
            if (clientData[startKey] == "null" || clientData[startKey] == 'Invalid date' || clientData[startKey] == null) {
                delete clientData[startKey];
                const endKey = `subscription_end_date_${key.split('_')[3]}`;
                delete clientData[endKey];
            }
        });

        if (clientData.subscription_start_date == "null" || clientData.subscription_start_date == 'Invalid date' || clientData.subscription_start_date == null) {
            delete clientData.subscription_start_date
            delete clientData.subscription_end_date
        }

        // find user from client table

        await db.clients.update(clientData, {
            where: {
                user_code: clientData.user_code,
            },
        });

        // update user menu table in user personal db

        let clientUser = await userDb.users.findOne({
            where: {
                user_code: clientData.user_code,
            },
        });

        if (!clientUser) {
            return res.status(400).json({ status: 400, message: "Client user does not exist" });
        }

        clientData.user_id = clientUser.user_id;

        await userDb.users.update(clientData, {
            where: {
                user_code: clientData.user_code,
            },
        });

        // find user profile
        let clientUserProfile = await userDb.usersProfiles.findOne({
            where: {
                user_id: clientUser.user_id,
            },
        });

        if (clientData.pan) {
            let profileData = {
                pan_no: clientData.pan,
            };
            await clientUserProfile.update(profileData);
        }

        // update platform
        let clientProf = await db.clients.findOne({
            where: {
                user_code: clientData.user_code,
            },
        });
        await userDb.sequelize.close();
        return res
            .status(200)
            .json({ status: 200, message: "client Data Updated", data: clientProf });
    } catch (error) {
        logErrorToFile(error)
        console.log(error);
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

// if (clientData.no_of_license > 0 && userData.no_of_license != clientData.no_of_license) {
//   await db.platformHistory.create({
//     user_id: userData.user_id,
//     platform_id: 1,
//     platformHistory_count: clientData.no_of_license,
//     updated_by: req.user.user_id
//   })
// }

// if (clientData.no_of_channel_license > 0 && userData.no_of_channel_license != clientData.no_of_channel_license) {
//   await db.platformHistory.create({
//     user_id: userData.user_id,
//     platform_id: 4,
//     platformHistory_count: clientData.no_of_channel_license,
//     updated_by: req.user.user_id
//   })
// }

// if (clientData.no_of_dms_license > 0 && userData.no_of_dms_license != clientData.no_of_dms_license) {
//   await db.platformHistory.create({
//     user_id: userData.user_id,
//     platform_id: 2,
//     platformHistory_count: clientData.no_of_dms_license,
//     updated_by: req.user.user_id
//   })
// }
// if (clientData.no_of_sales_license > 0 && userData.no_of_sales_license != clientData.no_of_sales_license) {
//   await db.platformHistory.create({
//     user_id: userData.user_id,
//     platform_id: 3,
//     platformHistory_count: clientData.no_of_sales_license,
//     updated_by: req.user.user_id
//   })
// }
// if (clientData.no_of_media_license > 0 && userData.no_of_media_license != clientData.no_of_media_license) {
//   await db.platformHistory.create({
//     user_id: userData.user_id,
//     platform_id: 5,
//     platformHistory_count: clientData.no_of_media_license,
//     updated_by: req.user.user_id
//   })
// }

// if (req.files && req.files.logo) {
//   req.body._imageName = userData.logo || 0
//   let name = await fileUpload.imageExport(req, res, "logo", "logo");
//   clientData.logo = name
// }

// if (req.files && req.files.client_image_1) {
//   req.body._imageName = userData.client_image_1 || 0
//   let client_image_1 = await fileUpload.imageExport(req, res, "clientdoc", "client_image_1");
//   clientData.client_image_1 = client_image_1;
// }

// if (req.files && req.files.client_image_2) {
//   req.body._imageName = userData.client_image_2 || 0
//   let client_image_2 = await fileUpload.imageExport(req, res, "clientdoc", "client_image_2");
//   clientData.client_image_2 = client_image_2;
// }

// if (req.files && req.files.client_image_3) {
//   req.body._imageName = userData.client_image_3 || 0
//   let client_image_3 = await fileUpload.imageExport(req, res, "clientdoc", "client_image_3");
//   clientData.client_image_3 = client_image_3;
// }

// if (req.files && req.files.client_image_4) {
//   req.body._imageName = userData.client_image_4 || 0
//   let client_image_4 = await fileUpload.imageExport(req, res, "clientdoc", "client_image_4");
//   clientData.client_image_4 = client_image_4;
// }

// if (clientData.subscription_start_date_sales == "null" || clientData.subscription_start_date_sales == 'Invalid date') {
//   delete clientData.subscription_start_date_sales
//   delete clientData.subscription_end_date_sales
// }
// if (clientData.subscription_start_date_media == "null" || clientData.subscription_start_date_media == 'Invalid date') {
//   delete clientData.subscription_start_date_media
//   delete clientData.subscription_end_date_media
// }
// if (clientData.subscription_start_date_dms == "null" || clientData.subscription_start_date_dms == 'Invalid date') {
//   delete clientData.subscription_start_date_dms
//   delete clientData.subscription_end_date_dms
// }
// if (clientData.subscription_start_date_channel == "null" || clientData.subscription_start_date_channel == 'Invalid date') {
//   delete clientData.subscription_start_date_channel
//   delete clientData.subscription_end_date_channel
// }
// if (clientData.subscription_start_date == "null" || clientData.subscription_start_date == 'Invalid date') {
//   delete clientData.subscription_start_date
//   delete clientData.subscription_end_date
// }


exports.getPlatformPermissionByAdmin = async (req, res) => {
    try {
        let platformData = await db.clientPlatform.findAll({
            where: {
                actions: true,
                client_id: req.query.id,
            },
        });

        return res
            .status(200)
            .json({
                status: 200,
                message: "client platFormData",
                data: platformData,
            });
    } catch (error) {
        logErrorToFile(error)
        console.log(error);
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.clientDelete = async (req, res) => {
    try {
        let clientID = req.query.id;
        let userData = await db.clients.findOne({
            where: {
                user_id: clientID,
            },
        });

        if (!userData) {
            return res.status(400).json({ status: 400, message: "user not found" });
        }

        if (userData.isDB) {
            await db.clients.update(
                { user_status: !userData.user_status },
                {
                    where: {
                        db_name: userData.db_name,
                    },
                }
            );
        } else {
            await db.clients.update(
                { user_status: !userData.user_status },
                {
                    where: {
                        user_code: userData.user_code,
                    },
                }
            );
        }
        return res.status(200).json({
            status: 200,
            message: userData.user_status ? "Client Deactivated Successfully" : 'Client Activated Successfully',
            data: null
        });
    } catch (error) {
        logErrorToFile(error)
        console.log(error);
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.getCountry = async (req, res) => {
    try {
        let areaData = await db.country.findAll();
        return res
            .status(200)
            .json({ status: 200, message: "Country List", data: areaData });
    } catch (error) {
        logErrorToFile(error)
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};
exports.storeCountry = async (req, res) => {
    try {
        const data = await db.country.findOne({
            where: {
                country_name: db.country_name,
            },
        });
        if (data)
            return res
                .status(400)
                .json({ status: 400, message: "country name already exist" });
        let areaData = await db.country.create(req.body);
        return res
            .status(200)
            .json({ status: 200, message: "Country craeted", data: areaData });
    } catch (error) {
        logErrorToFile(error)
        console.log(error);
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.editCountry = async (req, res) => {
    try {
        const data = await db.country.findOne({
            where: {
                country_name: req.body.country_name,
                country_id: { [Op.ne]: req.body.country_id },
            },
        });
        if (data)
            return res
                .status(400)
                .json({ status: 400, message: "country name already exist" });
        await req.config.country.update(req.body, {
            where: {
                country_id: req.body.country_id,
            },
        });
        return res
            .status(200)
            .json({ status: 200, message: "Country updated", data: null });
    } catch (error) {
        logErrorToFile(error)
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.deleteCountry = async (req, res) => {
    try {
        let areaData = await db.country.findOne({
            where: {
                country_id: req.query.cnt_id,
            },
        });
        if (!areaData)
            return res
                .status(404)
                .json({ status: 400, message: "country name not found" });
        await areaData.destroy();
        return res
            .status(200)
            .json({ status: 200, message: "Country deleted", data: null });
    } catch (error) {
        logErrorToFile(error)
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.getState = async (req, res) => {
    try {
        let stateData = await db.states.findAll({
            where: {
                country_id: req.query.cnt_id,
            },
        });
        return res
            .status(200)
            .json({ status: 200, message: "State List", data: stateData });
    } catch (error) {
        logErrorToFile(error)
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};
exports.storeStates = async (req, res) => {
    try {
        const data = await db.states.findOne({
            where: {
                country_id: req.body.country_id,
                state_name: req.body.state_name,
            },
        });
        if (data)
            return res
                .status(400)
                .json({ status: 400, message: "state name already exist" });
        let stateData = await db.states.create(req.body);
        return res
            .status(400)
            .json({ status: 200, message: "state name created successfully" });
    } catch (error) {
        logErrorToFile(error)
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.editStates = async (req, res) => {
    try {
        const data = await db.findOne({
            where: {
                country_id: req.body.country_id,
                state_name: req.body.state_name,
                state_id: { [Op.ne]: req.body.state_id },
            },
        });
        if (data)
            return res
                .status(400)
                .json({ status: 400, message: "state name already exist" });

        await db.states.update(req.body, {
            where: {
                state_id: req.body.state_id,
            },
        });
        return res
            .status(400)
            .json({ status: 200, message: "state name updated successfully" });
    } catch (error) {
        logErrorToFile(error)
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.deleteStates = async (req, res) => {
    try {
        let stateData = await db.states.findOne({
            where: {
                state_id: req.query.st_id,
            },
        });
        if (!stateData)
            return res
                .status(400)
                .json({ status: 400, message: "state name does not existed" });

        await stateData.destroy();
        return res
            .status(400)
            .json({ status: 200, message: "state name deleted successfully" });
    } catch (error) {
        logErrorToFile(error)
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.getCityAndDistrict = async (req, res) => {
    try {
        let cityData = await db.city.findAll({
            where: {
                state_id: req.query.st_id,
            },
        });
        let distictData = await db.district.findAll({
            where: {
                state_id: req.query.st_id,
            },
        });

        let cityDistict = {
            cityData,
            distictData,
        };
        return res
            .status(200)
            .json({
                status: 200,
                message: "city and district List",
                data: cityDistict,
            });
    } catch (error) {
        logErrorToFile(error)
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.storeCity = async (req, res) => {
    try {
        const data = await db.city.findOne({
            where: {
                state_id: req.body.state_id,
                city_name: req.body.city_name,
            },
        });
        if (data)
            return res
                .status(400)
                .json({ status: 400, message: "City name already exist" });
        let cityData = await db.city.create(req.body);
        return res
            .status(400)
            .json({
                status: 200,
                message: "City created successfuly",
                data: cityData,
            });
    } catch (error) {
        logErrorToFile(error)
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.editCity = async (req, res) => {
    try {
        const data = await db.city.findOne({
            where: {
                state_id: req.body.state_id,
                city_name: req.body.city_name,
                city_id: { [Op.ne]: req.body.city_id },
            },
        });
        if (data)
            return res
                .status(400)
                .json({ status: 400, message: "City name already exist" });
        await db.city.update(req.body, {
            where: {
                city_id: req.body.city_id,
            },
        });
        return res
            .status(400)
            .json({ status: 200, message: "City name updated successfully" });
    } catch (error) {
        logErrorToFile(error)
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.deleteCity = async (req, res) => {
    try {
        let cityData = await db.city.findOne({
            where: {
                city_id: req.query.ct_id,
            },
        });
        if (!cityData)
            return res
                .status(400)
                .json({ status: 400, message: "City name does not exist" });
        await cityData.destroy();
        return res.status(400).json({ status: 200, message: "City deleted" });
    } catch (error) {
        logErrorToFile(error)
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.getClientByUrl = async (req, res) => {
    try {
        let ClientData;
        let newURL = req.body.client_url;
        if (req.body.client_url) {
            if (req.body.client_url.charAt(req.body.client_url.length - 1) === '/') {
                newURL = req.body.client_url.substring(0, req.body.client_url.length - 1)
            }
        }

        console.log(newURL)

        ClientData = await Client.findOne({
            where: {
                client_url: newURL,
                user_status: true
            },

            attributes: {
                exclude: ["password"],
            },
        });

        if (!ClientData) {
            return res.status(200).json({ status: 400, message: "Client Does Not Exist Or Disabled", data: ClientData });
        }

        return res.status(200).json({ status: 200, message: "client Data", data: ClientData });
    } catch (error) {
        logErrorToFile(error)
        console.log(error);
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.getClientDataByUrl = async (req, res) => {
    try {
        let { client_url: newURL } = req.body;

        if (newURL) {
            // Remove the trailing slash from the URL if it exists
            if (newURL.endsWith('/')) {
                newURL = newURL.slice(0, -1);
            }
        } else {
            return res.status(400).json({ status: 400, message: "Client URL is required" });
        }

        console.log(`Processed URL: ${newURL}`);

        // Fetch client data from the database
        const ClientData = await req.config.users.findOne({
            where: {
                client_url: newURL,
                user_status: true
            },
            attributes: {
                exclude: ["password"],
            },
            include: [
                { model: req.config.country, paranoid: false },
                { model: req.config.states, paranoid: false },
                { model: req.config.city, paranoid: false },
            ]
        });

        if (!ClientData) {
            return res.status(404).json({ status: 404, message: "Client does not exist or is disabled", data: null });
        }

        return res.status(200).json({ status: 200, message: "Client Data retrieved successfully", data: ClientData });
    } catch (error) {
        logErrorToFile(error);
        console.error("Error fetching client data:", error);
        return res.status(500).json({ status: 500, message: "Something went wrong" });
    }
};

exports.userplatformhistory = async (req, res) => {
    try {
        let userPlatformHoistoryData = [];


        userPlatformHoistoryData = await db.platformHistory.findAll({
            where: {
                user_id: req.query.c_id,
            },

            include: [
                {
                    model: db.platform
                },
                {
                    model: db.clients,
                    attributes: ['user', 'user_id',]
                },
                {
                    model: db.supers,
                    as: "updatedBy",
                    attributes: ['user', 'user_id',]
                }
            ]

        });
        if (userPlatformHoistoryData.length == 0) {
            return res.status(404).json({ status: 404, message: "Data not found", data: userPlatformHoistoryData });
        }
        return res.status(200).json({ status: 200, message: "client history data ", data: userPlatformHoistoryData });
    } catch (error) {
        logErrorToFile(error)
        console.log(error);
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

exports.checkToken = async (req, res) => {
    try {
        let token;
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer")
        ) {
            token = req.headers.authorization.split(" ")[1];
        }
        if (!token) return res.status(400).json({ message: "No Token Found!" });

        const decoded = await promisify(jwt.verify)(token, process.env.CLIENT_SECRET);

        const clientUser = await db.clients.findOne({
            where: {
                user_code: decoded.user_code,
            },
        });

        if (!clientUser) {
            return res.status(400).json({ message: "Auth Failed! No User Found!" });
        }

        return res.status(200).json({ status: 200, message: "Token Verified" });

    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Token has expired!" });
        }
        logErrorToFile(error);
        console.error(error);
        return res.status(400).json({ status: 400, message: "Something went wrong", error });
    }
};