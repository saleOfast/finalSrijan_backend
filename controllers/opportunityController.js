const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const { responseError, responseSuccess } = require('../helper/responce')
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const sendEmail = require("../common/mailer");

exports.storeOpportunity = async (req, res) => {
    const process = await req.config.sequelize.transaction();
    try {
        let opportunityBody = req.body
        let opportunityData;

        let count = await req.config.opportunities.count()

        if (req.query.l_id) {
            let lead_data = await req.config.leads.findOne({ where: { lead_id: req.query.l_id } })

            opportunityBody = {
                ...opportunityBody,
                close_date: new Date(new Date().setDate(new Date().getDate() + 10)),
                opportunity_stg_id: 2,
                opportunity_type_id: 1,
                amount: 0,
                opp_code: `OP000${count}`,
                opp_owner: lead_data.dataValues.lead_owner,
                lead_src_id: lead_data.dataValues?.lead_src_id,
                created_on: new Date(),
                updated_on: new Date(),
                assigned_to: lead_data.dataValues?.assigned_lead,
            }
        }

        opportunityData = await req.config.opportunities.create(opportunityBody, { transaction: process })

        let orgInfo = await req.config.organisationInfo.findOne({
            attributes: ['company_name']
        })
        console.log('orgInfo', orgInfo)
        let company_name = orgInfo?.company_name || 'Srijan Bandhan'
        console.log('company_name', company_name)

        const OwnerDetail = await req.config.users.findByPk(req.user.user_id);

        const htmlTemplate = await req.config.emailTemplates.findOne({ where: { template_id: 18 } }) // Opportunity Creation Template
        let template = htmlTemplate.template

        template = template.replace(/{{UserName}}/g, OwnerDetail.user).replace(/{{OpportunityId}}/g, opportunityBody.opp_code).replace(/{{CompanyName}}/g, company_name);

        let option = {
            subject: "New Opportunity Created",
            message: template,
            email: OwnerDetail.email
        };

        const config = await req.config.emailConfig.findAll();

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
        process.commit();
        return await responseSuccess(req, res, "Opportunity Created Succesfully", opportunityData)

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        await process.rollback();
        return await responseError(req, res, "Something Went Wrong")
    }
}

const dateChange = (date) => {
    const dueDate = new Date(date);
    const formattedDueDate = dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return formattedDueDate
}

exports.downloadExcelData = async (req, res) => {
    try {

        let whereClause = {};
        let commonExclude = ["createdAt", "updatedAt", "deletedAt"];
        if (req.query.type == 'ac_name') {
            whereClause.account_name = req.query.ac
        }
        if (!req.user.isDB) {
            whereClause = {
                [Op.or]: [
                    { opp_owner: req.user.user_id },
                    { assigned_to: req.user.user_id }
                ]
            }
        }

        let opportunities = await req.config.opportunities.findAll({
            where: whereClause,
            include: [
                {
                    model: req.config.accounts, as: "accName", attributes: {
                        exclude: ["createdAt", "updatedAt", "deletedAt"]
                    }, paranoid: false
                },

                { model: req.config.users, as: "oppOwner", attributes: ['user_id', 'user'], paranoid: false, },

                { model: req.config.users, as: "assignedOpp", attributes: ['user_id', 'user'], paranoid: false, },

                {
                    model: req.config.opprType, attributes: {
                        exclude: ["createdAt", "updatedAt", "deletedAt"]
                    }, paranoid: false
                },

                {
                    model: req.config.opprStage, attributes: {
                        exclude: ["createdAt", "updatedAt", "deletedAt"]
                    }, paranoid: false
                },

                {
                    model: req.config.leadSources, attributes: {
                        exclude: ["createdAt", "updatedAt", "deletedAt"]
                    }, paranoid: false
                },
            ], order: [
                ['opp_id', 'DESC']
            ]
        })

        let excelClientData = []
        opportunities?.forEach(element => {
            let item = {
                "Name": element?.dataValues?.opp_name,
                "Owner": element?.dataValues?.oppOwner?.dataValues?.user,
                "Assigned To": element?.dataValues?.assignedOpp?.dataValues?.user,
                "Type": element?.dataValues?.db_opportunity_type?.dataValues?.opportunity_type_name,
                "Stage": element?.dataValues?.db_opportunity_stg?.dataValues?.opportunity_stg_name,
                "Account Name": element?.dataValues.accName?.dataValues.acc_name,
                "Close Date": dateChange(element?.dataValues?.close_date),
                "Amount": element?.dataValues?.amount,
                "Description": element?.dataValues?.desc,
                "Lead Source": element?.dataValues?.db_lead_source?.dataValues?.source,
            }
            excelClientData.push(item)
        });
        // let excelClientData = lead?.map((item)=> item.dataValues)
        const workbook = xlsx.utils.book_new();
        const worksheet = xlsx.utils.json_to_sheet(excelClientData);
        // Add the worksheet to the workbook
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

        // Generate a temporary file path to save the Excel workbook
        const tempFilePath = path.join(__dirname, `../uploads/temp`, 'temp.xlsx');

        // Write the workbook to a file
        xlsx.writeFile(workbook, tempFilePath);

        // Set the response headers
        res.setHeader('Content-Type', 'application/vnd.ms-excel');
        res.setHeader('Content-Disposition', 'attachment; filename=example.xlsx');

        // Stream the file to the response
        const stream = fs.createReadStream(tempFilePath);
        stream.pipe(res);

        // Delete the temporary file after sending the response
        stream.on('end', () => {
            fs.unlinkSync(tempFilePath);
        });

        return
    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return res.status(400).json({ status: 400, message: "Something Went Wrong" })
    }
}

exports.getOpportunity = async (req, res) => {
    try {

        let opportunities;
        whereClause = {};
        if (req.query.type == 'ac_name') {
            whereClause.account_name = req.query.ac
        }
        if (!req.user.isDB) {
            whereClause = {
                [Op.or]: [
                    { opp_owner: req.user.user_id },
                    { assigned_to: req.user.user_id }
                ]
            }
        }

        if (req.query.o_id) {
            opportunities = await req.config.opportunities.findOne({
                where: {
                    opp_id: req.query.o_id
                },
                include: [
                    {
                        model: req.config.accounts, as: "accName", attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"]
                        }, paranoid: false
                    },

                    { model: req.config.users, as: "oppOwner", attributes: ['user_id', 'user'], paranoid: false, },

                    { model: req.config.users, as: "assignedOpp", attributes: ['user_id', 'user'], paranoid: false, },

                    {
                        model: req.config.opprStage, attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"]
                        }, paranoid: false
                    },

                    {
                        model: req.config.opprType, attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"]
                        }, paranoid: false
                    },

                    {
                        model: req.config.leadSources, attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"]
                        }, paranoid: false
                    },

                    {
                        model: req.config.opportunityField, attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"]
                        }, paranoid: false
                    },

                    {
                        model: req.config.quatMasters,
                        as: "quatOpportunityList",
                        attributes: [
                            "quat_mast_id",
                            "quat_code",
                            "genrated_date",
                            "grand_total",
                        ]
                    },

                    {
                        model: req.config.leads,
                        attributes: [
                            "lead_id",
                            "lead_name",
                            "createdAt"
                        ]
                    }

                ], order: [
                    ['opp_id', 'DESC']
                ]
            })
        } else {
            opportunities = await req.config.opportunities.findAll({
                where: whereClause,
                include: [
                    {
                        model: req.config.accounts, as: "accName", attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"]
                        }, paranoid: false
                    },

                    { model: req.config.users, as: "oppOwner", attributes: ['user_id', 'user'], paranoid: false, },

                    { model: req.config.users, as: "assignedOpp", attributes: ['user_id', 'user'], paranoid: false, },

                    {
                        model: req.config.opprType, attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"]
                        }, paranoid: false
                    },

                    {
                        model: req.config.opprStage, attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"]
                        }, paranoid: false
                    },

                    {
                        model: req.config.leadSources, attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"]
                        }, paranoid: false
                    },
                ], order: [
                    ['opp_id', 'DESC']
                ]
            })
        }
        return await responseSuccess(req, res, "opportunities list", opportunities)

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.editOpportunity = async (req, res) => {
    try {
        let body = req.body

        await req.config.opportunities.update(body, {
            where: {
                opp_id: body.opp_id
            }
        })
        return await responseSuccess(req, res, "opportunities updated")

    } catch (error) {
        logErrorToFile(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.deleteOpportunity = async (req, res) => {
    try {

        let { o_id } = req.query
        let opportunityData = await req.config.opportunities.findOne({
            where: {
                opp_id: o_id,
            }
        })
        if (!opportunityData) return await responseError(req, res, "opportunities name does not existed")
        await opportunityData.destroy()
        return await responseSuccess(req, res, "opportunities deleted")

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.storeExtraOpportunity = async (req, res) => {
    const process = await req.config.sequelize.transaction();
    try {
        const opportunityExtraBody = req.body

        if (!opportunityExtraBody || opportunityExtraBody.length == 0) {
            return await responseSuccess(req, res, "Opportunity extra data submitted successfully")
        }

        const existingFieldsArrayInOpportunities = ["Opportunity Name *", "Opportunity Name", "Name", "Account Name *", "Account Name", "Contact Name *", "Contact Name", "Close date *", "Stage *", "Owner *", "Type *", "Close date", "Stage", "Owner", "Type", "Amount/Value *", "Lead Source *", "Description", "Amount/Value", "Lead Source", "Product of Services", "Quantity", "Price", "Created On", "Last Modified On"
        ];

        const customDuplicateEntries = opportunityExtraBody.filter(field => {
            return existingFieldsArrayInOpportunities.includes(field.field_lable);
        });

        if (customDuplicateEntries.length > 0) {
            return await responseError(req, res, `${customDuplicateEntries.length} fields are duplicates default fields.`);
        }

        const duplicateEntries = await req.config.opportunityField.findAll({
            where: {
                [Op.in]: opportunityExtraBody.map(field => ({
                    field_lable: field.field_lable.trim(),
                }))
            },
            attributes: ['field_lable']
        });

        if (duplicateEntries.length > 0) {
            return await responseError(req, res, `${duplicateEntries.length} fields are duplicate.`)
        }

        let opportunityExtraData = await req.config.opportunityField.bulkCreate(opportunityExtraBody, { updateOnDuplicate: ["opp_field_id", "field_lable", "opportunity", "field_name", "field_order", "option", "input_value", "input_type", "field_type", "field_size"] })

        await process.commit();
        await responseSuccess(req, res, "Opportunity extra data submitted successfully", opportunityExtraData)
    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        await process.rollback();
        await responseError(req, res, "Something Went Wrong")
    }
}