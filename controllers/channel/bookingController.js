const { Op, QueryTypes } = require("sequelize");
const { responseError, responseSuccess } = require('../../helper/responce')
const moment = require("moment");


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
async function updateBookingStatuses(req, bookingData, currentDateTime) {
    // Filter booking records that are eligible for update
    const bookingIdsToUpdate = bookingData
        .filter(d => {
            const bookingDateTime = moment(`${d.BookingleadData.p_visit_date} ${d.BookingleadData.p_visit_time}`);
            const daysSinceVisit = currentDateTime.diff(bookingDateTime, 'days');
            return daysSinceVisit > 90 && d.status === 'Eligible for brokerage bill';
        })
        .map(d => d.booking_id);

    if (bookingIdsToUpdate.length > 0) {
        try {
            // Perform the bulk update
            await req.config.leadBooking.update(
                { status: 'VISIT DONE NOT BOOKED' },
                { where: { booking_id: { [Op.in]: bookingIdsToUpdate } } }
            );
        } catch (error) {
            console.error('Error updating booking statuses:', error);
        }
    } else {
        console.log('No bookings to update.');
    }
}

exports.getleadBooking = async (req, res) => {
    try {
        let bookingData = [];
        let whereClause = {};
        let owner = {}
        if (!req.user.isDB) {
            owner = { lead_owner: req.user.user_id }
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
        if (!req.query.booking_id) {
            if (req.user.role_id === 3) {

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

                bookingData = await req.config.leadBooking.findAll({
                    where: {
                        ...whereClause,
                    },
                    include: [
                        {
                            model: req.config.leads,
                            as: 'BookingleadData',
                            where: { lead_owner: { [Op.in]: userIds } },
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
                            ],
                            required: true,
                        },

                        {
                            model: req.config.channelProject,
                            as: 'BookingprojectData',
                            attributes: {
                                exclude: ["createdAt", "updatedAt", "deletedAt"],
                            },
                        },

                        {
                            model: req.config.leadBrokerage,
                            as: 'BrokerageBookingList',
                            attributes: {
                                exclude: ["createdAt", "updatedAt", "deletedAt"],
                            },
                        },

                    ],
                    order: [["booking_id", "DESC"]],
                })
            } else if (req.user.role_id === 2) {
                bookingData = await req.config.leadBooking.findAll({
                    where: {
                        ...whereClause,
                    },
                    include: [
                        {
                            model: req.config.leads,
                            as: 'BookingleadData',
                            where: { ...owner },
                            // where: { lead_owner : req.user.user_id },
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
                            ],
                            required: true,
                        },

                        {
                            model: req.config.channelProject,
                            as: 'BookingprojectData',
                            attributes: {
                                exclude: ["createdAt", "updatedAt", "deletedAt"],
                            },
                        },

                        {
                            model: req.config.leadBrokerage,
                            as: 'BrokerageBookingList',
                            attributes: {
                                exclude: ["createdAt", "updatedAt", "deletedAt"],
                            },
                        },

                    ],
                    order: [["booking_id", "DESC"]],
                })
            } else {
                bookingData = await req.config.leadBooking.findAll({
                    where: {
                        ...whereClause,
                    },
                    include: [
                        {
                            model: req.config.leads,
                            as: 'BookingleadData',
                            where: { ...owner },
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
                            ],
                            required: true,
                        },

                        {
                            model: req.config.channelProject,
                            as: 'BookingprojectData',
                            attributes: {
                                exclude: ["createdAt", "updatedAt", "deletedAt"],
                            },
                        },

                        {
                            model: req.config.leadBrokerage,
                            as: 'BrokerageBookingList',
                            attributes: {
                                exclude: ["createdAt", "updatedAt", "deletedAt"],
                            },
                        },

                    ],
                    order: [["booking_id", "DESC"]],
                })
            }

        } else {
            bookingData = await req.config.leadBooking.findByPk(req.query.booking_id, {
                include: [
                    {
                        model: req.config.leads,
                        as: 'BookingleadData',
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                        required: true,
                        include: [
                            {
                                model: req.config.users, paranoid: false,
                                as: 'leadOwner',
                                where: { ...owner },
                                attributes: {
                                    exclude: ["createdAt", "updatedAt", "deletedAt"],
                                },
                            },
                        ],
                    },
                    {
                        model: req.config.channelProject,
                        as: 'BookingprojectData',
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },

                ],
            })
            return await responseSuccess(req, res, "Booking data", bookingData)
        }
        const currentDateTime = moment();
        await updateBookingStatuses(req, bookingData, currentDateTime);
        return await responseSuccess(req, res, "Booking data", bookingData)

    } catch (error) {
        logErrorToFile(error)
        console.log("error", error)
        return await responseError(req, res, "bookingList fetching failed", error)
    }
}