const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const { responseError, responseSuccess } = require('../helper/responce')
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const sendEmail = require("../common/mailer");


exports.storeContact = async (req, res) => {
    try {
        let contactBody = req.body
        let contactData;
        let accuntData;
        let count = await req.config.contacts.count()
        if (req.query.l_id) {
            let lead_data = await req.config.leads.findOne({ where: { lead_id: req.query.l_id } })
            contactBody = {
                ...contactBody,
                contact_code: `AC000${count}`,
                contact_owner: lead_data.dataValues.lead_owner,
                contact_no: lead_data.dataValues?.p_contact_no,
                created_on: new Date(),
                updated_on: new Date(),
                mailing_cont: lead_data.dataValues?.country_id,
                mailing_state: lead_data.dataValues?.state_id,
                mailing_city: lead_data.dataValues?.city_id,
                mailing_pincode: lead_data.dataValues?.pincode,
                mailing_address: lead_data.dataValues?.address,
                assigned_to: lead_data.dataValues?.assigned_lead,
            }
        }
        if (contactBody.account_name) {
            accuntData = await req.config.accounts.findByPk(contactBody.account_name)
        }

        contactData = await req.config.contacts.create(contactBody)

        if (accuntData) {
            const OwnerDetail = await req.config.users.findByPk(req.user.user_id);

            const htmlTemplate = await req.config.emailTemplates.findOne({ where: { template_id: 13 } }) // Contact Creation Template
            let template = htmlTemplate.template

            // const resetLink = `Contact created with contact name ${contactBody.first_name} ${contactBody.last_name ? contactBody.last_name : null}  ${accuntData.acc_name ? 'for Account ' + accuntData.acc_name + ' ' : ' '}`;
            // const htmlTemplatePath = path.join(
            //     __dirname,
            //     "..",
            //     "mail",
            //     "cp",
            //     "example.html"
            // );
            // const htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");
            // htmlContent = htmlTemplate.replace(/{{resetLink}}/g, resetLink);
            // htmlContent1 = htmlContent.replace("{{mode}}", `Contact Created`);

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

            template = template.replace(/{{UserName}}/g, OwnerDetail.user).replace(/{{ContactName}}/g, contactBody.first_name + contactBody.last_name ? contactBody.last_name : null).replace(/{{AccountName}}/g, accuntData.acc_name).replace(/{{CompanyName}}/g, company_name);

            let option = {
                subject: "New Contact Created",
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
        }

        return await responseSuccess(req, res, "Contacts Created Succesfully", contactData)

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.downloadExcelData = async (req, res) => {
    try {

        whereClause = {};
        let commonExclude = ["createdAt", "updatedAt", "deletedAt"];
        if (!req.user.isDB) {
            whereClause = {
                [Op.or]: [
                    { contact_owner: req.user.user_id },
                    { assigned_to: req.user.user_id }
                ]
            }
        }
        if (req.query.type == 'ac_name') {
            whereClause.account_name = req.query.ac
        }

        let contacts = await req.config.contacts.findAll({
            where: whereClause,
            include: [
                {
                    model: req.config.accounts, as: "accountName", attributes: {
                        exclude: commonExclude
                    }, paranoid: false
                },

                { model: req.config.users, as: "contactOwner", attributes: ['user_id', 'user'], paranoid: false, },

                { model: req.config.users, as: "assignedContact", attributes: ['user_id', 'user'], paranoid: false, },

                {
                    model: req.config.country, as: "MaillingCountry", attributes: {
                        exclude: commonExclude
                    }, paranoid: false,
                },

                {
                    model: req.config.states, as: "MaillingState", attributes: {
                        exclude: commonExclude
                    }, paranoid: false,
                },


                {
                    model: req.config.city, as: "MaillingCity", attributes: {
                        exclude: commonExclude
                    }, paranoid: false,
                },
            ], order: [
                ['contact_id', 'DESC']
            ]
        })
        //console.log("lead", lead[0].dataValues.db_department.dataValues.department)
        // console.log('lead', lead);
        let excelClientData = []
        contacts?.forEach(element => {
            let item = {
                "Saluation": element?.dataValues?.saluation,
                "Name": element?.dataValues?.first_name ? element.dataValues?.first_name : null,
                "Owner": element?.dataValues?.contactOwner?.dataValues.user,
                "Assigned To": element?.dataValues?.assignedContact?.dataValues.user,
                "Email": element?.dataValues?.email_id,
                "Contact no": element?.dataValues?.contact_no,
                "Fax": element?.dataValues?.fax,
                "Account Name": element?.dataValues?.accountName?.dataValues?.acc_name,
                "designation": element?.dataValues?.designation,
                "Mailling Country": element?.dataValues?.MaillingCountry?.dataValues?.country_name,
                "Mailling State": element?.dataValues?.MaillingState?.dataValues?.state_name,
                "Mailling City": element?.dataValues?.MaillingCity?.dataValues?.city_name,
                "Mailling Pincode": element?.dataValues?.mailing_pincode,
                "Mailling Address": element?.dataValues?.mailing_address,
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

exports.getContact = async (req, res) => {
    try {

        let contacts;
        whereClause = {};
        let commonExclude = ["createdAt", "updatedAt", "deletedAt"];
        if (!req.user.isDB) {
            whereClause = {
                [Op.or]: [
                    { contact_owner: req.user.user_id },
                    { assigned_to: req.user.user_id }
                ]
            }
        }
        if (req.query.type == 'ac_name') {
            whereClause.account_name = req.query.ac
        }

        if (req.query.c_id) {
            contacts = await req.config.contacts.findOne({
                where: {
                    contact_id: req.query.c_id
                },
                include: [
                    { model: req.config.contactField, separate: true, attributes: { exclude: commonExclude }, paranoid: false, order: [['field_order', 'ASC']] },
                    {
                        model: req.config.accounts, as: "accountName", attributes: {
                            exclude: commonExclude
                        }, paranoid: false
                    },

                    { model: req.config.users, as: "contactOwner", attributes: ['user_id', 'user'], paranoid: false, },

                    { model: req.config.users, as: "assignedContact", attributes: ['user_id', 'user'], paranoid: false, },


                    {
                        model: req.config.country, as: "MaillingCountry", attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },

                    {
                        model: req.config.states, as: "MaillingState", attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },


                    {
                        model: req.config.city, as: "MaillingCity", attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },

                    {
                        model: req.config.leads,
                        attributes: [
                            "lead_id",
                            "lead_name",
                            "createdAt"
                        ],
                        include: [
                            {
                                model: req.config.accounts, attributes: {
                                    exclude: commonExclude
                                }, paranoid: false,
                            },
                            {
                                model: req.config.opportunities, attributes: {
                                    exclude: commonExclude
                                }, paranoid: false,
                            },
                        ]
                    }
                ], order: [
                    ['contact_id', 'DESC']
                ]
            })
        } else {

            contacts = await req.config.contacts.findAll({
                where: whereClause,
                include: [
                    {
                        model: req.config.accounts, as: "accountName", attributes: {
                            exclude: commonExclude
                        }, paranoid: false
                    },

                    { model: req.config.users, as: "contactOwner", attributes: ['user_id', 'user'], paranoid: false, },

                    { model: req.config.users, as: "assignedContact", attributes: ['user_id', 'user'], paranoid: false, },

                    {
                        model: req.config.country, as: "MaillingCountry", attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },

                    {
                        model: req.config.states, as: "MaillingState", attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },


                    {
                        model: req.config.city, as: "MaillingCity", attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                ], order: [
                    ['contact_id', 'DESC']
                ]
            })
        }
        return await responseSuccess(req, res, "contacts list", contacts)

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.editContact = async (req, res) => {
    try {
        let contactBody = req.body
        let accuntData;

        const config = await req.config.emailConfig.findAll();

        await req.config.contacts.update(contactBody, {
            where: {
                contact_id: contactBody.contact_id
            }
        })

        if (contactBody.account_name) {
            accuntData = await req.config.accounts.findByPk(contactBody.account_name)
        }

        const OwnerDetail = await req.config.users.findByPk(req.user.user_id);

        const htmlTemplate = await req.config.emailTemplates.findOne({ where: { template_id: 14 } }) // Contact Creation Template
        let template = htmlTemplate.template
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
        template = template.replace(/{{UserName}}/g, OwnerDetail.user).replace(/{{ContactName}}/g, contactBody.first_name + contactBody.last_name ? contactBody.last_name : null).replace(/{{AccountName}}/g, accuntData.acc_name).replace(/{{CompanyName}}/g, company_name);;

        // const resetLink = `Contact edited with contact name ${contactBody.first_name} ${contactBody.last_name ? contactBody.last_name : null}   ${accuntData.acc_name ? 'for Account ' + accuntData.acc_name + ' ' : ' '}`;
        // const htmlTemplatePath = path.join(
        //     __dirname,
        //     "..",
        //     "mail",
        //     "cp",
        //     "example.html"
        // );
        // const htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");
        // const htmlContent = htmlTemplate.replace(/{{resetLink}}/g, resetLink);
        // const htmlContent1 = htmlContent.replace("{{mode}}", `Contact Edited`);

        let option = {
            subject: "Contact edited",
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

        return await responseSuccess(req, res, "contacts updated")

    } catch (error) {
        logErrorToFile(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}


exports.deleteContact = async (req, res) => {
    try {

        let { c_id } = req.query
        let contactData = await req.config.contacts.findOne({
            where: {
                contact_id: c_id,
            }
        })
        if (!contactData) return await responseError(req, res, "contacts name does not existed")
        await contactData.destroy()
        return await responseSuccess(req, res, "contacts deleted")

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.storecontactField = async (req, res) => {
    try {
        const accFieldBody = req.body

        if (!accFieldBody || accFieldBody.length == 0) {
            return await responseSuccess(req, res, "contact extra data submitted successfully")
        }

        const existingFieldsArrayInContact = ["Owner *", "Owner", "Account Name *", "Account Name", "Name", "Saluation", "First Name *", "First Name", "Middle Name", "Last Name *", "Last Name", "Designation", "Contact No*", "Contact No", "Email", "Email Id", "Fax", "Created On", "Last Modified On", "Mailing Country", "Mailing State", "Mailing City", "Zip / Postal Code", "Mailing Full Address"];

        const customDuplicateEntries = accFieldBody.filter(field => {
            return existingFieldsArrayInContact.includes(field.field_lable);
        });

        if (customDuplicateEntries.length > 0) {
            return await responseError(req, res, `${customDuplicateEntries.length} fields are duplicates default fields.`);
        }

        const duplicateEntries = await req.config.contactField.findAll({
            where: {
                [Op.in]: accFieldBody.map(field => ({
                    field_lable: field.field_lable.trim(),
                }))
            },
            attributes: ['field_lable']
        });

        if (duplicateEntries.length > 0) {
            return await responseError(req, res, `${duplicateEntries.length} fields are duplicate.`)
        }

        let accFieldData = await req.config.contactField.bulkCreate(accFieldBody, {
            updateOnDuplicate: ["acc_field_id", "field_lable", "acc_id", "field_name", "field_order", "option", "input_value", "input_type", "field_type", "field_size"]
        })

        await responseSuccess(req, res, "contact extra data submitted successfully", accFieldData)
    } catch (error) {
        logErrorToFile(error)
        console.log(error);
        await responseError(req, res, "Something Went Wrong")
    }

}

exports.getcontactField = async (req, res) => {
    try {
        const AccData = await req.config.contactField.findAll({
        })
        await responseSuccess(req, res, "contact Data", AccData)
    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        await responseError(req, res, "Something Went Wrong")
    }
}