const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const { responseError, responseSuccess } = require("../helper/responce");
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const sendEmail = require("../common/mailer");
const FieldModel = require("../model/FieldModel");
const { platform } = require("os");

// crerate new accounts
exports.storeAccount = async (req, res) => {
    const transaction = await req.config.sequelize.transaction();

    try {
        let accountBody = req.body;
        let prefix
        let count
        // Mapping account type IDs to their prefixes
        const accountPrefixes = {
            9: 'DC',
            10: 'A',
            11: 'MO',
            12: 'SI',
            13: 'P',
            14: 'MU'
        };
        if (accountPrefixes[accountBody.account_type_id]) {
            prefix = accountPrefixes[accountBody.account_type_id];
            count = await req.config.accounts.count({
                where: { account_type_id: accountBody.account_type_id },
            });
        }
        else {
            prefix = 'AC';
            count = await req.config.accounts.count();
        }

        // Check if the account already exists
        const existingAccount = await req.config.accounts.findOne({
            where: { acc_name: accountBody.acc_name },
            transaction,
        });

        if (existingAccount) {
            await transaction.rollback();
            return await responseError(req, res, "Account already exists");
        }

        // Assign account code
        accountBody.acc_code = `${prefix}${(count + 1).toString().padStart(7, '0')}`;

        // If a lead ID is provided, merge lead data into account data
        if (req.query.l_id) {
            const leadData = await req.config.leads.findOne({
                where: { lead_id: req.query.l_id },
            });

            if (leadData) {
                accountBody = {
                    ...accountBody,
                    acc_name: leadData.company_name,
                    acc_owner: leadData.lead_owner,
                    contact_no: leadData.p_contact_no,
                    bill_cont: leadData.country_id,
                    bill_state: leadData.state_id,
                    bill_city: leadData.city_id,
                    bill_pincode: leadData.pincode,
                    ship_cont: leadData.country_id,
                    ship_state: leadData.state_id,
                    ship_city: leadData.city_id,
                    ship_pincode: leadData.pincode,
                    ship_address: leadData.address,
                    assigned_to: leadData.assigned_lead
                };
            }
        }

        // Create the account
        const accountData = await req.config.accounts.create(accountBody, { transaction });
        let contactCount = await req.config.contacts.count()

        if (!req.query.l_id) {
            let contactDetails = {
                first_name: accountBody.emp_name,
                contact_code: `AC000${contactCount}`,
                account_name: accountData?.dataValues?.acc_id,
                contact_owner: accountBody.acc_owner,
                contact_no: parseInt(accountBody.contact_no),
                created_on: new Date(),
                updated_on: new Date(),
                mailing_cont: accountBody.bill_cont,
                mailing_state: accountBody.bill_state,
                mailing_city: accountBody.bill_city,
                mailing_pincode: accountBody.bill_pincode,
                mailing_address: accountBody.bill_address
            }

            let contactData = await req.config.contacts.create(contactDetails, { transaction })
        }

        // Fetch account owner details
        const accountOwnerDetail = await req.config.users.findByPk(accountBody.acc_owner);

        // Prepare email template

        const htmlTemplate = await req.config.emailTemplates.findOne({ where: { template_id: 11 } }) // Account Creation Template
        const template = htmlTemplate.template

        // const resetLink = `Account created with account name ${accountBody.acc_name} and account id ${accountBody.acc_code}`;
        // const htmlTemplatePath = path.join(__dirname, "..", "mail", "cp", "example.html");
        // const htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");
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
        const htmlContent = template.replace(/{{UserName}}/g, accountOwnerDetail.user).replace(/{{AccountName}}/g, accountBody.acc_name).replace(/{{AccountId}}/g, accountBody.acc_code).replace(/{{CompanyName}}/g, company_name);

        if (!accountOwnerDetail || !accountOwnerDetail.email) {
            await transaction.rollback();
            return await responseSuccess(req, res, "Please provide a valid account owner email", {});
        }

        // Fetch email config
        const emailConfig = await req.config.emailConfig.findAll();
        const emailOptions = {
            subject: "New Account Created",
            message: htmlContent,
            email: accountOwnerDetail.email,
            ...emailConfig.length && {
                host: emailConfig[0].host,
                port: emailConfig[0].port,
                user: emailConfig[0].user,
                pass: emailConfig[0].password,
                from: emailConfig[0].from,
            },
        };

        // Commit the transaction and send email
        await transaction.commit();
        await sendEmail(emailOptions);

        return await responseSuccess(req, res, "Account created successfully", accountData);

    } catch (error) {
        logErrorToFile(error);
        await transaction.rollback();
        return await responseError(req, res, "Something went wrong");
    }
};

exports.downloadExcelData = async (req, res) => {
    try {
        let whereClause = {};
        let commonExclude = ["createdAt", "updatedAt", "deletedAt"];
        if (!req.user.isDB) {
            whereClause = {
                [Op.or]: [
                    { acc_owner: req.user.user_id },
                    { assigned_to: req.user.user_id },
                ],
            };
        }
        let accounts = await req.config.accounts.findAll({
            where: whereClause,
            attributes: [
                "acc_id",
                "acc_name",
                "acc_code",
                "parent_id",
                "website",
                "contact_no",
                "emp_name",
                "desc",
                "bill_pincode",
                "acc_owner",
                "ship_pincode",
                "ship_address",
                "parent_name",
                "assigned_to",
                [
                    req.config.sequelize.fn(
                        "count",
                        req.config.sequelize.col("db_leads.acc_id")
                    ),
                    "lead_count",
                ],
            ],
            include: [
                { model: req.config.leads, required: false, paranoid: false },
                { model: req.config.accountTypes, paranoid: false },
                { model: req.config.industry, paranoid: false },
                {
                    model: req.config.users,
                    as: "account_owner",
                    attributes: ["user_id", "user"],
                    paranoid: false,
                },

                {
                    model: req.config.users,
                    as: "assignedAcc",
                    attributes: ["user_id", "user"],
                    paranoid: false,
                },
                {
                    model: req.config.country,
                    as: "billCountry",
                    attributes: {
                        exclude: commonExclude,
                    },
                    paranoid: false,
                },
                {
                    model: req.config.states,
                    as: "billState",
                    attributes: {
                        exclude: commonExclude,
                    },
                    paranoid: false,
                },

                {
                    model: req.config.city,
                    as: "billCity",
                    attributes: {
                        exclude: commonExclude,
                    },
                    paranoid: false,
                },
                {
                    model: req.config.country,
                    as: "shipCountry",
                    attributes: {
                        exclude: commonExclude,
                    },
                    paranoid: false,
                },
                {
                    model: req.config.states,
                    as: "shipState",
                    attributes: {
                        exclude: commonExclude,
                    },
                    paranoid: false,
                },

                {
                    model: req.config.city,
                    as: "shipCity",
                    attributes: {
                        exclude: commonExclude,
                    },
                    paranoid: false,
                },
            ],
            group: ["acc_id"],
            order: [["acc_id", "DESC"]],
        });
        //console.log("lead", lead[0].dataValues?.db_department.dataValues?.department)
        // console.log('lead', lead);
        let excelClientData = [];
        accounts?.forEach((element) => {
            let item = {
                Name: element?.dataValues?.acc_name,
                "Account Code": element?.dataValues?.acc_code,
                Type: element?.dataValues?.db_account_type?.dataValues
                    ?.account_type_name,
                Website: element?.dataValues?.website,
                Owner: element?.dataValues?.account_owner?.dataValues?.user,
                "Assigned To": element?.dataValues?.assignedAcc?.dataValues?.user,
                "Lead Count": element?.dataValues?.lead_count,
                "Parent name": element?.dataValues?.parent_name,
                "Contact no": element?.dataValues?.contact_no,
                Employee: element?.dataValues?.emp_name,
                Industry: element?.dataValues?.db_industry?.dataValues?.industry,
                Description: element?.dataValues?.desc,
                "Billing Country":
                    element?.dataValues?.billCountry?.dataValues?.country_name,
                "Billing State": element?.dataValues?.billState?.dataValues?.state_name,
                "Billing City": element?.dataValues?.billCity?.dataValues?.city_name,
                "Billing Pincode": element?.dataValues?.bill_pincode,
                "Shipping Country":
                    element?.dataValues?.shipCountry?.dataValues?.country_name,
                "Shipping State":
                    element?.dataValues?.shipState?.dataValues?.state_name,
                "Shipping City": element?.dataValues?.shipCity?.dataValues?.city_name,
                "Shipping Pincode": element?.dataValues?.ship_pincode,
                "Shipping Address": element?.dataValues?.ship_address,
            };
            excelClientData.push(item);
        });
        // let excelClientData = lead?.map((item)=> item.dataValues?)
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
    } catch (error) {
        logErrorToFile(error)
        console.log(error);
        return res
            .status(400)
            .json({ status: 400, message: "Something Went Wrong" });
    }
};

// get accounts
exports.getAccount = async (req, res) => {
    try {
        let accounts;
        let whereClause = {}
        if (req.query.platform_id) {
            whereClause = { platform_id: req.query.platform_id ? req.query.platform_id : 1 };
        }
        if (req.query.account_type_id) {
            whereClause = { account_type_id: req.query.account_type_id };
        }
        let commonExclude = ["createdAt", "updatedAt", "deletedAt"];

        if (!req.user.isDB && !req.query.all) {
            whereClause = {
                [Op.or]: [
                    { acc_owner: req.user.user_id },
                    { assigned_to: req.user.user_id },
                ],
            };
        }

        // if account id is provided then single query
        if (req.query.acc_id) {
            accounts = await req.config.accounts.findOne({
                where: {
                    acc_id: req.query.acc_id,
                },
                include: [
                    { model: req.config.accountField, separate: true, paranoid: false, order: [['field_order', 'ASC']] },
                    { model: req.config.accountTypes, paranoid: false },
                    { model: req.config.industry, paranoid: false },
                    {
                        model: req.config.users,
                        as: "account_owner",
                        attributes: ["user_id", "user"],
                        paranoid: false,
                    },
                    {
                        model: req.config.users,
                        as: "assignedAcc",
                        attributes: ["user_id", "user"],
                        paranoid: false,
                    },
                    {
                        model: req.config.country,
                        as: "billCountry",
                        attributes: {
                            exclude: commonExclude,
                        },
                        paranoid: false,
                    },
                    {
                        model: req.config.states,
                        as: "billState",
                        attributes: {
                            exclude: commonExclude,
                        },
                        paranoid: false,
                    },

                    {
                        model: req.config.city, as: "billCity", attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                    {
                        model: req.config.country, as: "shipCountry", attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                    {
                        model: req.config.states, as: "shipState", attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },

                    {
                        model: req.config.city, as: "shipCity", attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },

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
                    {
                        model: req.config.leads,
                        attributes: [
                            "lead_id",
                            "lead_name",
                            "createdAt"
                        ]
                    }


                ], order: [
                    ['acc_id', 'DESC']
                ]
            })
        } else {
            accounts = await req.config.accounts.findAll({
                where: whereClause,
                attributes: [
                    'acc_id', 'acc_name', "acc_code", "parent_id", "website",
                    'contact_no', 'emp_name', 'desc', 'bill_pincode', 'acc_owner',
                    'ship_pincode', 'ship_address', 'parent_name', 'assigned_to',
                    [req.config.sequelize.fn('count', req.config.sequelize.col('db_leads.acc_id')), 'lead_count']
                ],
                include: [
                    { model: req.config.leads, required: false, paranoid: false },
                    { model: req.config.accountTypes, paranoid: false, },
                    { model: req.config.industry, paranoid: false, },
                    { model: req.config.users, as: "account_owner", attributes: ['user_id', 'user'], paranoid: false, },
                    { model: req.config.users, as: "assignedAcc", attributes: ['user_id', 'user'], paranoid: false, },
                    {
                        model: req.config.country, as: "billCountry", attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                    {
                        model: req.config.states, as: "billState", attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },

                    {
                        model: req.config.city, as: "billCity", attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                    {
                        model: req.config.country, as: "shipCountry", attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
                    {
                        model: req.config.states, as: "shipState", attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },

                    {
                        model: req.config.city, as: "shipCity", attributes: {
                            exclude: commonExclude
                        }, paranoid: false,
                    },
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
                    {
                        model: req.config.leads,
                        attributes: [
                            "lead_id",
                            "lead_name",
                            "createdAt"
                        ]
                    }

                ],
                group: ['acc_id'],
                order: [
                    ['acc_id', 'DESC']
                ],

            })
        }
        await responseSuccess(req, res, "accounts list", accounts)

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }

};

let AllData = []; // store all Menu Data

const child = (item, i) => {
    let newobj = item;

    var countChild = AllData.filter((obj, j) => {
        return item.acc_id == obj.parent_id;
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

exports.getTreeAccount = async (req, res) => {
    try {
        let accounts = await req.config.sequelize.query(
            "SELECT acc_id, acc_name, parent_id, parent_name FROM db_accounts where deletedAt is null",
            {
                type: QueryTypes.SELECT,
            }
        );

        if (accounts.length > 0) {
            AllData = accounts; // storing all the cats data
            var parent_data = accounts.filter((obj, j) => {
                return obj.parent_id == 0;
            });

            var newArr = []; // storing tree data

            // initializing the child method first time

            parent_data.map((item, i) => {
                let finalData = child(item, i);
                newArr.push(finalData);
            });

            return responseSuccess(req, res, "ccount list", newArr);
        } else {
            return responseSuccess(req, res, "account list", accounts);
        }
    } catch (error) {
        logErrorToFile(error)
        console.log(error);
        return await responseError(req, res, "Something Went Wrong");
    }
};

exports.editAccount = async (req, res) => {
    const process = await req.config.sequelize.transaction();
    try {
        let accountBody = req.body;
        let accountData = await req.config.accounts.findOne({
            where: {
                acc_id: accountBody.acc_id,
            },
        }, { transaction: process });

        if (!accountData) {
            await process.cleanup()
            return await responseError(req, res, "no accounts exist");
        }

        let accountCheckData = await req.config.accounts.findOne({
            where: {
                acc_name: accountBody.acc_name,
                acc_id: { [Op.ne]: accountBody.acc_id },
            },
        });

        if (accountCheckData)
            return await responseError(req, res, "accounts name data exist");


        const config = await req.config.emailConfig.findAll();

        let data = await req.config.accounts.update(accountBody, {
            where: {
                acc_id: accountBody.acc_id,
            },
            transaction: process,
        });
        await process.commit();

        const accountOwnerDetail = await req.config.users.findByPk(accountBody.acc_owner);

        const emailTemplate = await req.config.emailTemplates.findOne({ where: { template_id: 12 } })  // Account Updation Template
        let template = emailTemplate.template

        // const resetLink = `Account Edited with account name ${accountBody.acc_name} and account id ${accountBody.acc_code}`;

        // const htmlTemplatePath = path.join(
        //     __dirname,
        //     "..",
        //     "mail",
        //     "cp",
        //     "example.html"
        // );

        // const htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");
        // template = template.replace(/{{resetLink}}/g, resetLink);
        // template = template.replace("{{mode}}", `Account Edited`);
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
        template = template.replace(/{{UserName}}/g, accountOwnerDetail.user).replace(/{{AccountName}}/g, accountBody.acc_name).replace(/{{AccountId}}/g, accountBody.acc_code).replace(/{{CompanyName}}/g, company_name);


        let option = {
            subject: "Account Edited",
            message: template,
            email: accountOwnerDetail.email
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

        return await responseSuccess(req, res, "Accounts Status Updated Successfully");
    } catch (error) {
        logErrorToFile(error)
        console.log(error);
        await process.rollback();
        return await responseError(req, res, "Something Went Wrong");
    }
};

exports.deleteAccount = async (req, res) => {
    try {
        let { acc_id } = req.query;
        let accountData = await req.config.accounts.findOne({
            where: {
                acc_id: acc_id,
            },
        });

        if (!accountData)
            return await responseError(req, res, "accounts does not existed");
        await accountData.destroy();
        return await responseSuccess(req, res, "accounts deleted");
    } catch (error) {
        logErrorToFile(error)
        console.log(error);
        return await responseError(req, res, "Something Went Wrong");
    }
};

exports.storeaccountField = async (req, res) => {

    try {
        const accFieldBody = req.body

        if (!accFieldBody || accFieldBody.length == 0) {
            return await responseSuccess(req, res, "acc extra data submitted successfully")
        }

        const existingFieldsArrayInAccounts = ["Owner", "Account Name *", "Account Name", 'Name', 'Account', "Owner *", "Type *", "Parent Account", "Website", "Contact No *", "Contact", "Industry *", "Employee *", "Description", "Created On", "Last Modified On", "Billing Country *", "Billing State *", "Billing City", "Zip / Postal Code *", "Billing Address", "Make Shipping Address same as Billing Address", "Shipping Country *", "Shipping State *", "Shipping City", "Shipping Address", 'Zip Code', 'Postal Code'];

        const customDuplicateEntries = accFieldBody.filter(field => {
            return existingFieldsArrayInAccounts.includes(field.field_lable);
        });

        if (customDuplicateEntries.length > 0) {
            return await responseError(req, res, `${customDuplicateEntries.length} fields are duplicates default fields.`);
        }

        const duplicateEntries = await req.config.accountField.findAll({
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

        let accFieldData = await req.config.accountField.bulkCreate(accFieldBody, {
            updateOnDuplicate: ["acc_field_id", "field_lable", "acc_id", "field_name", "field_order", "option", "input_value", "input_type", "field_type", "field_size"]
        });
        await responseSuccess(req, res, "acc extra data submitted successfully", accFieldData)
    } catch (error) {
        logErrorToFile(error)
        console.log(error)

        await responseError(req, res, "Something Went Wrong")
    }
}

exports.getaccountField = async (req, res) => {
    try {
        const AccData = await req.config.accountField.findAll({
        })
        await responseSuccess(req, res, "Account Data", AccData)
    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        await responseError(req, res, "Something Went Wrong")
    }
}

