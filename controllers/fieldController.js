const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const { responseSuccess, responseError } = require("../helper/responce");
const sendEmail = require("../common/mailer")
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

exports.storeField = async (req, res) => {
    try {
        const FiledBody = req.body;

        if (!FiledBody || FiledBody.length == 0) {
            return await responseSuccess(req, res, "lead extra data submitted successfully")
        }

        let fields = FiledBody.map(entry => ({
            field_lable: entry.field_lable.trim(),
            navigate_type: entry.navigate_type
        }));

        const existingFieldsArrayInLeads = ["Owner", "Name *", 'Name', "Status", "Source", "Lead Type", "Organization Name *", "Details", "Contact Name", "Email Id", "Personal Contact No.", "Whatsapp No.", "Official No.", "Created On", "Last Modified On", "Country", "State", "City", "Zip / Postal Code", "Address", 'Zip', 'Zip Code', 'Postal Code'];

        const existingFieldsArrayInAccounts = ["Owner", "Account Name *", "Account Name", 'Name', 'Account', "Owner *", "Type *", "Parent Account", "Website", "Contact No *", "Contact", "Industry *", "Employee *", "Description", "Created On", "Last Modified On", "Billing Country *", "Billing State *", "Billing City", "Zip / Postal Code *", "Billing Address", "Make Shipping Address same as Billing Address", "Shipping Country *", "Shipping State *", "Shipping City", "Shipping Address", 'Zip Code', 'Postal Code'];

        const existingFieldsArrayInContact = ["Owner *", "Owner", "Account Name *", "Account Name", "Name", "Saluation", "First Name *", "First Name", "Middle Name", "Last Name *", "Last Name", "Designation", "Contact No*", "Contact No", "Email", "Email Id", "Fax", "Created On", "Last Modified On", "Mailing Country", "Mailing State", "Mailing City", "Zip / Postal Code", "Mailing Full Address"];

        const getCustomArray = (navigateType) => {
            switch (navigateType) {
                case 'lead':
                    return existingFieldsArrayInLeads;
                case 'accounts':
                    return existingFieldsArrayInAccounts;
                case 'contact':
                    return existingFieldsArrayInContact;
                default:
                    return [];
            }
        };

        const customDuplicateEntries = fields.filter(field => {
            const customArray = getCustomArray(field.navigate_type);
            return customArray.includes(field.field_lable);
        });

        if (customDuplicateEntries.length > 0) {
            return await responseError(req, res, `${customDuplicateEntries.length} fields are duplicates default fields.`);
        }

        // Check for duplicates in the database
        let duplicateEntries = await req.config.Field.findAll({
            where: {
                [Op.and]: fields.map(field => ({
                    field_lable: field.field_lable.trim(),
                    navigate_type: field.navigate_type
                }))
            },
            attributes: ['field_lable', 'navigate_type']
        });

        if (duplicateEntries.length > 0) {
            return await responseError(req, res, `${duplicateEntries.length} fields are duplicate.`)
        }

        let FieldData = await req.config.Field.bulkCreate(FiledBody, {
            updateOnDuplicate: ["field_id", "field_lable", "navigate_type", "field_name", "field_order", "option", "input_value", "input_type", "field_type", "field_size"]
        });

        await responseSuccess(req, res, "lead extra data submitted successfully", FieldData);
    } catch (error) {
        logErrorToFile(error);
        console.log(error);
        await responseError(req, res, "Something Went Wrong");
    }
};

exports.getField = async (req, res) => {
    try {
        let FieldData
        const id = req.query.id
        if (id) {
            FieldData = await req.config.Field.findByPk(id)
        } else {
            FieldData = await req.config.Field.findAll({
                where: {
                    navigate_type: req.query.nav_type
                },
                order: [['field_order', 'ASC']]
            })
        }

        await responseSuccess(req, res, "Field Data", FieldData)
    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        await responseError(req, res, "Something Went Wrong")
    }
}

exports.deleteField = async (req, res) => {
    try {
        const FieldData = await req.config.Field.findByPk(req.query.id)
        if (!FieldData) responseError(req, res, "field not found")
        await FieldData.destroy()
        await responseSuccess(req, res, "Field Data deleted")
    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        await responseError(req, res, "Something Went Wrong")
    }
}