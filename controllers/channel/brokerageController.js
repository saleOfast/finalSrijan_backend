const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const { responseError, responseSuccess } = require('../../helper/responce')
const fileUpload = require("../../common/imageExport");
const fs = require("fs");
const path = require("path");
const sendEmail = require("../../common/mailer");

const zeroPad = (num, places) => String(num).padStart(places, '0')


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

exports.createBrokerage = async (req, res) => {
    try {
        let { booking_id, amount, date } = req.body
        let brokerageData;

        brokerageData = await req.config.leadBrokerage.findOne({
            where: {
                booking_id
            }
        })
        if (brokerageData) return await responseError(req, res, "brokerage Already Exist!")
        let leadBrokerageCount = await req.config.leadBrokerage.count({ paranoid: false })


        let bill_file = null;
        if (req.files && req.files.file) {
            let brokerageFile = await fileUpload.imageExport(req, res, "brokerage");
            bill_file = brokerageFile;
        }

        let booking_data = await req.config.leadBooking.findByPk(booking_id)
        brokerageData = await req.config.leadBrokerage.create({
            booking_id, amount, date, bill_file, lead_id: booking_data.lead_id,
            brokerage_code: `${req.admin.user.charAt(0).toUpperCase()}${req.admin.user_l_name ? req.admin.user_l_name.charAt(0).toUpperCase() : ''}BK_${zeroPad(leadBrokerageCount + 1, 5)}`,
            status: 'Bill sent'
        })

        await booking_data.update({
            status: 'Bill sent'
        })

        if (req.user.report_to) {
            const config = await req.config.emailConfig.findAll();
            const OwnerDetail = await req.config.users.findByPk(req.user.report_to);

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

            const htmlTemplate = await req.config.emailTemplates.findOne({ where: { template_id: 19 } }) // Brokerage Creation Template
            let template = htmlTemplate.template

            template = template.replace(/{{UserName}}/g, OwnerDetail.user).replace(/{{BrokerageId}}/g, brokerageData.brokerage_code).replace(/{{BrokerageCreator}}/g, req.user.email).replace(/{{CompanyName}}/g, company_name);

            // const resetLink = `Brokerage created with code name ${brokerageData.brokerage_code} created by ${req.user.email}`;
            // const htmlTemplatePath = path.join(
            //     __dirname,
            //     "../../",
            //     "mail",
            //     "cp",
            //     "example.html"
            // );
            // const htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");
            // const htmlContent = htmlTemplate.replace(/{{resetLink}}/g, resetLink);
            // const htmlContent1 = htmlContent.replace("{{mode}}", `Brokerage Created`);

            let option = {
                subject: "New Brokerage Created",
                message: template,
                email: OwnerDetail.email
            };
            if (config.length > 0) {
                option = {
                    ...option,
                    host: config[0].host,
                    port: config[0].port,
                    user: config[0].user,
                    pass: config[0].password,
                    from: config[0].from,
                }
            }

            await sendEmail(option);
        }

        return await responseSuccess(req, res, "brokerage created Succesfully", brokerageData)
    } catch (error) {
        logErrorToFile(error)
        console.log('error', error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.getleadsBrokerage = async (req, res) => {
    try {
        let brokerageData;
        let whereClause = {};
        let owner = {}
        if (req.query.cp_id) {
            owner = { lead_owner: decodeURIComponent(req.query.cp_id) }
        }
        if (req.query.status_id) {
            whereClause.status = decodeURIComponent(req.query.status_id)
        }
        if (req.query.f_date) {
            let startDate = new Date(req.query.f_date); // Start Date (00:00:00)
            let endDate = new Date(req.query.t_date);   // End Date (00:00:00 by default)

            endDate.setDate(endDate.getDate() + 1);
            whereClause.createdAt = {
                [Op.gte]: startDate,  // Start from f_date 00:00:00
                [Op.lt]: endDate      // Less than (but not including) next day's 00:00:00
            };
        } else {
            let weekStartDate = getCurrentWeekStartDate();
            let weekEndDate = getCurrentWeekEndDate();
            whereClause.createdAt = {
                [Op.gte]: weekStartDate, // Greater than or equal to current date at midnight
                [Op.lt]: weekEndDate// Less than current date + 1 day at midnight
            }
        }

        if (req.query.brokerage_id) {
            brokerageData = await req.config.leadBrokerage.findByPk(req.query.brokerage_id, {
                include: [
                    {
                        model: req.config.leadBooking,
                        as: 'BrokerageBookingtData',
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },

                        include: [
                            {
                                model: req.config.channelProject,
                                as: 'BookingprojectData',
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                        ]
                    },

                    {
                        model: req.config.leads,
                        as: 'BrokerageLeadData',
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                        include: [
                            {
                                model: req.config.users, paranoid: false,
                                as: 'leadOwner',
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                        ]
                    },

                ],
            })
        }
        else if (req.user.role_id === 3) {

            const getUserHierarchyQuery = `
                    WITH RECURSIVE user_hierarchy AS (
                        SELECT user_id, report_to
                        FROM db_users
                        WHERE user_id = :user_id
                        UNION
                        SELECT u.user_id, u.report_to
                        FROM db_users u
                        INNER JOIN user_hierarchy uh ON u.report_to = uh.user_id
                    )
                    SELECT user_id FROM user_hierarchy;
                `;

            const AllUsers = await req.config.sequelize.query(getUserHierarchyQuery, {
                replacements: { user_id: req.user.user_id },
                type: QueryTypes.SELECT
            });

            const userIds = AllUsers.map(user => user.user_id);

            brokerageData = await req.config.leadBrokerage.findAll({
                where: whereClause,
                include: [
                    {
                        model: req.config.leadBooking,
                        as: 'BrokerageBookingtData',
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                        include: [
                            {
                                model: req.config.channelProject,
                                as: 'BookingprojectData',
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                        ]
                    },
                    {
                        model: req.config.leads,
                        as: 'BrokerageLeadData',
                        where: { lead_owner: { [Op.in]: userIds } },
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                        include: [
                            {
                                model: req.config.users,
                                where: {
                                    report_to: req.user.user_id
                                },
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                                required: true
                            },
                        ],
                        required: true
                    },

                ],
                order: [["brokerage_id", "DESC"]],
            })
        }
        else if (req.user.role_id === 2) {
            // for brokergae data
            brokerageData = await req.config.leadBrokerage.findAll({
                where: whereClause,
                include: [
                    {
                        model: req.config.leadBooking,
                        as: 'BrokerageBookingtData',
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },

                        include: [
                            {
                                model: req.config.channelProject,
                                as: 'BookingprojectData',
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                        ]
                    },

                    {
                        model: req.config.leads,
                        as: 'BrokerageLeadData',
                        // where: { ...owner },
                        where: { lead_owner: req.user.user_id },
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                        include: [
                            {
                                model: req.config.users,
                                where: {
                                    report_to: req.user.user_id
                                },
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                                required: true
                            },
                        ],
                        required: true
                    },

                ],
                order: [["brokerage_id", "DESC"]],
            })
        }
        else {
            brokerageData = await req.config.leadBrokerage.findAll({
                where: whereClause,
                include: [
                    {
                        model: req.config.leadBooking,
                        as: 'BrokerageBookingtData',
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },

                        include: [
                            {
                                model: req.config.channelProject,
                                as: 'BookingprojectData',
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                        ]
                    },

                    {
                        model: req.config.leads,
                        as: 'BrokerageLeadData',
                        where: { ...owner },
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                        required: true,
                    },

                ],
                order: [["brokerage_id", "DESC"]],
            })
        }

        return await responseSuccess(req, res, "brokerageData list", brokerageData)

    } catch (error) {
        logErrorToFile(error)
        console.log("error", error)
        return await responseError(req, res, "brokerage fetching failed", error)
    }
}

exports.editleadsBrokerage = async (req, res) => {
    try {

        let body = req.body

        let brokerageData = await req.config.leadBrokerage.findByPk(body.brokerage_id)
        if (!brokerageData) return await responseError(req, res, "no brokerage existed")

        let brokerageNotData = await req.config.leadBrokerage.findOne({
            where: {
                brokerage_id: { [Op.ne]: body.brokerage_id },
                booking_id: body.booking_id
            }
        })
        if (brokerageNotData) return await responseError(req, res, "booking already exist with another brokerage")

        if (req.files && req.files.file) {
            req.body._imageName = brokerageData.bill_file || 0
            let client_image_4 = await fileUpload.imageExport(req, res, "brokerage");
            body.bill_file = client_image_4;
        }

        let booking_data = await req.config.leadBooking.findByPk(body.booking_id)
        await brokerageData.update(body)

        if (body.status) {
            await booking_data.update({
                status: body.status
            })
        }

        return await responseSuccess(req, res, "brokerage updated")

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "brokerage updated failed")
    }
}