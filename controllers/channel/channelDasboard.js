const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const { responseError, responseSuccess } = require('../../helper/responce')
const moment = require("moment");


exports.getDashboardData = async (req, res) => {
    try {
        const startDate = req.query.startDate;
        let endDate = req.query.endDate
        let leads;
        let visitsGenerated;
        let visitsCompleted;
        let booking;
        let topFiveLeads;
        let topFiveBooking;
        whereClause = {};
        whereTaskClause = {};
        whereLeadClause = {};

        // Calculate the difference in days
        const differenceInDays = Math.floor((new Date(req.query.endDate) - new Date(req.query.startDate)) / (1000 * 60 * 60 * 24));
        let interval = 'weekly';

        // Set the interval based on the difference in days
        if (differenceInDays > 365) {
            interval = 'yearly';
        } else if (differenceInDays > 7) {
            interval = 'monthly';
        } else {
            interval = 'weekly';
        }
        console.log(differenceInDays)


        if (req.query.type === 'all') {
            endDate = moment(new Date(endDate)).add(1, "d").toDate().toISOString().split('T')[0];
        }
        if (!req.user.isDB && req.user.role_id != 3) {

            whereLeadClause = {
                assigned_lead: req.user.user_id
            }
        }


        leads = await req.config.leads.count({
            where: {
                ...whereLeadClause,
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
            },
        })

        // Count all visits generated (regardless of status)
        visitsGenerated = await req.config.leadVisit.count({
            where: {
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
            },
            include: [
                {
                    model: req.config.leads,
                    as: 'leadData',
                    where: {
                        ...whereLeadClause
                    },
                    attributes: ["lead_id"],
                    required: true,
                },
            ],
        })

        // Count visits completed
        visitsCompleted = await req.config.leadVisit.count({
            where: {
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
                status: 'Completed'
            },
            include: [
                {
                    model: req.config.leads,
                    as: 'leadData',
                    where: {
                        ...whereLeadClause
                    },
                    attributes: ["lead_id"],
                    required: true,
                },
            ],
        })

        booking = await req.config.leadBooking.count({
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
                },
            ],
        })


        topFiveLeads = await req.config.leads.findAll({
            where: { ...whereLeadClause },
            order: [
                ['lead_id', 'DESC'],],
            limit: 5
        })

        topFiveBooking = await req.config.leadBooking.findAll({
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
                },
            ],
            order: [
                ['booking_id', 'DESC'],],
            limit: 5
        })

        let query = rangewise(interval, startDate, endDate, req)

        let barchart = await req.config.sequelize.query(query, {
            type: QueryTypes.SELECT,
        })


        const data =
            await req.config.leads.findAll({
                where: {
                    ...whereLeadClause
                },
                include: [{
                    model: req.config.leadBooking,
                    as: 'BookingLeadList',
                    required: true // This ensures that only leads with bookings are returned
                }],
                attributes: [
                    'lead_id', 'createdAt',
                    [Sequelize.literal('TIMESTAMPDIFF(HOUR, `db_lead`.`createdAt`, `BookingLeadList`.`createdAt`)'), 'time_difference_hours']
                ]
            })

        const timeDifferences = data.map(row => row.dataValues.time_difference_hours);
        // Calculate the total of time_difference_hours
        const totalHours = timeDifferences.reduce((sum, hours) => sum + hours, 0);

        // Calculate the average
        const averageHours = (totalHours / timeDifferences.length).toFixed(2);


        let ONBOARDEDCPs = await req.config.channelPartnerLeads.count({
            where: {
                stage: 'ONBOARDED', asssigned_to: req.user.user_id,
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
            }
        })
        let OPENCPs = await req.config.channelPartnerLeads.count({
            where: {
                stage: 'OPEN', asssigned_to: req.user.user_id,
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
            }
        })
        let CONTACTEDCPs = await req.config.channelPartnerLeads.count({
            where: {
                stage: 'CONTACTED', asssigned_to: req.user.user_id,
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
            }
        })
        let NOTINTERESTEDCPs = await req.config.channelPartnerLeads.count({
            where: {
                stage: 'NOT INTERESTED', asssigned_to: req.user.user_id,
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
            }
        })
        let CALLCPs = await req.config.channelPartnerLeads.count({
            where: {
                stage: 'CALL', asssigned_to: req.user.user_id,
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
            }
        })
        let VISITCPs = await req.config.channelPartnerLeads.count({
            where: {
                stage: 'VISIT', asssigned_to: req.user.user_id,
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
            }
        })
        let FOLLOWUPCPs = await req.config.channelPartnerLeads.count({
            where: {
                stage: 'FOLLOW UP',
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
            }
        })
        // let piechart = await req.config.sequelize.query(`SELECT dbl.status_name as 'name', COUNT(ld.lead_status_id) AS 'value' FROM db_lead_statuses AS dbl LEFT JOIN db_leads AS ld ON dbl.lead_status_id = ld.lead_status_id WHERE ld.deletedAt IS NULL AND ld.createdAt BETWEEN '${startDate}' AND '${endDate}' GROUP BY dbl.lead_status_id, dbl.status_name;`, {
        //     type: QueryTypes.SELECT,
        // })
        let dashboard = {
            leads,
            visitsGenerated,
            visitsCompleted,
            booking,
            averageHours,
            topFiveLeads,
            topFiveBooking,
            barchart,
            ONBOARDEDCPs,
            OPENCPs,
            CONTACTEDCPs,
            NOTINTERESTEDCPs,
            CALLCPs,
            VISITCPs,
            FOLLOWUPCPs
        }
        return await responseSuccess(req, res, "dashborad Count", dashboard)


    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

const rangewise = (type, startDate, endDate, req) => {

    switch (type) {
        case "weekly":

            return `SELECT
            DATE(date) as 'date',
            COUNT(leadId) AS 'lead',
            COUNT(bookingId) AS 'booking'
        FROM (
            SELECT
                ld.createdAt AS date,
                ld.lead_id AS leadId,
                NULL AS bookingId
            FROM
                db_leads AS ld
            WHERE ${!req.user.isDB && req.user.role_id != 3 ? 'ld.assigned_lead = ' + req.user.user_id + ' and ' : ''}
                ld.createdAt BETWEEN '${startDate}' AND '${endDate}'  and ld.deletedAt IS null 
            
            UNION ALL
            
            SELECT
                bd.createdAt AS date,
                NULL AS leadId,
                bd.booking_id AS bookingId
            FROM
                db_lead_bookings AS bd
                INNER JOIN db_leads on bd.lead_id = db_leads.lead_id ${!req.user.isDB && req.user.role_id != 3 ? 'and db_leads.assigned_lead = ' + req.user.user_id + '' : ''}
            WHERE 
                bd.createdAt BETWEEN  '${startDate}' AND '${endDate}'   and bd.deletedAt IS null
        ) AS combinedData
        GROUP BY
            DATE(date)
        ORDER BY
            DATE(date);`

        case "monthly":


            return `SELECT
            CONCAT('week ', WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1) AS 'date',
            COUNT(leadId) AS 'lead',
            COUNT(bookingId) AS 'booking'
        FROM (
            SELECT
                ld.createdAt AS date,
                ld.lead_id AS leadId,
                NULL AS bookingId
            FROM
                db_leads AS ld
            WHERE ${!req.user.isDB && req.user.role_id != 3 ? 'ld.assigned_lead = ' + req.user.user_id + ' AND ' : ''}
                ld.createdAt BETWEEN '${startDate}' AND '${endDate}' AND ld.deletedAt IS NULL 
                
            UNION ALL
            
            SELECT
                bd.createdAt AS date,
                NULL AS leadId,
                bd.booking_id AS bookingId
            FROM
                db_lead_bookings AS bd
                INNER JOIN db_leads ON bd.lead_id = db_leads.lead_id ${!req.user.isDB && req.user.role_id != 3 ? 'AND db_leads.assigned_lead = ' + req.user.user_id : ''}
            WHERE 
                bd.createdAt BETWEEN '${startDate}' AND '${endDate}' AND bd.deletedAt IS NULL
        ) AS combinedData
        GROUP BY
            WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1
        ORDER BY
            MIN(date);`

        case "yearly":
            return `SELECT
            CONCAT(YEAR(date), '-', LEFT(MONTHNAME(date), 3)) AS 'date',
            COUNT(leadId) AS 'lead',
            COUNT(bookingId) AS 'booking'
            FROM (
                SELECT
                    ld.createdAt AS date,
                    ld.lead_id AS leadId,
                    NULL AS bookingId
                FROM
                    db_leads AS ld
                WHERE ${!req.user.isDB && req.user.role_id != 3 ? 'ld.assigned_lead = ' + req.user.user_id + ' and ' : ''}
                    ld.createdAt BETWEEN '${startDate}' AND '${endDate}'  and ld.deletedAt IS null 
                
                UNION ALL
                
                SELECT
                    bd.createdAt AS date,
                    NULL AS leadId,
                    bd.booking_id AS bookingId
                FROM
                    db_lead_bookings AS bd
                INNER JOIN db_leads on bd.lead_id = db_leads.lead_id ${!req.user.isDB && req.user.role_id != 3 ? 'and db_leads.assigned_lead = ' + req.user.user_id + '' : ''}
                WHERE 
                    bd.createdAt BETWEEN  '${startDate}' AND '${endDate}'   and bd.deletedAt IS null
            ) AS combinedData
            GROUP BY
            YEAR(date), MONTH(date)
        ORDER BY
            MIN(date);`

        default:
            return `SELECT
            CONCAT(YEAR(date), '-', LEFT(MONTHNAME(date), 3)) AS 'date',
            COUNT(leadId) AS 'lead',
            COUNT(bookingId) AS 'booking'
            FROM (
                SELECT
                    ld.createdAt AS date,
                    ld.lead_id AS leadId,
                    NULL AS bookingId
                FROM
                    db_leads AS ld
                WHERE ${!req.user.isDB && req.user.role_id != 3 ? 'ld.assigned_lead = ' + req.user.user_id + ' and ' : ''}
                    ld.createdAt BETWEEN '${startDate}' AND '${endDate}'  and ld.deletedAt IS null 
                
                UNION ALL
                
                SELECT
                    bd.createdAt AS date,
                    NULL AS leadId,
                    bd.booking_id AS bookingId
                FROM
                    db_lead_bookings AS bd
                INNER JOIN db_leads on bd.lead_id = db_leads.lead_id ${!req.user.isDB && req.user.role_id != 3 ? 'and db_leads.assigned_lead = ' + req.user.user_id + '' : ''}
                WHERE 
                    bd.createdAt BETWEEN  '${startDate}' AND '${endDate}'   and bd.deletedAt IS null
            ) AS combinedData
            GROUP BY
            YEAR(date), MONTH(date)
        ORDER BY
            MIN(date);`
    }
}