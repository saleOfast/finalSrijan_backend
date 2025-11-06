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
        let topFiveVisits;
        whereClause = {};
        whereTaskClause = {};
        whereLeadClause = {};

        // Calculate the difference in days
        const differenceInDays = Math.floor((new Date(req.query.endDate) - new Date(req.query.startDate)) / (1000 * 60 * 60 * 24));
        let interval = 'weekly';

        // Set the interval based on the difference in days
        if (differenceInDays > 31) {
            // data will come on the baiss of months
            interval = 'yearly';
        } else if (differenceInDays > 7 && differenceInDays <= 31) {
            // week wise
            interval = 'monthly';
        } else {
            // daily
            interval = 'weekly';
        }

        if (req.query.type === 'all') {
            endDate = moment(new Date(endDate)).add(1, "d").toDate().toISOString().split('T')[0];
        }
        // if(!req.user.isDB) {

        //     whereLeadClause = {
        //         assigned_lead : req.user.user_id
        //     }
        // }


        leads = await req.config.leads.count({
            where: {
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

        let query = rangewise(interval, startDate, endDate, req)
        let EnrolVsAcceptquery = rangewiseEnrolVsAccept(interval, startDate, endDate, req)
        let rangewiseRequestedVsCompleteQuery = rangewiseRequestedVsComplete(interval, startDate, endDate, req)
        let rangewiseBrokergaeVsBookingQuery = rangewiseBookingvsBrokerage(interval, startDate, endDate, req)
        let rangewiseVisitVsBookingsQuery = rangewiseVisitVsBooking(interval, startDate, endDate, req)
        let topFiveLeadsQuery = topFiveQuery('leads', startDate, endDate, req)
        let topFiveVisitQuery = topFiveQuery('visit', startDate, endDate, req)
        let topFiveBookingQuery = topFiveQuery('booking', startDate, endDate, req)

        topFiveLeads = await req.config.sequelize.query(topFiveLeadsQuery, {
            type: QueryTypes.SELECT,
        })
        topFiveVisits = await req.config.sequelize.query(topFiveVisitQuery, {
            type: QueryTypes.SELECT,
        })
        topFiveBooking = await req.config.sequelize.query(topFiveBookingQuery, {
            type: QueryTypes.SELECT,
        })
        let barchart = await req.config.sequelize.query(query, {
            type: QueryTypes.SELECT,
        })
        let EnrolVsAcceptChart = await req.config.sequelize.query(EnrolVsAcceptquery, {
            type: QueryTypes.SELECT,
        })

        let RequestedVsCompleteChart = await req.config.sequelize.query(rangewiseRequestedVsCompleteQuery, {
            type: QueryTypes.SELECT,
        })

        let rangewiseBrokergaeVsBookingChart = await req.config.sequelize.query(rangewiseBrokergaeVsBookingQuery, {
            type: QueryTypes.SELECT,
        })

        let rangewiseVisitVsBookingsCharts = await req.config.sequelize.query(rangewiseVisitVsBookingsQuery, {
            type: QueryTypes.SELECT,
        })

        const data =
            await req.config.leads.findAll({
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
        const averageHours = (totalHours / timeDifferences.length).toFixed();

        // let piechart = await req.config.sequelize.query(`SELECT dbl.status_name as 'name', COUNT(ld.lead_status_id) AS 'value' FROM db_lead_statuses AS dbl LEFT JOIN db_leads AS ld ON dbl.lead_status_id = ld.lead_status_id WHERE ld.deletedAt IS NULL AND ld.createdAt BETWEEN '${startDate}' AND '${endDate}' GROUP BY dbl.lead_status_id, dbl.status_name;`, {
        //     type: QueryTypes.SELECT,
        // })

        let ONBOARDEDCPs = await req.config.channelPartnerLeads.count({
            where: {
                stage: 'ONBOARDED',
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
            }
        })
        let OPENCPs = await req.config.channelPartnerLeads.count({
            where: {
                stage: 'OPEN',
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
            }
        })
        let CONTACTEDCPs = await req.config.channelPartnerLeads.count({
            where: {
                stage: 'CONTACTED',
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
            }
        })
        let NOTINTERESTEDCPs = await req.config.channelPartnerLeads.count({
            where: {
                stage: 'NOT INTERESTED',
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
            }
        })
        let CALLCPs = await req.config.channelPartnerLeads.count({
            where: {
                stage: 'CALL',
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
        let VISITCPs = await req.config.channelPartnerLeads.count({
            where: {
                stage: 'VISIT',
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
            }
        })

        let dashboard = {
            leads,
            visitsGenerated,
            visitsCompleted,
            booking,
            averageHours,
            topFiveLeads,
            topFiveBooking,
            topFiveVisits,
            barchart,
            EnrolVsAcceptChart,
            RequestedVsCompleteChart,
            rangewiseBrokergaeVsBookingChart,
            rangewiseVisitVsBookingsCharts,
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

        // changed this
        case "monthly":

            return `SELECT
            CONCAT('week ', WEEK(MIN(date), 1) - WEEK(DATE_SUB(MIN(date), INTERVAL DAYOFMONTH(MIN(date)) - 1 DAY), 1) + 1, 'th week') AS 'date',
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
            MIN(date);
        `

        // changed this
        case "yearly":
            return `SELECT
            CONCAT(YEAR(MIN(date)), '-', LEFT(MONTHNAME(MIN(date)), 3)) AS 'date',
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
        CONCAT(YEAR(MIN(date)), '-', LEFT(MONTHNAME(MIN(date)), 3)) AS 'date',
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
        MIN(date)`
    }
}

const rangewiseBookingvsBrokerage = (type, startDate, endDate, req) => {

    switch (type) {
        case "weekly":

            return `SELECT
            DATE(date) as 'date',
            COUNT(brokerageId) AS 'brokerage',
            COUNT(bookingId) AS 'booking'
        FROM (
            SELECT
                ld.createdAt AS date,
                ld.brokerage_id AS brokerageId,
                NULL AS bookingId
            FROM
                db_lead_brokerages AS ld
            WHERE
                ld.createdAt BETWEEN '${startDate}' AND '${endDate}'  and ld.deletedAt IS null 
            
            UNION ALL
            
            SELECT
                bd.createdAt AS date,
                NULL AS brokerageId,
                bd.booking_id AS bookingId
            FROM
                db_lead_bookings AS bd
            WHERE 
                bd.createdAt BETWEEN  '${startDate}' AND '${endDate}'   and bd.deletedAt IS null
        ) AS combinedData
        GROUP BY
            DATE(date)
        ORDER BY
            DATE(date);`

        // chnaged this too
        case "monthly":
            return `SELECT
            CONCAT(
                WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1,
                CASE
                    WHEN WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1 IN (11, 12, 13) THEN 'th' -- Special case for teens
                    WHEN (WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1) % 10 = 1 THEN 'st'
                    WHEN (WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1) % 10 = 2 THEN 'nd'
                    WHEN (WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1) % 10 = 3 THEN 'rd'
                    ELSE 'th'
                END,
                ' week'
            ) AS 'date',
            COUNT(brokerageId) AS 'brokerage',
            COUNT(bookingId) AS 'booking'
        FROM (
            SELECT
                ld.createdAt AS date,
                ld.brokerage_id AS brokerageId,
                NULL AS bookingId
            FROM
                db_lead_brokerages AS ld
            WHERE
                ld.createdAt BETWEEN '${startDate}' AND '${endDate}' AND ld.deletedAt IS NULL 
                
            UNION ALL
            
            SELECT
                bd.createdAt AS date,
                NULL AS brokerageId,
                bd.booking_id AS bookingId
            FROM
                db_lead_bookings AS bd
            WHERE 
                bd.createdAt BETWEEN '${startDate}' AND '${endDate}' AND bd.deletedAt IS NULL
        ) AS combinedData
        GROUP BY
            WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1
        ORDER BY
            MIN(date);
        `

        case "yearly":
            return `SELECT
            CONCAT(YEAR(MIN(date)), '-', LEFT(MONTHNAME(MIN(date)), 3)) AS 'date',
            COUNT(brokerageId) AS 'brokerage',
            COUNT(bookingId) AS 'booking'
            FROM (
                SELECT
                ld.createdAt AS date,
                ld.brokerage_id AS brokerageId,
                NULL AS bookingId
            FROM
                db_lead_brokerages AS ld
            WHERE
                ld.createdAt BETWEEN '${startDate}' AND '${endDate}'  and ld.deletedAt IS null 
            
            UNION ALL
            
            SELECT
                bd.createdAt AS date,
                NULL AS brokerageId,
                bd.booking_id AS bookingId
            FROM
                db_lead_bookings AS bd
            WHERE 
                bd.createdAt BETWEEN  '${startDate}' AND '${endDate}'   and bd.deletedAt IS null
            ) AS combinedData
            GROUP BY
                YEAR(date), MONTH(date)
            ORDER BY
                MIN(date);`


        default:
            return `SELECT
            CONCAT(YEAR(MIN(date)), '-', LEFT(MONTHNAME(MIN(date)), 3)) AS 'date',
            COUNT(brokerageId) AS 'brokerage',
            COUNT(bookingId) AS 'booking'
            FROM (
                SELECT
                ld.createdAt AS date,
                ld.brokerage_id AS brokerageId,
                NULL AS bookingId
            FROM
                db_lead_brokerages AS ld
            WHERE
                ld.createdAt BETWEEN '${startDate}' AND '${endDate}'  and ld.deletedAt IS null 
            
            UNION ALL
            
            SELECT
                bd.createdAt AS date,
                NULL AS brokerageId,
                bd.booking_id AS bookingId
            FROM
                db_lead_bookings AS bd
            WHERE 
                bd.createdAt BETWEEN  '${startDate}' AND '${endDate}'   and bd.deletedAt IS null
            ) AS combinedData
            GROUP BY
                YEAR(date), MONTH(date)
            ORDER BY
                MIN(date);`
    }
}

const rangewiseEnrolVsAccept = (type, startDate, endDate, req) => {

    switch (type) {
        case "weekly":

            return `SELECT
            CONCAT(YEAR(date), '-', WEEK(date)) AS 'date',
            SUM(enrolled) AS enrolled,
            SUM(approved) AS approved
        FROM (
            SELECT
                DATE(userApproved.createdAt) AS date,
                0 AS enrolled,
                COUNT(DISTINCT userApproved.user_id) AS approved
            FROM
                db_users AS userApproved
            WHERE
                userApproved.doc_verification = 2
                AND userApproved.role_id = 1
                AND userApproved.createdAt BETWEEN  '${startDate}' AND '${endDate}'
                AND userApproved.deletedAt IS NULL
            GROUP BY
                DATE(userApproved.createdAt)
        
            UNION ALL
        
            SELECT
                DATE(userEnrol.createdAt) AS date,
                COUNT(DISTINCT userEnrol.user_id) AS enrolled,
                0 AS approved
            FROM
                db_users AS userEnrol
            WHERE
                userEnrol.doc_verification != 2
                AND userEnrol.role_id = 1
                AND userEnrol.createdAt BETWEEN  '${startDate}' AND '${endDate}'
                AND userEnrol.deletedAt IS NULL
            GROUP BY
                DATE(userEnrol.createdAt)
        ) AS subquery
        GROUP BY
            CONCAT(YEAR(date), '-', WEEK(date));`

        // this changed too
        case "monthly":

            return `SELECT
            CONCAT(
                WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1,
                CASE
                    WHEN WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1 IN (11, 12, 13) THEN 'th'
                    WHEN (WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1) % 10 = 1 THEN 'st'
                    WHEN (WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1) % 10 = 2 THEN 'nd'
                    WHEN (WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1) % 10 = 3 THEN 'rd'
                    ELSE 'th'
                END,
                ' week'
            ) AS 'date',
            SUM(enrolled) AS enrolled,
            SUM(approved) AS approved
        FROM (
            SELECT
                DATE(userApproved.createdAt) AS date,
                0 AS enrolled,
                COUNT(DISTINCT userApproved.user_id) AS approved
            FROM
                db_users AS userApproved
            WHERE
                userApproved.doc_verification = 2
                AND userApproved.role_id = 1
                AND userApproved.createdAt BETWEEN '${startDate}' AND '${endDate}'
                AND userApproved.deletedAt IS NULL
            GROUP BY
                DATE(userApproved.createdAt)
            
            UNION ALL
            
            SELECT
                DATE(userEnrol.createdAt) AS date,
                COUNT(DISTINCT userEnrol.user_id) AS enrolled,
                0 AS approved
            FROM
                db_users AS userEnrol
            WHERE
                userEnrol.doc_verification != 2
                AND userEnrol.role_id = 1
                AND userEnrol.createdAt BETWEEN '${startDate}' AND '${endDate}'
                AND userEnrol.deletedAt IS NULL
            GROUP BY
                DATE(userEnrol.createdAt)
        ) AS subquery
        GROUP BY
            WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1
        ORDER BY
            MIN(date);
        `

        // this changed too
        case "yearly":
            return `SELECT
            CONCAT(YEAR(MIN(date)), '-', LEFT(MONTHNAME(MIN(date)), 3)) AS 'date',
            SUM(enrolled) AS enrolled,
            SUM(approved) AS approved
        FROM (
            SELECT
                MIN(DATE(userApproved.createdAt)) AS date,
                0 AS enrolled,
                COUNT(DISTINCT userApproved.user_id) AS approved
            FROM
                db_users AS userApproved
            WHERE
                userApproved.doc_verification = 2
                AND userApproved.role_id = 1
                AND userApproved.createdAt BETWEEN '${startDate}' AND '${endDate}'
                AND userApproved.deletedAt IS NULL
            GROUP BY
                YEAR(userApproved.createdAt), MONTH(userApproved.createdAt)
            
            UNION ALL
            
            SELECT
                MIN(DATE(userEnrol.createdAt)) AS date,
                COUNT(DISTINCT userEnrol.user_id) AS enrolled,
                0 AS approved
            FROM
                db_users AS userEnrol
            WHERE
                userEnrol.doc_verification != 2
                AND userEnrol.role_id = 1
                AND userEnrol.createdAt BETWEEN '${startDate}' AND '${endDate}'
                AND userEnrol.deletedAt IS NULL
            GROUP BY
                YEAR(userEnrol.createdAt), MONTH(userEnrol.createdAt)
        ) AS subquery
        GROUP BY
            YEAR(date), MONTH(date)
        ORDER BY
            YEAR(date), MONTH(date);
        `

        default:

            return `SELECT
        CONCAT(YEAR(MIN(date)), '-', LEFT(MONTHNAME(MIN(date)), 3)) AS 'date',
        SUM(enrolled) AS enrolled,
        SUM(approved) AS approved
    FROM (
        SELECT
            MIN(DATE(userApproved.createdAt)) AS date,
            0 AS enrolled,
            COUNT(DISTINCT userApproved.user_id) AS approved
        FROM
            db_users AS userApproved
        WHERE
            userApproved.doc_verification = 2
            AND userApproved.role_id = 1
            AND userApproved.createdAt BETWEEN '${startDate}' AND '${endDate}'
            AND userApproved.deletedAt IS NULL
        GROUP BY
            YEAR(userApproved.createdAt), MONTH(userApproved.createdAt)
        
        UNION ALL
        
        SELECT
            MIN(DATE(userEnrol.createdAt)) AS date,
            COUNT(DISTINCT userEnrol.user_id) AS enrolled,
            0 AS approved
        FROM
            db_users AS userEnrol
        WHERE
            userEnrol.doc_verification != 2
            AND userEnrol.role_id = 1
            AND userEnrol.createdAt BETWEEN '${startDate}' AND '${endDate}'
            AND userEnrol.deletedAt IS NULL
        GROUP BY
            YEAR(userEnrol.createdAt), MONTH(userEnrol.createdAt)
    ) AS subquery
    GROUP BY
        YEAR(date), MONTH(date)
    ORDER BY
        YEAR(date), MONTH(date);
    `
    }
}

const rangewiseRequestedVsComplete = (type, startDate, endDate, req) => {

    switch (type) {
        case "weekly":

            return `SELECT
            CONCAT(YEAR(date), '-', WEEK(date)) AS 'date',
            SUM(Requested) AS Requested,
            SUM(Completed) AS Completed
        FROM (
                SELECT
                    DATE(v1.createdAt) AS date,
                    COUNT(DISTINCT v1.visit_id) AS Requested,
                    0 AS Completed
                FROM
                    db_lead_visits AS v1
                WHERE
                    v1.status = 'Requested'
                    AND v1.createdAt BETWEEN '${startDate}' AND '${endDate}'
                    AND v1.deletedAt IS NULL
                GROUP BY
                    DATE(v1.createdAt)

                UNION ALL

                SELECT
                    DATE(v2.createdAt) AS date,
                    0 AS Requested,
                    COUNT(DISTINCT v2.visit_id) AS Completed
                FROM
                    db_lead_visits AS v2
                WHERE
                    v2.status = 'Completed'
                    AND v2.createdAt BETWEEN '${startDate}' AND '${endDate}'
                    AND v2.deletedAt IS NULL
                GROUP BY
                    DATE(v2.createdAt)
        ) AS subquery
        GROUP BY
            CONCAT(YEAR(date), '-', WEEK(date));`

        // chnages this
        case "monthly":


            return `SELECT
            CONCAT(
                WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1,
                CASE
                    WHEN WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1 IN (11, 12, 13) THEN 'th'
                    WHEN (WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1) % 10 = 1 THEN 'st'
                    WHEN (WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1) % 10 = 2 THEN 'nd'
                    WHEN (WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1) % 10 = 3 THEN 'rd'
                    ELSE 'th'
                END,
                ' week'
            ) AS 'date',
            COUNT(visitID) AS Requested,
            COUNT(bookingId) AS Completed
        FROM (
            SELECT
                ld.createdAt AS date,
                ld.visit_id AS visitID,
                NULL AS bookingId
            FROM
                db_lead_visits AS ld
            WHERE
                ld.createdAt BETWEEN '${startDate}' AND '${endDate}'
                AND ld.deletedAt IS NULL 
            
            UNION ALL
            
            SELECT
                bd.createdAt AS date,
                NULL AS visitID,
                bd.booking_id AS bookingId
            FROM
                db_lead_bookings AS bd
            WHERE 
                bd.createdAt BETWEEN '${startDate}' AND '${endDate}'
                AND bd.deletedAt IS NULL
        ) AS combinedData
        GROUP BY
            WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1
        ORDER BY
            MIN(date);
        `


        case "yearly":
            return `SELECT
            CONCAT(YEAR(MIN(date)), '-', LEFT(MONTHNAME(MIN(date)), 3)) AS 'date',
            SUM(Requested) AS Requested,
            SUM(Completed) AS Completed
        FROM (
            SELECT
                MIN(DATE(v1.createdAt)) AS date,
                COUNT(DISTINCT CASE WHEN v1.status = 'Requested' THEN v1.visit_id END) AS Requested,
                0 AS Completed
            FROM
                db_lead_visits AS v1
            WHERE
                v1.createdAt BETWEEN '${startDate}' AND '${endDate}'
                AND v1.deletedAt IS NULL
            GROUP BY
                YEAR(v1.createdAt), MONTH(v1.createdAt)
        
            UNION ALL
        
            SELECT
                MIN(DATE(v2.createdAt)) AS date,
                0 AS Requested,
                COUNT(DISTINCT CASE WHEN v2.status = 'Completed' THEN v2.visit_id END) AS Completed
            FROM
                db_lead_visits AS v2
            WHERE
                v2.createdAt BETWEEN '${startDate}' AND '${endDate}'
                AND v2.deletedAt IS NULL
            GROUP BY
                YEAR(v2.createdAt), MONTH(v2.createdAt)
        ) AS subquery
        GROUP BY
            YEAR(date), MONTH(date)
        ORDER BY
            YEAR(date), MONTH(date);
        `



        default:

            return `SELECT
        CONCAT(YEAR(MIN(date)), '-', LEFT(MONTHNAME(MIN(date)), 3)) AS 'date',
        SUM(Requested) AS Requested,
        SUM(Completed) AS Completed
    FROM (
        SELECT
            MIN(DATE(v1.createdAt)) AS date,
            COUNT(DISTINCT CASE WHEN v1.status = 'Requested' THEN v1.visit_id END) AS Requested,
            0 AS Completed
        FROM
            db_lead_visits AS v1
        WHERE
            v1.createdAt BETWEEN '${startDate}' AND '${endDate}'
            AND v1.deletedAt IS NULL
        GROUP BY
            YEAR(v1.createdAt), MONTH(v1.createdAt)
    
        UNION ALL
    
        SELECT
            MIN(DATE(v2.createdAt)) AS date,
            0 AS Requested,
            COUNT(DISTINCT CASE WHEN v2.status = 'Completed' THEN v2.visit_id END) AS Completed
        FROM
            db_lead_visits AS v2
        WHERE
            v2.createdAt BETWEEN '${startDate}' AND '${endDate}'
            AND v2.deletedAt IS NULL
        GROUP BY
            YEAR(v2.createdAt), MONTH(v2.createdAt)
    ) AS subquery
    GROUP BY
        YEAR(date), MONTH(date)
    ORDER BY
        YEAR(date), MONTH(date);
    `
    }
}

const rangewiseVisitVsBooking = (type, startDate, endDate, req) => {

    switch (type) {
        case "weekly":

            return `SELECT
            DATE(date) as 'date',
            COUNT(visitID) AS 'visit',
            COUNT(bookingId) AS 'booking'
        FROM (
            SELECT
                ld.createdAt AS date,
                ld.visit_id AS visitID,
                NULL AS bookingId
            FROM
                db_lead_visits AS ld
            WHERE
                ld.createdAt BETWEEN '${startDate}' AND '${endDate}'  and ld.deletedAt IS null 
            
            UNION ALL
            
            SELECT
                bd.createdAt AS date,
                NULL AS visitID,
                bd.booking_id AS bookingId
            FROM
                db_lead_bookings AS bd
            WHERE 
                bd.createdAt BETWEEN  '${startDate}' AND '${endDate}'   and bd.deletedAt IS null
        ) AS combinedData
        GROUP BY
            DATE(date)
        ORDER BY
            DATE(date);`

        case "monthly":


            return `SELECT
            CONCAT(
                WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1,
                CASE
                    WHEN WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1 IN (11, 12, 13) THEN 'th' -- Special case for teens
                    WHEN (WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1) % 10 = 1 THEN 'st'
                    WHEN (WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1) % 10 = 2 THEN 'nd'
                    WHEN (WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1) % 10 = 3 THEN 'rd'
                    ELSE 'th'
                END,
                ' week'
            ) AS 'date',
            COUNT(visitID) AS visit,
            COUNT(bookingId) AS booking
        FROM (
            SELECT
                ld.createdAt AS date,
                ld.visit_id AS visitID,
                NULL AS bookingId
            FROM
                db_lead_visits AS ld
            WHERE
                ld.createdAt BETWEEN '${startDate}' AND '${endDate}'
                AND ld.deletedAt IS NULL 
            
            UNION ALL
            
            SELECT
                bd.createdAt AS date,
                NULL AS visitID,
                bd.booking_id AS bookingId
            FROM
                db_lead_bookings AS bd
            WHERE 
                bd.createdAt BETWEEN '${startDate}' AND '${endDate}'
                AND bd.deletedAt IS NULL
        ) AS combinedData
        GROUP BY
            WEEK(date, 1) - WEEK(DATE_SUB(date, INTERVAL DAYOFMONTH(date) - 1 DAY), 1) + 1
        ORDER BY
            MIN(date);
         `


        case "yearly":
            return `SELECT
            CONCAT(YEAR(MIN(date)), '-', LEFT(MONTHNAME(MIN(date)), 3)) AS 'date',
            COUNT(visitID) AS 'visit',
            COUNT(bookingId) AS 'booking'
        FROM (
            SELECT
                ld.createdAt AS date,
                ld.visit_id AS visitID,
                NULL AS bookingId
            FROM
                db_lead_visits AS ld
            WHERE
                ld.createdAt BETWEEN '${startDate}' AND '${endDate}'  and ld.deletedAt IS null 
            
            UNION ALL
            
            SELECT
                bd.createdAt AS date,
                NULL AS visitID,
                bd.booking_id AS bookingId
            FROM
                db_lead_bookings AS bd
            WHERE 
                bd.createdAt BETWEEN  '${startDate}' AND '${endDate}'   and bd.deletedAt IS null
        ) AS combinedData
        GROUP BY
            YEAR(date), MONTH(date)
        ORDER BY
            MIN(date)`


        default:

            return `SELECT
        CONCAT(YEAR(MIN(date)), '-', LEFT(MONTHNAME(MIN(date)), 3)) AS 'date',
        COUNT(visitID) AS 'visit',
        COUNT(bookingId) AS 'booking'
    FROM (
        SELECT
            ld.createdAt AS date,
            ld.visit_id AS visitID,
            NULL AS bookingId
        FROM
            db_lead_visits AS ld
        WHERE
            ld.createdAt BETWEEN '${startDate}' AND '${endDate}'  and ld.deletedAt IS null 
        
        UNION ALL
        
        SELECT
            bd.createdAt AS date,
            NULL AS visitID,
            bd.booking_id AS bookingId
        FROM
            db_lead_bookings AS bd
        WHERE 
            bd.createdAt BETWEEN  '${startDate}' AND '${endDate}'   and bd.deletedAt IS null
    ) AS combinedData
    GROUP BY
        YEAR(date), MONTH(date)
    ORDER BY
        MIN(date)`
    }
}

const topFiveQuery = (type) => {

    switch (type) {
        case "leads":

            return `
        SELECT 
            u.user_id,
            u.user,
            COUNT(l.lead_id) AS leadCount
        FROM 
            db_users u
        JOIN 
            db_leads l ON u.user_id = l.assigned_lead AND l.deletedAt IS NULL
        WHERE 
            u.deletedAt IS NULL
        GROUP BY 
            u.user_id
        ORDER BY 
            leadCount DESC`

        case "visit":


            return `
        SELECT 
            u.user_id,
            u.user,
            COUNT(l.lead_id) AS visitCount
        FROM 
            db_users u
        JOIN 
            db_leads l ON u.user_id = l.assigned_lead AND l.deletedAt IS NULL
        JOIN
            db_lead_visits v on v.lead_id = l.lead_id and v.deletedAt IS NULL
        WHERE 
            u.deletedAt IS NULL
        GROUP BY 
            u.user_id
        ORDER BY 
            visitCount DESC
        `


        case "booking":
            return `
        SELECT 
            u.user_id,
            u.user,
            COUNT(l.lead_id) AS bookingCount
        FROM 
            db_users u
        JOIN 
            db_leads l ON u.user_id = l.assigned_lead AND l.deletedAt IS NULL
        JOIN
            db_lead_bookings v on v.lead_id = l.lead_id and v.deletedAt IS NULL
        WHERE 
            u.deletedAt IS NULL
        GROUP BY 
            u.user_id
        ORDER BY 
            bookingCount DESC
        `



        default:
            return `
    SELECT 
        u.user_id,
        u.user,
        COUNT(l.lead_id) AS bookingCount
    FROM 
        db_users u
    JOIN 
        db_leads l ON u.user_id = l.assigned_lead AND l.deletedAt IS NULL
    JOIN
        db_lead_bookings v on v.lead_id = l.lead_id and v.deletedAt IS NULL
    WHERE 
        u.deletedAt IS NULL
    GROUP BY 
        u.user_id
    ORDER BY 
        bookingCount DESC
    `
    }
}