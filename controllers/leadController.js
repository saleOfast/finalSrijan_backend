const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const { responseSuccess, responseError } = require("../helper/responce");
const sendEmail = require("../common/mailer")
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');


const zeroPad = (num, places) => String(num).padStart(places, '0');

const parseDateToDbDateOnly = (value) => {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }

    const raw = String(value).trim();
    const yyyyMmDdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (yyyyMmDdMatch) {
        return raw;
    }

    const ddMmYyyyMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ddMmYyyyMatch) {
        const [, dd, mm, yyyy] = ddMmYyyyMatch;
        const parsed = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
        if (
            parsed.getUTCFullYear() === Number(yyyy) &&
            parsed.getUTCMonth() + 1 === Number(mm) &&
            parsed.getUTCDate() === Number(dd)
        ) {
            return `${yyyy}-${mm}-${dd}`;
        }
    }

    return null;
};

const formatDateToDdMmYyyy = (value) => {
    if (!value) return value;
    const raw = String(value).slice(0, 10);
    const parts = raw.split("-");
    if (parts.length !== 3) return value;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const applyLeadDateFormat = (leadRecord) => {
    if (!leadRecord) return;
    if (leadRecord.dataValues) {
        leadRecord.dataValues.follow_up_date = formatDateToDdMmYyyy(leadRecord.dataValues.follow_up_date);
        return;
    }
    leadRecord.follow_up_date = formatDateToDdMmYyyy(leadRecord.follow_up_date);
};
// craete new lead

exports.storeLead = async (req, res) => {
    const process = await req.config.sequelize.transaction();
    try {
        const OwnerDetail = await req.config.users.findByPk(req.user.user_id);

        let leadData = req.body
        const parsedFollowUpDate = parseDateToDbDateOnly(leadData.follow_up_date);
        if (leadData.follow_up_date !== undefined && parsedFollowUpDate === null) {
            await process.rollback();
            return await responseError(req, res, "follow_up_date must be in DD/MM/YYYY format");
        }
        if (leadData.follow_up_date !== undefined) {
            leadData.follow_up_date = parsedFollowUpDate;
        }
        if (!leadData.status) {
            leadData.status = "OPEN";
        }
        let leadcount = await req.config.leads.count({ paranoid: false })
        leadData.assigned_by = req.user.user_id
        leadData.lead_code = `${req.admin.user.charAt(0).toUpperCase()}${req.admin.user_l_name ? req.admin.user_l_name.charAt(0).toUpperCase() : ''}L_${zeroPad(leadcount + 1, 5)}`

        let lead = await req.config.leads.create(leadData, {
            transaction: process
        })

        await process.commit();

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

        const htmlTemplate = await req.config.emailTemplates.findOne({ where: { template_id: 15 } }) // Lead Creation Template
        let template = htmlTemplate.template

        template = template.replace(/{{UserName}}/g, OwnerDetail.user).replace(/{{LeadName}}/g, leadData.lead_name).replace(/{{LeadId}}/g, leadData.lead_code).replace(/{{CompanyName}}/g, company_name);;

        // const resetLink = `Lead created with lead name ${leadData.lead_name} and lead id ${leadData.lead_code}`;
        // const htmlTemplatePath = path.join(
        //     __dirname,
        //     "..",
        //     "mail",
        //     "cp",
        //     "example.html"
        // );
        // const htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");
        // const htmlContent = htmlTemplate.replace(/{{resetLink}}/g, resetLink);
        // const htmlContent1 = htmlContent.replace("{{mode}}", `Lead Created`);

        let option = {
            subject: "New Lead Created",
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
        await responseSuccess(req, res, "lead created successfully", lead)
    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        await process.rollback();
        await responseError(req, res, "Something Went Wrong")
    }
}

exports.storeExtraLead = async (req, res) => {
    const process = await req.config.sequelize.transaction();
    try {
        const leadExtraBody = req.body

        if (!leadExtraBody || leadExtraBody.length == 0) {
            return await responseSuccess(req, res, "contact extra data submitted successfully")
        }

        const existingFieldsArrayInLeads = ["Owner", "Name *", 'Name', "Status", "Source", "Lead Type", "Organization Name *", "Details", "Contact Name", "Email Id", "Personal Contact No.", "Whatsapp No.", "Official No.", "Created On", "Last Modified On", "Country", "State", "City", "Zip / Postal Code", "Address", 'Zip', 'Zip Code', 'Postal Code'];

        const customDuplicateEntries = leadExtraBody.filter(field => {
            return existingFieldsArrayInLeads.includes(field.field_lable);
        });

        if (customDuplicateEntries.length > 0) {
            return await responseError(req, res, `${customDuplicateEntries.length} fields are duplicates default fields.`);
        }

        const duplicateEntries = await req.config.leadField.findAll({
            where: {
                [Op.in]: leadExtraBody.map(field => ({
                    field_lable: field.field_lable.trim(),
                }))
            },
            attributes: ['field_lable']
        });

        if (duplicateEntries.length > 0) {
            return await responseError(req, res, `${duplicateEntries.length} fields are duplicate.`)
        }

        let leadExtraData = await req.config.leadField.bulkCreate(leadExtraBody, { updateOnDuplicate: ["lead_field_id", "field_lable", "lead", "field_name", "field_order", "option", "input_value", "input_type", "field_type", "field_size"] })
        await process.commit();
        await responseSuccess(req, res, "lead extra data submitted successfully", leadExtraData)
    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        await process.rollback();
        await responseError(req, res, "Something Went Wrong")
    }
}

exports.downloadExcelData = async (req, res) => {
    try {

        whereClause = {};
        let commonExclude = ["createdAt", "updatedAt", "deletedAt"];
        if (!req.user.isDB) {
            whereClause = {
                [Op.or]: [
                    { assigned_lead: req.user.user_id },
                    { assigned_by: req.user.user_id }
                ]
            }
        }
        let lead = await req.config.leads.findAll({
            where: whereClause,
            include: [
                {
                    model: req.config.departments, attributes: {
                        exclude: commonExclude
                    }, paranoid: false,
                },
                {
                    model: req.config.leadStatuses, attributes: {
                        exclude: commonExclude
                    }, paranoid: false,
                },
                {
                    model: req.config.leadSources, attributes: {
                        exclude: commonExclude
                    }, paranoid: false,
                },
                {
                    model: req.config.country, attributes: {
                        exclude: commonExclude
                    }, paranoid: false,
                },
                {
                    model: req.config.states, attributes: {
                        exclude: commonExclude
                    }, paranoid: false,
                },
                {
                    model: req.config.city, attributes: {
                        exclude: commonExclude
                    }, paranoid: false,
                },
                {
                    model: req.config.users, attributes: {
                        exclude: ['password']
                    }, paranoid: false,
                },

                {
                    model: req.config.users, as: "leadAssignedBy", attributes: {
                        exclude: ['password']
                    }, paranoid: false,
                },

                {
                    model: req.config.users, as: "leadOwner", attributes: {
                        exclude: ['password']
                    }, paranoid: false,
                },
                {
                    model: req.config.accounts, attributes: {
                        exclude: commonExclude
                    }, paranoid: false,
                },
                {
                    model: req.config.contacts, attributes: {
                        exclude: commonExclude
                    }, paranoid: false,
                },
                {
                    model: req.config.opportunities, attributes: {
                        exclude: commonExclude
                    }, paranoid: false,
                },
                {
                    model: req.config.leadTypes, attributes: {
                        exclude: commonExclude
                    }, paranoid: false,
                },
            ], order: [
                ['lead_id', 'DESC']
            ]
        })
        //console.log("lead", lead[0].dataValues.db_department.dataValues.department)
        // console.log('lead', lead);
        let excelClientData = []
        lead?.forEach(element => {
            let item = {
                "Name": element?.dataValues?.lead_name,
                "Company Name": element?.dataValues?.company_name,
                "Email": element?.dataValues?.email_id,
                "Personal Contact no": element?.dataValues?.p_contact_no,
                "Whatsapp no": element?.dataValues?.whatsapp_no,
                "Official no": element?.dataValues?.official_no,
                "Detail": element?.dataValues?.lead_detail,
                "Status": element?.dataValues?.db_lead_status?.dataValues?.status_name,
                "Source": element?.dataValues?.db_lead_source?.dataValues?.source,
                "Owner": element?.dataValues?.leadOwner?.dataValues?.user,
                "Assigned By": element?.dataValues?.leadAssignedBy?.dataValues.user,
                "Assigned To": element?.dataValues?.db_user?.dataValues?.user,
                "Country": element?.dataValues?.db_country?.dataValues?.country_name,
                "State": element?.dataValues?.db_state?.dataValues?.state_name,
                "City": element?.dataValues?.db_city?.dataValues?.city_name,
                "Pincode": element?.dataValues?.pincode,
                "Address": element?.dataValues?.address,
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

// get lead list or one lead 
exports.getLeadList = async (req, res) => {
    try {

        whereClause = {};
        let commonExclude = ["createdAt", "updatedAt", "deletedAt"];
        if (!req.user.isDB) {
            whereClause = {
                [Op.or]: [
                    { assigned_lead: req.user.user_id },
                    { assigned_by: req.user.user_id },
                ]
            }
        }

        let lead;
        let accounts
        if (req.query.l_id) {
            lead = await req.config.leads.findOne({
                where: {
                    lead_id: req.query.l_id
                },
                include: [
                    {
                        model: req.config.departments, attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                    {
                        model: req.config.leadStatuses, attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                    {
                        model: req.config.leadSources, attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                    {
                        model: req.config.country, attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                    {
                        model: req.config.states, attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                    {
                        model: req.config.city, attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                    {
                        model: req.config.users, attributes: {
                            exclude: ['password']
                        }, paranoid: false,
                    },

                    {
                        model: req.config.users, as: "leadAssignedBy", attributes: {
                            exclude: ['password']
                        }, paranoid: false,
                    },

                    {
                        model: req.config.users, as: "leadOwner", attributes: {
                            exclude: ['password']
                        }, paranoid: false,
                    },

                    {
                        model: req.config.accounts, attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                    {
                        model: req.config.contacts, attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                    {
                        model: req.config.opportunities, attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                    {
                        model: req.config.leadSources, attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                    {
                        model: req.config.leadField, attributes: {
                            exclude: commonExclude
                        }, separate: true, paranoid: false, order: [['field_order', 'ASC']]
                    },
                    {
                        model: req.config.leadTypes, attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                ], order: [
                    ['lead_id', 'DESC']
                ]
            })
            if (lead.acc_id) {
                accounts = await req.config.accounts.findOne({
                    where: {
                        acc_id: lead.acc_id,
                    },
                    include: [
                        {
                            model: req.config.contacts,
                            as: "contactList",
                            attributes: [
                                "contact_id",
                                "first_name",
                                "middle_name",
                                "last_name",
                            ]
                        },

                        {
                            model: req.config.opportunities,
                            as: "oppList",
                            attributes: [
                                "opp_id",
                                "opp_name",
                                "amount"
                            ]
                        },
                    ], order: [
                        ['acc_id', 'DESC']
                    ]
                })

                lead.dataValues.oppList = accounts.dataValues.oppList
                lead.dataValues.contactList = accounts.dataValues.contactList
                lead.dataValues.accountlist = [lead.dataValues.db_account]
            }
        } else {
            lead = await req.config.leads.findAll({
                where: whereClause,
                include: [
                    {
                        model: req.config.departments, attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                    {
                        model: req.config.leadStatuses, attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                    {
                        model: req.config.leadSources, attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                    {
                        model: req.config.country, attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                    {
                        model: req.config.states, attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                    {
                        model: req.config.city, attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                    {
                        model: req.config.users, attributes: {
                            exclude: ['password']
                        }, paranoid: false,
                    },

                    {
                        model: req.config.users, as: "leadAssignedBy", attributes: {
                            exclude: ['password']
                        }, paranoid: false,
                    },

                    {
                        model: req.config.users, as: "leadOwner", attributes: {
                            exclude: ['password']
                        }, paranoid: false,
                    },
                    {
                        model: req.config.accounts, attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                    {
                        model: req.config.contacts, attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                    {
                        model: req.config.opportunities, attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                ], order: [
                    ['lead_id', 'DESC']
                ]
            })
        }

        if (Array.isArray(lead)) {
            lead.forEach(applyLeadDateFormat);
        } else {
            applyLeadDateFormat(lead);
        }

        await responseSuccess(req, res, "lead list", lead)
    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        await responseError(req, res, "Something Went Wrong")
    }
}

exports.editLead = async (req, res) => {
    const requestBody = req.body || {};
    const isStatusRemarkOrFollowUpUpdate =
        Object.prototype.hasOwnProperty.call(requestBody, "status") ||
        Object.prototype.hasOwnProperty.call(requestBody, "remark") ||
        Object.prototype.hasOwnProperty.call(requestBody, "follow_up_date");
    const isAdminOrBST =
        req.user?.isDB === true ||
        Number(req.user?.role_id) === 2 ||
        Number(req.user?.role_id) === 3;
    if (isStatusRemarkOrFollowUpUpdate && !isAdminOrBST) {
        return res.status(403).json({
            success: false,
            message: "You are not authorized to update status, remark or follow_up_date",
        });
    }

    const process = await req.config.sequelize.transaction();
    try {
        let leadData = req.body
        const parsedFollowUpDate = parseDateToDbDateOnly(leadData.follow_up_date);
        if (leadData.follow_up_date !== undefined && parsedFollowUpDate === null) {
            await process.rollback();
            return await responseError(req, res, "follow_up_date must be in DD/MM/YYYY format");
        }
        if (leadData.follow_up_date !== undefined) {
            leadData.follow_up_date = parsedFollowUpDate;
        }

        if (leadData.loss_reason) {
            let lead = await req.config.losses.findByPk(leadData.loss_reason)
            leadData.loss_reason = lead.loss_reason
        }

        const config = await req.config.emailConfig.findAll();

        let lead = await req.config.leads.update(leadData, {
            where: {
                lead_id: leadData.lead_id
            },
            transaction: process
        })

        if (req.query.as) {
            let assignedLeadUser = await req.config.users.findOne({
                where: {
                    user_id: req.body.assigned_lead
                },
                paranoid: false
            })
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
            const htmlTemplate = await req.config.emailTemplates.findOne({ where: { template_id: 16 } }) // Lead Assigned Template
            let template = htmlTemplate.template

            template = template.replace(/{{UserName}}/g, assignedLeadUser.user).replace(/{{LeadName}}/g, lead.lead_name).replace(/{{LeadId}}/g, lead.lead_code).replace(/{{CompanyName}}/g, company_name);

            // sending email to user
            let option = {
                email: assignedLeadUser.email,
                subject: "Lead Assigned",
                message: template,
            }
            await sendEmail(option);
        }

        await process.commit();

        const OwnerDetail = await req.config.users.findByPk(req.user.user_id);
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
        const htmlTemplate = await req.config.emailTemplates.findOne({ where: { template_id: 17 } }) // Lead Update Template
        let template = htmlTemplate.template

        template = template.replace(/{{UserName}}/g, OwnerDetail.user).replace(/{{LeadName}}/g, lead.lead_name).replace(/{{LeadId}}/g, lead.lead_code).replace(/{{CompanyName}}/g, company_name);

        // const resetLink = `Lead edited with lead name ${leadData.lead_name} and lead id ${leadData.lead_code}`;
        // const htmlTemplatePath = path.join(
        //     __dirname,
        //     "..",
        //     "mail",
        //     "cp",
        //     "example.html"
        // );
        // const htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");
        // const htmlContent = htmlTemplate.replace(/{{resetLink}}/g, resetLink);
        // const htmlContent1 = htmlContent.replace("{{mode}}", `Lead Edited`);

        let option = {
            subject: "Lead Updated",
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


        await responseSuccess(req, res, "lead updated successfully", lead)
    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        await process.rollback();
        await responseError(req, res, "Something Went Wrong")
    }
}

exports.deleteLead = async (req, res) => {
    try {
        let leadID = req.query.l_id

        let leadData = await req.config.leads.findOne({
            where: {
                lead_id: leadID
            },
        })

        if (!leadData) return await responseError(req, res, "No lead found")
        await leadData.destroy()
        await responseSuccess(req, res, "lead deleted successfully")
    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        await responseError(req, res, "Something Went Wrong")
    }
}

exports.getTaskListByLeadID = async (req, res) => {
    try {

        let { l_id, link_with_opportunity } = req.query
        let whereClause
        if (link_with_opportunity) {
            whereClause = { link_with_opportunity: link_with_opportunity }
        }
        if (l_id) {
            whereClause = { lead_id: l_id }
        }
        let tasksData = await req.config.tasks.findAll({
            where: whereClause,
            include: [
                { model: req.config.taskStatus },
                { model: req.config.taskPriority },
                {
                    model: req.config.users, as: "createdByUser", attributes: {
                        exclude: ['password']
                    }, paranoid: false,
                },
                {
                    model: req.config.users, as: "assignedToUser", attributes: {
                        exclude: ['password']
                    }, paranoid: false
                }
            ]
            , order: [
                ['task_id', 'DESC']
            ]
        })

        if (!tasksData) return await responseError(req, res, "task does not existed")
        return await responseSuccess(req, res, "task list in lead", tasksData)

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}


