const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const { responseError, responseSuccess } = require('../../helper/responce')
const jwt = require("jsonwebtoken");
const db = require("../../model");
const zeroPad = (num, places) => String(num).padStart(places, '0')
const dotenv = require("dotenv").config();

exports.tokenGenration = async (req, res) => {
    try {
        let { host_name, client_secret } = req.body;
        if (client_secret !== process.env.CLIENT_SECRET) return res.status(400).json({ status: 400, message: "invalid client secret", data: process.env.CLIENT_SECRET });

        let hostData = await db.clients.findOne({
            where: {
                client_url: host_name
            },
        });
        if (!hostData) {
            return res.status(400).json({ status: 400, message: "invalid host_name", data: null });
        }
        const user = await db.sequelize.query(`
            SELECT * FROM ${hostData.db_name}.db_users
            WHERE user_code = '${hostData.user_code}'
            LIMIT 1`, {
            type: db.sequelize.QueryTypes.SELECT
        });

        console.log(`
            SELECT * FROM ${hostData.db_name}.db_users
            WHERE user_code = '${hostData.user_code}'
            LIMIT 1`)

        console.log(user, 'user')

        if (user.length <= 0) {
            return responseSuccess(req, res, "User do not exist");
        }

        if (!hostData) return res.status(400).json({ status: 400, message: "invalid host", data: null });

        let token = jwt.sign({
            id: user[0]?.user_id,
            db_name: hostData.db_name,
            user_code: hostData.user_code,
        }, process.env.CLIENT_SECRET, {
            expiresIn: process.env.expiresIn,
        });

        return res.status(200).json({
            token,
            instance_url: host_name,
            expiresIn: process.env.expiresIn,
            token_type: "Bearer",
        });

    } catch (error) {
        logErrorToFile(error)
        console.log(error);
        return res.status(400).json({ message: "sonething went wrong" });
    }
};

exports.syncleads = async (req, res) => {
    try {

        let { email_id, p_contact_no, sales_lead_id, lead_stg_id } = req.body
        let body = req.body

        if (!email_id) return await responseError(req, res, "email ID is blank")
        if (!p_contact_no) return await responseError(req, res, "contact is blank")
        if (!sales_lead_id) return await responseError(req, res, "sales lead id is blank ")

        let leadData = await req.config.leads.findOne({
            where: {
                sales_lead_id
            }
        })
        if (!leadData) return await responseError(req, res, "no lead existed")

        let leadDuplicateData = await req.config.leads.findOne({
            where: {
                sales_lead_id: { [Op.ne]: sales_lead_id },
                email_id,
                p_contact_no,
            }
        })
        if (leadDuplicateData) return await responseError(req, res, "lead name already existed with this email id")

        if (lead_stg_id) {
            let leadStgData = await req.config.leadStages.findOne({
                stage: lead_stg_id
            })
            body.lead_stg_id = leadStgData.lead_stg_id
        }
        await leadData.update(body)
        return await responseSuccess(req, res, "lead Synced")

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        let errors = {};
        if (error?.original?.sqlMessage) {
            errors = error?.original?.sqlMessage
        } else {
            errors = error
        }
        return await responseError(req, res, "lead Synced failed", errors)
    }
}

exports.syncleadVisit = async (req, res) => {
    try {
        console.log('into synclead')
        let { sales_visit_id, p_visit_date, p_visit_time, remarks, status } = req.body

        if (!sales_visit_id) return await responseError(req, res, "sales visit id is blank")
        if (!p_visit_date) return await responseError(req, res, "visit date is blank 'yyyy-mm-dd'")
        if (!p_visit_time) return await responseError(req, res, "visit time is blank 'hh:mm:ss'")

        let body = req.body

        let visitData = await req.config.leadVisit.findOne({
            where: {
                sales_visit_id: sales_visit_id
            }
        })

        if (p_visit_date) {
            if (!p_visit_time || p_visit_time == "") {
                const createVisitHistory = await req.config.revisitLeadsVisits.create({
                    visit_id: visitData?.dataValues?.visit_id || visitData?.visit_id,
                    lead_id: visitData?.dataValues?.lead_id || visitData?.lead_id,
                    revisit_date: p_visit_date,
                    remarks
                })
            } else {
                const createVisitHistory = await req.config.revisitLeadsVisits.create({
                    visit_id: visitData?.dataValues?.visit_id || visitData?.visit_id,
                    lead_id: visitData?.dataValues?.lead_id || visitData?.lead_id,
                    revisit_date: p_visit_date,
                    revisit_time: p_visit_time,
                    remarks
                })
            }
        }

        if (!visitData) return await responseError(req, res, "no visit found", visitData)

        if (p_visit_date && p_visit_time) {
            let visitDuplicateData = await req.config.leadVisit.findOne({
                where: {
                    sales_visit_id: { [Op.ne]: sales_visit_id },
                    lead_id: visitData.lead_id,
                    p_visit_date,
                    p_visit_time,
                }
            })

            if (visitDuplicateData) {
                return await responseError(req, res, "lead visit request already existed with this date and time")
            }

        }
        await visitData.update(body)
        let leadUpdateData = await req.config.leads.findByPk(visitData.lead_id)

        if (leadUpdateData && status && status === 'Completed') {
            await leadUpdateData.update({
                lead_stg_id: 3
            })
        }

        return await responseSuccess(req, res, "visit Synced", visitData)

    } catch (error) {
        logErrorToFile(error)
        console.log("error", error)
        return await responseError(req, res, "visit Synced failed")
    }
}

exports.SyncBooking = async (req, res) => {
    try {
        let bookingData = {};
        let { sales_lead_id, sales_booking_id } = req.body
        if (!sales_lead_id) return await responseError(req, res, "sales lead id is blank")
        let leadData = await req.config.leads.findOne({
            where: {
                sales_lead_id
            }
        })

        if (!leadData) return await responseError(req, res, "no lead existed")

        let existCount = await req.config.leadBooking.count({
            where: {
                lead_id: leadData.lead_id
            }
        })

        if (existCount == 1 || existCount > 1) {
            req.config.leadBooking.update({ sales_booking_id: sales_booking_id })
            return await responseError(req, res, `booking alread exist with lead ${sales_lead_id}`)
        }
        // Count the total number of leads (including soft-deleted ones)
        let leadcount = await req.config.leadBooking.count({ paranoid: false });
        bookingData.booking_code = `${req.admin.user.charAt(0).toUpperCase()}${req.admin.user_l_name ? req.admin.user_l_name.charAt(0).toUpperCase() : ''}B_${zeroPad(leadcount + 1, 5)}`
        bookingData.lead_id = leadData.lead_id
        bookingData = { ...req.body, ...bookingData }
        let bookingDataCrreated = await req.config.leadBooking.create({ ...bookingData })

        // after create visit  update lead stage
        await leadData.update({ lead_stg_id: 4 })
        return await responseSuccess(req, res, "Booking data Synced", bookingDataCrreated)

    } catch (error) {
        logErrorToFile(error)
        console.log("error", error)
        let errors;
        if (error?.original?.sqlMessage) {
            errors = error?.original?.sqlMessage
        } else {
            errors = error
        }

        return await responseError(req, res, "bookingList Synced failed", errors)
    }
}

exports.SyncBookingUpdate = async (req, res) => {
    try {
        let { sales_booking_id } = req.body
        if (!sales_booking_id) return await responseError(req, res, "sales booking id is blank")
        let booking_data = await req.config.leadBooking.findOne({
            where: {
                sales_booking_id
            }
        })

        if (!booking_data) return await responseError(req, res, "no booking existed")
        // Count the total number of leads (including soft-deleted ones)
        let boddkingDataUpdated = await booking_data.update(req.body)


        return await responseSuccess(req, res, "Booking data Synced", boddkingDataUpdated)

    } catch (error) {
        logErrorToFile(error)
        console.log("error", error)

        let errors;
        if (error?.original?.sqlMessage) {
            errors = error?.original?.sqlMessage
        } else {
            errors = error
        }
        return await responseError(req, res, "booking update Synced failed", errors)
    }
}