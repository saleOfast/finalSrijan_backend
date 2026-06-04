const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const { responseError, responseSuccess } = require('../../helper/responce')
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const moment = require('moment');
const { logErrorToFile } = require('../../helper/errorLogger');

// Helper function to format date
const dateChange = (date) => {
    if (!date) return '';
    const dueDate = new Date(date);
    const formattedDueDate = dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return formattedDueDate;
}

// Helper function to format datetime
const dateTimeChange = (date) => {
    if (!date) return '';
    const dueDate = new Date(date);
    const formattedDueDate = dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hours = String(dueDate.getHours()).padStart(2, '0');
    const minutes = String(dueDate.getMinutes()).padStart(2, '0');
    return `${formattedDueDate} ${hours}:${minutes}`;
}

// 1. Leads Generated Report
exports.getLeadsGeneratedReport = async (req, res) => {
    try {
        const startDate = req.query.startDate;
        let endDate = req.query.endDate;
        let whereLeadClause = {};

        if (req.query.type === 'all') {
            endDate = moment(new Date(endDate)).add(1, "d").toDate().toISOString().split('T')[0];
        }

        // Filter based on user role
        if (!req.user.isDB && req.user.role_id != 3) {
            whereLeadClause = {
                assigned_lead: req.user.user_id
            };
        }

        const leads = await req.config.leads.findAll({
            where: {
                ...whereLeadClause,
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
            },
            include: [
                {
                    model: req.config.users,
                    attributes: ['user_id', 'user'],
                    paranoid: false,
                },
                {
                    model: req.config.channelProject,
                    as: 'projectData',
                    attributes: ['project_id', 'project'],
                    paranoid: false,
                },
            ],
            order: [['createdAt', 'DESC']],
        });

        return await responseSuccess(req, res, "Leads Generated Report", leads);

    } catch (error) {
        logErrorToFile(error);
        console.log(error);
        return await responseError(req, res, "Something Went Wrong");
    }
};

// 1.1. Download Leads Generated Excel
exports.downloadLeadsGeneratedExcel = async (req, res) => {
    try {
        const startDate = req.query.startDate;
        let endDate = req.query.endDate;
        let whereLeadClause = {};

        if (req.query.type === 'all') {
            endDate = moment(new Date(endDate)).add(1, "d").toDate().toISOString().split('T')[0];
        }

        // Filter based on user role
        if (!req.user.isDB && req.user.role_id != 3) {
            whereLeadClause = {
                assigned_lead: req.user.user_id
            };
        }

        const leads = await req.config.leads.findAll({
            where: {
                ...whereLeadClause,
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
            },
            include: [
                {
                    model: req.config.users,
                    attributes: ['user_id', 'user'],
                    paranoid: false,
                },
                {
                    model: req.config.channelProject,
                    as: 'projectData',
                    attributes: ['project_id', 'project'],
                    paranoid: false,
                },
            ],
            order: [['createdAt', 'DESC']],
        });

        let excelClientData = [];
        leads?.forEach(element => {
            let item = {
                "Lead ID": element?.dataValues?.lead_id || '',
                "Lead Name": element?.dataValues?.lead_name || '',
                "Email": element?.dataValues?.email_id || '',
                "Contact No": element?.dataValues?.p_contact_no || '',
                "Address": element?.dataValues?.address || '',
                "Pincode": element?.dataValues?.pincode || '',
                "Project Name": element?.dataValues?.projectData?.dataValues?.project || '',
                "Assigned To": element?.dataValues?.db_user?.dataValues?.user || '',
                "Zone": element?.dataValues?.zone || '',
                "Zone Area": element?.dataValues?.zone_area || '',
                "Created Date": dateChange(element?.dataValues?.createdAt),
            };
            excelClientData.push(item);
        });

        const workbook = xlsx.utils.book_new();
        const worksheet = xlsx.utils.json_to_sheet(excelClientData);
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Leads Generated');

        const tempFilePath = path.join(__dirname, `../../uploads/temp`, 'temp.xlsx');
        xlsx.writeFile(workbook, tempFilePath);

        res.setHeader('Content-Type', 'application/vnd.ms-excel');
        res.setHeader('Content-Disposition', 'attachment; filename=leads_generated_report.xlsx');

        const stream = fs.createReadStream(tempFilePath);
        stream.pipe(res);

        stream.on('end', () => {
            fs.unlinkSync(tempFilePath);
        });

        return;

    } catch (error) {
        logErrorToFile(error);
        console.log(error);
        return await responseError(req, res, "Something Went Wrong");
    }
};

// 2. Visits Created Report
exports.getVisitsCreatedReport = async (req, res) => {
    try {
        const startDate = req.query.startDate;
        let endDate = req.query.endDate;
        let whereLeadClause = {};

        if (req.query.type === 'all') {
            endDate = moment(new Date(endDate)).add(1, "d").toDate().toISOString().split('T')[0];
        }

        // Filter based on user role
        if (!req.user.isDB && req.user.role_id != 3) {
            whereLeadClause = {
                assigned_lead: req.user.user_id
            };
        }

        // First, get lead IDs that match the filter
        let leadIds = [];
        if (Object.keys(whereLeadClause).length > 0) {
            const filteredLeads = await req.config.leads.findAll({
                where: whereLeadClause,
                attributes: ['lead_id'],
                raw: true,
            });
            leadIds = filteredLeads.map(lead => lead.lead_id);
            if (leadIds.length === 0) {
                return await responseSuccess(req, res, "Visits Created Report", []);
            }
        }

        const visits = await req.config.leadVisit.findAll({
            where: {
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
                ...(leadIds.length > 0 && { lead_id: { [Op.in]: leadIds } }),
            },
            include: [
                {
                    model: req.config.leads,
                    as: 'leadData',
                    attributes: {
                        exclude: ["createdAt", "updatedAt", "deletedAt"],
                    },
                    required: true,
                    include: [
                        {
                            model: req.config.users,
                            attributes: ['user_id', 'user'],
                            paranoid: false,
                            required: false,
                        },
                        {
                            model: req.config.channelProject,
                            as: 'projectData',
                            attributes: ['project_id', 'project'],
                            paranoid: false,
                            required: false,
                        },
                    ],
                },
            ],
            order: [['createdAt', 'DESC']],
        });

        return await responseSuccess(req, res, "Visits Created Report", visits);

    } catch (error) {
        logErrorToFile(error);
        console.log(error);
        return await responseError(req, res, "Something Went Wrong");
    }
};

// 2.1. Download Visits Created Excel
exports.downloadVisitsCreatedExcel = async (req, res) => {
    try {
        const startDate = req.query.startDate;
        let endDate = req.query.endDate;
        let whereLeadClause = {};

        if (req.query.type === 'all') {
            endDate = moment(new Date(endDate)).add(1, "d").toDate().toISOString().split('T')[0];
        }

        // Filter based on user role
        if (!req.user.isDB && req.user.role_id != 3) {
            whereLeadClause = {
                assigned_lead: req.user.user_id
            };
        }

        // First, get lead IDs that match the filter
        let leadIds = [];
        if (Object.keys(whereLeadClause).length > 0) {
            const filteredLeads = await req.config.leads.findAll({
                where: whereLeadClause,
                attributes: ['lead_id'],
                raw: true,
            });
            leadIds = filteredLeads.map(lead => lead.lead_id);
            if (leadIds.length === 0) {
                // No leads match, return empty Excel
                const workbook = xlsx.utils.book_new();
                const worksheet = xlsx.utils.json_to_sheet([]);
                xlsx.utils.book_append_sheet(workbook, worksheet, 'Visits Created');
                const tempFilePath = path.join(__dirname, `../../uploads/temp`, 'temp.xlsx');
                xlsx.writeFile(workbook, tempFilePath);
                res.setHeader('Content-Type', 'application/vnd.ms-excel');
                res.setHeader('Content-Disposition', 'attachment; filename=visits_created_report.xlsx');
                const stream = fs.createReadStream(tempFilePath);
                stream.pipe(res);
                stream.on('end', () => {
                    fs.unlinkSync(tempFilePath);
                });
                return;
            }
        }

        const visits = await req.config.leadVisit.findAll({
            where: {
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
                ...(leadIds.length > 0 && { lead_id: { [Op.in]: leadIds } }),
            },
            include: [
                {
                    model: req.config.leads,
                    as: 'leadData',
                    attributes: {
                        exclude: ["createdAt", "updatedAt", "deletedAt"],
                    },
                    required: true,
                    include: [
                        {
                            model: req.config.users,
                            attributes: ['user_id', 'user'],
                            paranoid: false,
                            required: false,
                        },
                        {
                            model: req.config.channelProject,
                            as: 'projectData',
                            attributes: ['project_id', 'project'],
                            paranoid: false,
                            required: false,
                        },
                    ],
                },
            ],
            order: [['createdAt', 'DESC']],
        });

        let excelClientData = [];
        visits?.forEach(element => {
            let item = {
                "Visit ID": element?.dataValues?.visit_id || '',
                "Visit Code": element?.dataValues?.visit_code || '',
                "Status": element?.dataValues?.status || '',
                "Lead Name": element?.dataValues?.leadData?.dataValues?.lead_name || '',
                "Lead Email": element?.dataValues?.leadData?.dataValues?.email_id || '',
                "Lead Contact": element?.dataValues?.leadData?.dataValues?.p_contact_no || '',
                "Project Name": element?.dataValues?.leadData?.dataValues?.projectData?.dataValues?.project || '',
                "Assigned To": element?.dataValues?.leadData?.dataValues?.db_user?.dataValues?.user || '',
                "Planned Visit Date": dateChange(element?.dataValues?.p_visit_date),
                "Planned Visit Time": element?.dataValues?.p_visit_time || '',
                "Revisit Date": dateChange(element?.dataValues?.revisit_date),
                "Revisit Time": element?.dataValues?.revisit_time || '',
                "Created Date": dateChange(element?.dataValues?.createdAt),
            };
            excelClientData.push(item);
        });

        const workbook = xlsx.utils.book_new();
        const worksheet = xlsx.utils.json_to_sheet(excelClientData);
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Visits Created');

        const tempFilePath = path.join(__dirname, `../../uploads/temp`, 'temp.xlsx');
        xlsx.writeFile(workbook, tempFilePath);

        res.setHeader('Content-Type', 'application/vnd.ms-excel');
        res.setHeader('Content-Disposition', 'attachment; filename=visits_created_report.xlsx');

        const stream = fs.createReadStream(tempFilePath);
        stream.pipe(res);

        stream.on('end', () => {
            fs.unlinkSync(tempFilePath);
        });

        return;

    } catch (error) {
        logErrorToFile(error);
        console.log(error);
        return await responseError(req, res, "Something Went Wrong");
    }
};

// 3. Visits Completed Report
exports.getVisitsCompletedReport = async (req, res) => {
    try {
        const startDate = req.query.startDate;
        let endDate = req.query.endDate;
        let whereLeadClause = {};

        if (req.query.type === 'all') {
            endDate = moment(new Date(endDate)).add(1, "d").toDate().toISOString().split('T')[0];
        }

        // Filter based on user role
        if (!req.user.isDB && req.user.role_id != 3) {
            whereLeadClause = {
                assigned_lead: req.user.user_id
            };
        }

        // First, get lead IDs that match the filter
        let leadIds = [];
        if (Object.keys(whereLeadClause).length > 0) {
            const filteredLeads = await req.config.leads.findAll({
                where: whereLeadClause,
                attributes: ['lead_id'],
                raw: true,
            });
            leadIds = filteredLeads.map(lead => lead.lead_id);
            if (leadIds.length === 0) {
                return await responseSuccess(req, res, "Visits Completed Report", []);
            }
        }

        const visits = await req.config.leadVisit.findAll({
            where: {
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
                status: 'Completed',
                ...(leadIds.length > 0 && { lead_id: { [Op.in]: leadIds } }),
            },
            include: [
                {
                    model: req.config.leads,
                    as: 'leadData',
                    attributes: {
                        exclude: ["createdAt", "updatedAt", "deletedAt"],
                    },
                    required: true,
                    include: [
                        {
                            model: req.config.users,
                            attributes: ['user_id', 'user'],
                            paranoid: false,
                            required: false,
                        },
                        {
                            model: req.config.channelProject,
                            as: 'projectData',
                            attributes: ['project_id', 'project'],
                            paranoid: false,
                            required: false,
                        },
                    ],
                },
            ],
            order: [['createdAt', 'DESC']],
        });

        return await responseSuccess(req, res, "Visits Completed Report", visits);

    } catch (error) {
        logErrorToFile(error);
        console.log(error);
        return await responseError(req, res, "Something Went Wrong");
    }
};

// 3.1. Download Visits Completed Excel
exports.downloadVisitsCompletedExcel = async (req, res) => {
    try {
        const startDate = req.query.startDate;
        let endDate = req.query.endDate;
        let whereLeadClause = {};

        if (req.query.type === 'all') {
            endDate = moment(new Date(endDate)).add(1, "d").toDate().toISOString().split('T')[0];
        }

        // Filter based on user role
        if (!req.user.isDB && req.user.role_id != 3) {
            whereLeadClause = {
                assigned_lead: req.user.user_id
            };
        }

        // First, get lead IDs that match the filter
        let leadIds = [];
        if (Object.keys(whereLeadClause).length > 0) {
            const filteredLeads = await req.config.leads.findAll({
                where: whereLeadClause,
                attributes: ['lead_id'],
                raw: true,
            });
            leadIds = filteredLeads.map(lead => lead.lead_id);
            if (leadIds.length === 0) {
                // No leads match, return empty Excel
                const workbook = xlsx.utils.book_new();
                const worksheet = xlsx.utils.json_to_sheet([]);
                xlsx.utils.book_append_sheet(workbook, worksheet, 'Visits Completed');
                const tempFilePath = path.join(__dirname, `../../uploads/temp`, 'temp.xlsx');
                xlsx.writeFile(workbook, tempFilePath);
                res.setHeader('Content-Type', 'application/vnd.ms-excel');
                res.setHeader('Content-Disposition', 'attachment; filename=visits_completed_report.xlsx');
                const stream = fs.createReadStream(tempFilePath);
                stream.pipe(res);
                stream.on('end', () => {
                    fs.unlinkSync(tempFilePath);
                });
                return;
            }
        }

        const visits = await req.config.leadVisit.findAll({
            where: {
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
                status: 'Completed',
                ...(leadIds.length > 0 && { lead_id: { [Op.in]: leadIds } }),
            },
            include: [
                {
                    model: req.config.leads,
                    as: 'leadData',
                    attributes: {
                        exclude: ["createdAt", "updatedAt", "deletedAt"],
                    },
                    required: true,
                    include: [
                        {
                            model: req.config.users,
                            attributes: ['user_id', 'user'],
                            paranoid: false,
                            required: false,
                        },
                        {
                            model: req.config.channelProject,
                            as: 'projectData',
                            attributes: ['project_id', 'project'],
                            paranoid: false,
                            required: false,
                        },
                    ],
                },
            ],
            order: [['createdAt', 'DESC']],
        });

        let excelClientData = [];
        visits?.forEach(element => {
            let item = {
                "Visit ID": element?.dataValues?.visit_id || '',
                "Visit Code": element?.dataValues?.visit_code || '',
                "Status": element?.dataValues?.status || '',
                "Lead Name": element?.dataValues?.leadData?.dataValues?.lead_name || '',
                "Lead Email": element?.dataValues?.leadData?.dataValues?.email_id || '',
                "Lead Contact": element?.dataValues?.leadData?.dataValues?.p_contact_no || '',
                "Project Name": element?.dataValues?.leadData?.dataValues?.projectData?.dataValues?.project || '',
                "Assigned To": element?.dataValues?.leadData?.dataValues?.db_user?.dataValues?.user || '',
                "Planned Visit Date": dateChange(element?.dataValues?.p_visit_date),
                "Planned Visit Time": element?.dataValues?.p_visit_time || '',
                "Revisit Date": dateChange(element?.dataValues?.revisit_date),
                "Revisit Time": element?.dataValues?.revisit_time || '',
                "Created Date": dateChange(element?.dataValues?.createdAt),
            };
            excelClientData.push(item);
        });

        const workbook = xlsx.utils.book_new();
        const worksheet = xlsx.utils.json_to_sheet(excelClientData);
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Visits Completed');

        const tempFilePath = path.join(__dirname, `../../uploads/temp`, 'temp.xlsx');
        xlsx.writeFile(workbook, tempFilePath);

        res.setHeader('Content-Type', 'application/vnd.ms-excel');
        res.setHeader('Content-Disposition', 'attachment; filename=visits_completed_report.xlsx');

        const stream = fs.createReadStream(tempFilePath);
        stream.pipe(res);

        stream.on('end', () => {
            fs.unlinkSync(tempFilePath);
        });

        return;

    } catch (error) {
        logErrorToFile(error);
        console.log(error);
        return await responseError(req, res, "Something Went Wrong");
    }
};

// 4. Bookings Completed Report
exports.getBookingsCompletedReport = async (req, res) => {
    try {
        const startDate = req.query.startDate;
        let endDate = req.query.endDate;
        let whereLeadClause = {};

        if (req.query.type === 'all') {
            endDate = moment(new Date(endDate)).add(1, "d").toDate().toISOString().split('T')[0];
        }

        // Filter based on user role
        if (!req.user.isDB && req.user.role_id != 3) {
            whereLeadClause = {
                assigned_lead: req.user.user_id
            };
        }

        const bookings = await req.config.leadBooking.findAll({
            where: {
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
            },
            include: [
                {
                    model: req.config.leads,
                    as: 'BookingleadData',
                    where: {
                        ...whereLeadClause
                    },
                    attributes: {
                        exclude: ["createdAt", "updatedAt", "deletedAt"],
                    },
                    required: true,
                    include: [
                        {
                            model: req.config.users,
                            attributes: ['user_id', 'user'],
                            paranoid: false,
                        },
                        {
                            model: req.config.channelProject,
                            as: 'projectData',
                            attributes: ['project_id', 'project'],
                            paranoid: false,
                        },
                    ],
                },
                {
                    model: req.config.channelProject,
                    as: 'BookingprojectData',
                    attributes: ['project_id', 'project'],
                    paranoid: false,
                },
            ],
            order: [['createdAt', 'DESC']],
        });

        return await responseSuccess(req, res, "Bookings Completed Report", bookings);

    } catch (error) {
        logErrorToFile(error);
        console.log(error);
        return await responseError(req, res, "Something Went Wrong");
    }
};

// 4.1. Download Bookings Completed Excel
exports.downloadBookingsCompletedExcel = async (req, res) => {
    try {
        const startDate = req.query.startDate;
        let endDate = req.query.endDate;
        let whereLeadClause = {};

        if (req.query.type === 'all') {
            endDate = moment(new Date(endDate)).add(1, "d").toDate().toISOString().split('T')[0];
        }

        // Filter based on user role
        if (!req.user.isDB && req.user.role_id != 3) {
            whereLeadClause = {
                assigned_lead: req.user.user_id
            };
        }

        const bookings = await req.config.leadBooking.findAll({
            where: {
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
            },
            include: [
                {
                    model: req.config.leads,
                    as: 'BookingleadData',
                    where: {
                        ...whereLeadClause
                    },
                    attributes: {
                        exclude: ["createdAt", "updatedAt", "deletedAt"],
                    },
                    required: true,
                    include: [
                        {
                            model: req.config.users,
                            attributes: ['user_id', 'user'],
                            paranoid: false,
                        },
                        {
                            model: req.config.channelProject,
                            as: 'projectData',
                            attributes: ['project_id', 'project'],
                            paranoid: false,
                        },
                    ],
                },
                {
                    model: req.config.channelProject,
                    as: 'BookingprojectData',
                    attributes: ['project_id', 'project'],
                    paranoid: false,
                },
            ],
            order: [['createdAt', 'DESC']],
        });

        let excelClientData = [];
        bookings?.forEach(element => {
            let item = {
                "Booking ID": element?.dataValues?.booking_id || '',
                "Booking Code": element?.dataValues?.booking_code || '',
                "Booking Name": element?.dataValues?.booking_name || '',
                "Email": element?.dataValues?.email || '',
                "Contact No": element?.dataValues?.contact_no || '',
                "Location": element?.dataValues?.Location || '',
                "Pincode": element?.dataValues?.pincode || '',
                "Lead Name": element?.dataValues?.BookingleadData?.dataValues?.lead_name || '',
                "Lead Email": element?.dataValues?.BookingleadData?.dataValues?.email_id || '',
                "Lead Contact": element?.dataValues?.BookingleadData?.dataValues?.p_contact_no || '',
                "Project Name": element?.dataValues?.BookingprojectData?.dataValues?.project || '',
                "Assigned To": element?.dataValues?.BookingleadData?.dataValues?.db_user?.dataValues?.user || '',
                "Visit Done Date": dateChange(element?.dataValues?.visit_done_date),
                "Visit Done Time": element?.dataValues?.visit_done_time || '',
                "Revisit Done Date": dateChange(element?.dataValues?.revisit_done_date),
                "Revisit Done Time": element?.dataValues?.revisit_done_time || '',
                "Created Date": dateChange(element?.dataValues?.createdAt),
            };
            excelClientData.push(item);
        });

        const workbook = xlsx.utils.book_new();
        const worksheet = xlsx.utils.json_to_sheet(excelClientData);
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Bookings Completed');

        const tempFilePath = path.join(__dirname, `../../uploads/temp`, 'temp.xlsx');
        xlsx.writeFile(workbook, tempFilePath);

        res.setHeader('Content-Type', 'application/vnd.ms-excel');
        res.setHeader('Content-Disposition', 'attachment; filename=bookings_completed_report.xlsx');

        const stream = fs.createReadStream(tempFilePath);
        stream.pipe(res);

        stream.on('end', () => {
            fs.unlinkSync(tempFilePath);
        });

        return;

    } catch (error) {
        logErrorToFile(error);
        console.log(error);
        return await responseError(req, res, "Something Went Wrong");
    }
};

