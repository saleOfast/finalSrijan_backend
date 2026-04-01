const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const { responseError, responseSuccess } = require('../../helper/responce')
const axios = require('axios');
const moment = require("moment");
const path = require("path");
const fs = require("fs");
const sendEmail = require("../../common/mailer");


const zeroPad = (num, places) => String(num).padStart(places, '0');

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

exports.storeChannelLead = async (req, res) => {
    try {
        // Destructuring request body
        let { lead_name, email_id, p_contact_no, address, pincode, p_visit_date, p_visit_time, project_id, project_name, created_on, updated_on, zone, zone_area, aadhar_card_number } = req.body;
        let leadData;

        // Date validation: Admin users can book for any date, others only for current date or next calendar date
        if (p_visit_date) {
            const isAdmin = req.user.role_id === 2 || req.user.role_id === 3;
            
            if (!isAdmin) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                
                // Parse the visit date properly - handle different date formats
                let visitDate;
                if (typeof p_visit_date === 'string') {
                    // Try parsing as dd-MM-YYYY format first (since this is the format from req.body)
                    if (p_visit_date.includes('-')) {
                        const parts = p_visit_date.split('-').map(Number);
                        // Check if it's dd-MM-YYYY format (day first, then month, then year)
                        if (parts.length === 3 && parts[2] > 1000) { // Year is 4 digits
                            visitDate = new Date(parts[2], parts[1] - 1, parts[0]); // dd-MM-YYYY
                        } else {
                            // Fallback to YYYY-MM-DD format
                            visitDate = new Date(parts[0], parts[1] - 1, parts[2]); // YYYY-MM-DD
                        }
                    } else if (p_visit_date.includes('/')) {
                        // Try parsing as MM/DD/YYYY or DD/MM/YYYY format
                        const parts = p_visit_date.split('/').map(Number);
                        if (parts[2] > 31) { // Assume year is last if it's > 31
                            visitDate = new Date(parts[2], parts[0] - 1, parts[1]); // MM/DD/YYYY
                        } else {
                            visitDate = new Date(parts[2], parts[1] - 1, parts[0]); // DD/MM/YYYY
                        }
                    } else {
                        visitDate = new Date(p_visit_date);
                    }
                } else {
                    visitDate = new Date(p_visit_date);
                }
                
                // Check if the parsed date is valid
                if (isNaN(visitDate.getTime())) {
                    return await responseError(req, res, "Invalid date format provided");
                }
                
                // Create a copy of the visitDate for comparison to avoid modifying the original
                const visitDateCopy = new Date(visitDate);
                visitDateCopy.setHours(0, 0, 0, 0);
                
                // Check if visit date is valid (today or tomorrow only for non-admin users)
                const todayTime = today.getTime();
                const tomorrowTime = tomorrow.getTime();
                const visitTime = visitDateCopy.getTime();
                
                if (visitTime !== todayTime && visitTime !== tomorrowTime) {
                    return await responseError(req, res, "Visit request can only be created for Today and Tomorrow");
                }
                
                // Format the date properly for database insertion (MySQL expects YYYY-MM-DD)
                let dbVisitDate;
                if (visitDate && !isNaN(visitDate.getTime())) {
                    const year = visitDate.getFullYear();
                    const month = String(visitDate.getMonth() + 1).padStart(2, '0');
                    const day = String(visitDate.getDate()).padStart(2, '0');
                    dbVisitDate = `${year}-${month}-${day}`;
                    
                    // Additional validation to ensure we have a valid date
                    if (!dbVisitDate || dbVisitDate === 'NaN-NaN-NaN') {
                        delete body.p_visit_date;
                    }
                } else {
                    // If we somehow get here with an invalid date, don't update the visit date
                    delete body.p_visit_date;
                }
                
                // Update the p_visit_date in the body with the properly formatted date
                p_visit_date = dbVisitDate;
            }
            
            // Debug logging
            console.log('Lead Date Validation Debug:');
            console.log('p_visit_date:', p_visit_date);
            console.log('today:', today.toISOString());
            console.log('tomorrow:', tomorrow.toISOString());
            console.log('visitDate:', visitDate.toISOString());
            
            // Check if visit date is valid (today or tomorrow only for non-admin users)
            const todayTime = today.getTime();
            const tomorrowTime = tomorrow.getTime();
            const visitTime = visitDate.getTime();
            
            console.log('todayTime:', todayTime);
            console.log('tomorrowTime:', tomorrowTime);
            console.log('visitTime:', visitTime);
            console.log('User role_id:', req.user.role_id);
            console.log('Is admin:', isAdmin);
            
            if (visitTime !== todayTime && visitTime !== tomorrowTime) {
                console.log('Validation failed - date not today or tomorrow');
                return await responseError(req, res, "Visit request can only be created for Today and Tomorrow");
            } else {
                console.log('Validation passed - date is today or tomorrow');
            }
        }

        if (!p_contact_no || p_contact_no.trim() === "" || isNaN(Number(p_contact_no))) {
            p_contact_no = null;
        }

        const ninetyDaysAgo = moment().subtract(90, 'days').toDate();

        // Check for duplicate lead based on email, contact number, visit date, and visit time
        const whereCondition = {
            sales_project_id: project_id,
            [Op.or]: [
                { email_id: email_id }
            ]
        };

        // Only add phone number condition if it's NOT null
        if (p_contact_no !== null) {
            whereCondition[Op.or].push({ p_contact_no: p_contact_no });
        }

        leadData = await req.config.leads.findOne({
            where: whereCondition,
            order: [['createdAt', 'DESC']]
        });


        // Block if lead exists AND is less than 90 days old
        if (leadData) {
            const createdAt = moment(leadData.createdAt);

            if (createdAt.isAfter(ninetyDaysAgo)) {
                // Lead is within 90 days — block creation
                return await responseError(req, res, "Lead already exists with this email or phone within the last 90 days.");
            } else if (leadData.lead_stg_id != 4 || leadData.lead_stg_id != 5) {
                // Lead is old AND NOT in stage 4 or 5 — update to stage 5 (Closed - Lost)
                await leadData.update({ lead_stg_id: 5 });
            }
        }

        // Count the total number of leads (including soft-deleted ones)
        let leadcount = await req.config.leads.count({ paranoid: false });

        // Prepare lead data for insertion
        let body = {
            lead_name,
            email_id,
            p_contact_no,
            address,
            pincode,
            p_visit_date,
            p_visit_time,
            assigned_by: req.user.user_id,
            assigned_lead: req.user.user_id,
            lead_owner: req.user.user_id,
            sales_project_id: project_id,
            sales_project_name: project_name,
            lead_stg_id: 1,
            created_on,
            updated_on,
            zone,
            zone_area,
            aadhar_card_number,
            lead_code: `${req.admin.user.charAt(0).toUpperCase()}${req.admin.user_l_name ? req.admin.user_l_name.charAt(0).toUpperCase() : ''}L_${zeroPad(leadcount + 1, 5)}`
        };

        leadData = await req.config.leads.create(body)
        return await responseSuccess(req, res, "Lead created successfully", leadData);

    } catch (error) {
        logErrorToFile(error)
        console.error("Error:", error);
        return await responseError(req, res, "Something Went Wrong");
    }
};

exports.getleads = async (req, res) => {
    try {
        let leadData;
        let whereClause = {};

        if (req.query.cp_id) {
            if (decodeURIComponent(req.query.cp_id)) {
                whereClause.lead_owner = decodeURIComponent(req.query.cp_id)
            }
        }
        if (req.query.status_id) {
            whereClause.lead_stg_id = req.query.status_id
        }
        // Filter by ERP lead ID (to get leads from ERP)
        if (req.query.erp_lead_id) {
            whereClause.erp_lead_id = decodeURIComponent(req.query.erp_lead_id);
        }
        // Filter to get all ERP leads (where erp_lead_id is not null)
        if (req.query.from_erp === 'true' || req.query.from_erp === true) {
            whereClause.erp_lead_id = { [Op.ne]: null };
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
        if (req.user.role_id !== null && req.user.role_id !== 3 && req.user.role_id !== 2) {
            whereClause.assigned_lead = req.user.user_id
        }
        if (!req.query.lead_id) {
            if (req.user.role_id === 2) {
                leadData = await req.config.leads.findAll({
                    where: { ...whereClause },
                    include: [
                        {
                            model: req.config.leadStages,
                            attributes: {
                                exclude: ["createdAt", "updatedAt", "deletedAt"],
                            },
                        },
                        {
                            model: req.config.users,
                            where: {
                                report_to: req.user.user_id
                            },
                            attributes: {
                                exclude: ["createdAt", "updatedAt", "deletedAt"],
                            },
                            required: true
                        },
                        {
                            model: req.config.users, paranoid: false,
                            as: 'leadOwner',
                            attributes: {
                                exclude: ["createdAt", "updatedAt", "deletedAt"],
                            },
                            required: true
                        },
                        {
                            model: req.config.leadVisit,
                            as: 'visitList',
                            attributes: {
                                exclude: ["updatedAt", "deletedAt"],
                            },
                            order: [["visit_id", "DESC"]],
                            limit: 1
                        },

                    ],
                    order: [["lead_id", "DESC"]],
                })
            } else if (req.user.role_id === 3) {

                const getUserHierarchyQuery = `
                    WITH RECURSIVE user_hierarchy AS (
                        SELECT user_id, report_to, user
                        FROM db_users
                        WHERE user_id = :user_id
                        UNION
                        SELECT u.user_id, u.report_to, u.user
                        FROM db_users u
                        INNER JOIN user_hierarchy uh ON u.report_to = uh.user_id
                    )
                    SELECT user_id, user FROM user_hierarchy;
                `;

                // Fetch all users under the current BST Head
                const AllUsers = await req.config.sequelize.query(getUserHierarchyQuery, {
                    replacements: { user_id: req.user.user_id },
                    type: QueryTypes.SELECT
                });
                const userIds = AllUsers.map(user => user.user_id);

                leadData = await req.config.leads.findAll({
                    where: {
                        lead_owner: { [Op.in]: userIds } // Fetch leads assigned to all BST and channel partner users
                    },
                    include: [
                        {
                            model: req.config.leadStages,
                            attributes: {
                                exclude: ["createdAt", "updatedAt", "deletedAt"],
                            },
                        },
                        {
                            model: req.config.users,
                            where: {
                                user_id: { [Op.in]: userIds }
                            },
                            attributes: {
                                exclude: ["createdAt", "updatedAt", "deletedAt"],
                            },
                            required: true
                        },
                        {
                            model: req.config.users, paranoid: false,
                            as: 'leadOwner',
                            attributes: {
                                exclude: ["createdAt", "updatedAt", "deletedAt"],
                            },
                            required: true
                        },
                        {
                            model: req.config.leadVisit,
                            as: 'visitList',
                            attributes: {
                                exclude: ["updatedAt", "deletedAt"],
                            },
                            order: [["visit_id", "DESC"]],
                            limit: 1
                        },

                    ],
                    order: [["lead_id", "DESC"]],
                })
            } else {
                leadData = await req.config.leads.findAll({
                    where: {
                        ...whereClause,
                    },
                    include: [
                        {
                            model: req.config.leadStages,
                            attributes: {
                                exclude: ["createdAt", "updatedAt", "deletedAt"],
                            },
                        },
                        {
                            model: req.config.users, paranoid: false,
                            as: 'leadOwner',
                            attributes: {
                                exclude: ["createdAt", "updatedAt", "deletedAt"],
                            },
                            required: true
                        },
                        {
                            model: req.config.leadVisit,
                            as: 'visitList',
                            attributes: {
                                exclude: ["updatedAt", "deletedAt"],
                            },
                            order: [["visit_id", "DESC"]],
                            limit: 1
                        },

                    ],
                    order: [["lead_id", "DESC"]],
                })
            }

        } else {
            // Fetch single lead by ID
            leadData = await req.config.leads.findByPk(req.query.lead_id, {
                include: [
                    {
                        model: req.config.channelProject,
                        as: 'projectData',
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.leadStages,
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                    {
                        model: req.config.users,
                        as: 'leadOwner',
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },
                    },
                ]
            });

            // Safely add project_name to the response object for single-lead fetch
            if (leadData) {
                const leadJson = leadData.toJSON ? leadData.toJSON() : leadData;
                leadJson.project_name =
                    leadJson.sales_project_name ||
                    (leadJson.projectData && leadJson.projectData.project) ||
                    null;

                return await responseSuccess(req, res, "leadList list", leadJson);
            }
        }

        return await responseSuccess(req, res, "leadList list", leadData)

    } catch (error) {
        logErrorToFile(error)
        console.log("error", error)
        return await responseError(req, res, "leadList fetching failed")
    }
}

// exports.editleads = async (req, res) => {
//     try {

//         let { lead_id, email_id, p_contact_no, p_visit_date, p_visit_time, project_id, project_name, zone, zone_area } = req.body
//         let body = req.body

//         // Role-based field validation
//         const isAdmin = req.user.role_id === 2 || req.user.role_id === 3;
        
//         if (!isAdmin) {
//             // Non-admin users cannot edit these fields
//             // const restrictedFields = ['project_id', 'project_name', 'zone', 'zone_area'];
//             // const attemptedRestrictedEdits = restrictedFields.filter(field => req.body[field] !== undefined);
            
//             // if (attemptedRestrictedEdits.length > 0) {
//             //     return await responseError(req, res, `You don't have permission to edit: ${attemptedRestrictedEdits.join(', ')}`);
//             // }
            
//             // Date validation for non-admin users - only allow today and tomorrow
//             if (p_visit_date) {
//                 const today = new Date();
//                 today.setHours(0, 0, 0, 0);
                
//                 const tomorrow = new Date(today);
//                 tomorrow.setDate(tomorrow.getDate() + 1);
                
//                 // Parse the visit date properly - handle different date formats
//                 let visitDate;
//                 if (typeof p_visit_date === 'string') {
//                     if (p_visit_date.includes('-')) {
//                         const parts = p_visit_date.split('-').map(Number);
//                         if (parts.length === 3 && parts[2] > 1000) { // dd-MM-YYYY format
//                             visitDate = new Date(parts[2], parts[1] - 1, parts[0]);
//                         } else { // YYYY-MM-DD format
//                             visitDate = new Date(parts[0], parts[1] - 1, parts[2]);
//                         }
//                     } else if (p_visit_date.includes('/')) {
//                         const parts = p_visit_date.split('/').map(Number);
//                         if (parts[2] > 31) { // MM/DD/YYYY format
//                             visitDate = new Date(parts[2], parts[0] - 1, parts[1]);
//                         } else { // DD/MM/YYYY format
//                             visitDate = new Date(parts[2], parts[1] - 1, parts[0]);
//                         }
//                     } else {
//                         visitDate = new Date(p_visit_date);
//                     }
//                 } else {
//                     visitDate = new Date(p_visit_date);
//                 }
                
//                 // Check if the parsed date is valid
//                 if (isNaN(visitDate.getTime())) {
//                     return await responseError(req, res, "Invalid date format provided");
//                 }
                
//                 // Create a copy of the visitDate for comparison to avoid modifying the original
//                 const visitDateCopy = new Date(visitDate);
//                 visitDateCopy.setHours(0, 0, 0, 0);
                
//                 // Check if visit date is valid (today or tomorrow only for non-admin users)
//                 const todayTime = today.getTime();
//                 const tomorrowTime = tomorrow.getTime();
//                 const visitTime = visitDateCopy.getTime();
                
//                 if (visitTime !== todayTime && visitTime !== tomorrowTime) {
//                     return await responseError(req, res, "Visit request can only be created for Today and Tomorrow");
//                 }
                
//                 // Format the date properly for database insertion (MySQL expects YYYY-MM-DD)
//                 let dbVisitDate;
//                 if (visitDate && !isNaN(visitDate.getTime())) {
//                     const year = visitDate.getFullYear();
//                     const month = String(visitDate.getMonth() + 1).padStart(2, '0');
//                     const day = String(visitDate.getDate()).padStart(2, '0');
//                     dbVisitDate = `${year}-${month}-${day}`;
                    
//                     // Additional validation to ensure we have a valid date
//                     if (!dbVisitDate || dbVisitDate === 'NaN-NaN-NaN') {
//                         delete body.p_visit_date;
//                     }
//                 } else {
//                     // If we somehow get here with an invalid date, don't update the visit date
//                     delete body.p_visit_date;
//                 }
                
//                 // Update the p_visit_date in the body with the properly formatted date
//                 body.p_visit_date = dbVisitDate;
//             }
//         }

//         if (!p_contact_no || p_contact_no == "" || Number(p_contact_no) == NaN) {
//             p_contact_no = null
//         }

//         let leadData = await req.config.leads.findByPk(lead_id)
//         if (!leadData) return await responseError(req, res, "no lead existed")

//         let leadDuplicateData = await req.config.leads.findOne({
//             where: {
//                 lead_id: { [Op.ne]: lead_id },
//                 [Op.or]: [
//                     { email_id }, { p_contact_no }
//                 ]
//             }
//         })
//         if (leadDuplicateData) return await responseError(req, res, "Lead already exists with this email or phone ")
//         body.sales_project_id = project_id
//         body.sales_project_name = project_name
//         delete body.project_id

//         // Final validation: Remove any invalid date values before database update
//         if (body.p_visit_date === 'Invalid date' || body.p_visit_date === 'NaN-NaN-NaN' || !body.p_visit_date) {
//             delete body.p_visit_date;
//         }

//         await leadData.update(body)
//         return await responseSuccess(req, res, "lead updated")

//     } catch (error) {
//         logErrorToFile(error)
//         console.log("error", error)
//         return await responseError(req, res, "lead updated failed")
//     }
// }


exports.editleads = async (req, res) => {
    try {
        let { lead_id, email_id, p_contact_no, p_visit_date, p_visit_time, project_id, project_name, zone, zone_area } = req.body;
        let body = req.body;

        // Role-based field validation
        const isAdmin = req.user.role_id === 2 || req.user.role_id === 3;

        if (!isAdmin) {
            // Non-admin users - date validation
            if (p_visit_date) {
                // Try to parse date in supported formats
                let visitDate = moment(p_visit_date, ["DD-MM-YYYY", "YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"], true);

                if (!visitDate.isValid()) {
                    return await responseError(req, res, "Invalid date format provided");
                }

                // Allow only today or tomorrow
                const today = moment().startOf("day");
                const tomorrow = moment().add(1, "day").startOf("day");

                if (
                    !visitDate.isSame(today, "day") &&
                    !visitDate.isSame(tomorrow, "day")
                ) {
                    return await responseError(
                        req,
                        res,
                        "Visit request can only be created for Today and Tomorrow"
                    );
                }

                // Format for MySQL (YYYY-MM-DD)
                body.p_visit_date = visitDate.format("YYYY-MM-DD");
            }
        } else {
            // Admins can still have date validation
            if (p_visit_date) {
                let visitDate = moment(p_visit_date, ["DD-MM-YYYY", "YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"], true);

                if (visitDate.isValid()) {
                    body.p_visit_date = visitDate.format("YYYY-MM-DD");
                } else {
                    delete body.p_visit_date; // avoid inserting "Invalid date"
                }
            }
        }

        // Phone validation
        if (!p_contact_no || p_contact_no === "" || isNaN(Number(p_contact_no))) {
            p_contact_no = null;
        }

        // Find lead
        let leadData = await req.config.leads.findByPk(lead_id);
        if (!leadData) return await responseError(req, res, "no lead existed");

        // Check duplicates
        let leadDuplicateData = await req.config.leads.findOne({
            where: {
                lead_id: { [Op.ne]: lead_id },
                [Op.or]: [{ email_id }, { p_contact_no }],
            },
        });
        if (leadDuplicateData)
            return await responseError(req, res, "Lead already exists with this email or phone");

        // Map project fields
        body.sales_project_id = project_id;
        body.sales_project_name = project_name;
        delete body.project_id;

        // Final cleanup: if date still invalid, remove it
        if (!body.p_visit_date) {
            delete body.p_visit_date;
        }

        await leadData.update(body);
        return await responseSuccess(req, res, "lead updated");
    } catch (error) {
        logErrorToFile(error);
        console.log("error", error);
        return await responseError(req, res, "lead update failed");
    }
};


exports.deleteleads = async (req, res) => {
    try {

        let { lead_id } = req.body
        let leadData = await req.config.leads.findOne({
            where: {
                lead_id
            }
        })

        if (!leadData) return await responseError(req, res, "lead name does not existed")
        await leadData.destroy()
        return await responseSuccess(req, res, "lead deleted")

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "lead deletion failed")
    }
}

exports.deleteLeadByID = async (req, res) => {
    try {
        const leadIds = req.body.l_id;

        if (!Array.isArray(leadIds) || leadIds.length === 0) {
            return responseError(req, res, "Leads not Selected");
        }

        const leadsToDelete = await req.config.leads.findAll({
            where: {
                lead_id: {
                    [Op.in]: leadIds,
                },
            },
        });

        if (leadsToDelete.length === 0) {
            return responseError(req, res, "No Leads found with the specified IDs");
        }

        await Promise.all(leadsToDelete.map((lead) => lead.destroy()));

        return responseSuccess(req, res, "Leads deleted successfully");
    } catch (error) {
        logErrorToFile(error);
        console.error("Error:", error);
        return responseError(req, res, "Something Went Wrong");
    }
};

exports.getSalesForceToken = async (req, res) => {
    try {

        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://NK Realtors--postsales.sandbox.my.salesforce.com/services/oauth2/token?username=admin%40NK Realtors.com.postsales&password=NK Realtors%40123vYX98EkG31lg5Px0ZnL7htFFa&grant_type=password&client_id=3MVG9Po2PmyYruunGgi2prNyVV6tkMw2sEKnTxnl__qXGx8UtKhsi7cKL8WnfdaCyy9d7q5yB5slQkjvL3jvS&client_secret=11B5983495743D8DBA34CC3B5D12FAD8F0F11106ED19A7E00A01403F7942195E',
            headers: {
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZGJfbmFtZSI6Ik1VTFRJX1VTRVI5ODk0MTA5NiIsInVzZXJfY29kZSI6IlVTRVI5ODk0MTA5NiIsImlhdCI6MTcxNTg0MjIzNiwiZXhwIjoxNzE1ODcxMDM2fQ.pZ3QE4XFrDT5ZCBkzP2_4Zzw09TIHJZoIJhO4tdRw5Y',
                'Cookie': 'BrowserId=uISrwxHlEe-g1NsuvW73ow; CookieConsentPolicy=0:0; LSKey-c$CookieConsentPolicy=0:0'
            }
        };

        axios.request(config)
            .then((response) => {
                console.log(JSON.stringify(response.data));
                return responseSuccess(req, res, "response.data", response.data)
            })
            .catch((error) => {
                console.log(error);
                return responseError(req, res, "lead updated failed")
            });

    } catch (error) {
        logErrorToFile(error)
        return await responseError(req, res, "lead updated failed")
    }
}

exports.fetchOrderNO = async (req, res) => {
    try {
        const { queryStr } = req.body
        if (!queryStr) return await responseError(req, res, "empty string")
        var myWord = 'number';
        let result = new RegExp('\\b' + myWord + '\\b').test(queryStr);
        if (result) {
            let order = queryStr.toString().split('number: ')[1].split('Date')[0]
            return responseSuccess(req, res, "response.data", order.slice(0, order.length - 1))
        } else {
            return await responseError(req, res, "Order id doesnt exist ")
        }
        // false




    } catch (error) {
        logErrorToFile(error)
        console.log(error, "error")
        return await responseError(req, res, "Order got error")
    }
}

exports.getProjectList = async (req, res) => {
    try {
        const fetchAccessToken = async (retries = 3) => {
            const fetch = (await import('node-fetch')).default;
            const url = `${req.admin.host_name || process.env.CLIENT_TOKEN_URL}`;
            const params = new URLSearchParams({
                grant_type: req.admin.grant_type || process.env.GRANTTYPE,
                client_id: req.admin.salesforce_client_id || process.env.SALESFORCE_CLIENT_ID,
                client_secret: req.admin.salesforce_client_pwd || process.env.SALESFORCE_CLIENT_PWD
            });

            const requestOptions = {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params.toString(),
                redirect: "follow"
            };

            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    const response = await fetch(url, requestOptions);
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return await response.json(); // Assuming the response is JSON
                } catch (error) {
                    logErrorToFile(error)
                    if (attempt < retries) {
                        console.log(`Retry attempt ${attempt} failed. Retrying...`);
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
                    } else {
                        throw error;
                    }
                }
            }
        };

        const tokenResponse = await fetchAccessToken();

        const fetchProjectList = async (accessToken, retries = 3) => {
            const fetch = (await import('node-fetch')).default;
            const url = `${req.admin.salesforce_url || process.env.CLIENT_REQ_URL}/query?q=SELECT+Id,Project_Name__c+FROM+CProject__c`;
            const requestOptions = {
                method: "GET",
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                redirect: "follow"
            };

            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    const response = await fetch(url, requestOptions);
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    const result = await response.json();
                    console.log("Project List Response:", result);
                    const sortedRecords = result.records.sort((a, b) => {
                        const nameA = a.Project_Name__c.toUpperCase(); // ignore case
                        const nameB = b.Project_Name__c.toUpperCase(); // ignore case
                        return nameA.localeCompare(nameB);
                    });

                    result.records = sortedRecords;
                    return result; // Return the sorted records
                } catch (error) {
                    logErrorToFile(error)
                    if (attempt < retries) {
                        console.log(`Retry attempt ${attempt} failed. Retrying...`);
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
                    } else {
                        throw error;
                    }
                }
            }
        };


        const accessToken = tokenResponse.access_token;

        const projectList = await fetchProjectList(accessToken);
        return responseSuccess(req, res, "project list", projectList);

    } catch (error) {
        logErrorToFile(error)
        console.error("Error fetching project list:", error);
        return await responseError(req, res, "project list fetch failed");
    }
};

// get lead list or one lead 
exports.getLeadLocationList = async (req, res) => {
    try {
        let leadLocation = await req.config.leadLocation.findAll()
        await responseSuccess(req, res, "lead location list", leadLocation)
    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        await responseError(req, res, "Something Went Wrong")
    }
}

exports.sendMailToLeadOwners = async (req) => {
    try {
        const pendingLeads = await req.leads.findAll({
            where: {
                lead_stg_id: 1,
                deletedAt: null,
                mailSent: { [Op.in]: [null, false] },
                createdAt: {
                    [Op.lte]: moment().subtract(24, 'hours').toDate()
                }
            }
        });

        if (pendingLeads.length === 0) {
            console.log('No Leads found.');
            return;
        }
        const emailTemplate = await req.config.emailTemplates.findOne({ where: { template_id: 2 } })  // Pending Channel Partner Lead Notification (72 Hrs)
        const htmlTemplatePath = path.join(
            __dirname,
            "..",
            "..",
            "mail",
            "cp",
            "newCPLead.html"
        );
        const htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");
        for (const lead of pendingLeads) {
            let leadOwner = await req.users.findByPk(lead.lead_owner)
            if (!leadOwner) {
                console.log(`No lead owner for lead ${lead.lead_name}`)
                continue
            }
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

            let htmlContent = htmlTemplate.replace("{{Name}}", lead.lead_name);
            htmlContent = htmlContent.replace("{{PhoneNo}}", lead.p_contact_no);
            htmlContent = htmlContent.replace("{{EmailID}}", lead.email_id).replace(/{{CompanyName}}/g, company_name);

            if (!leadOwner.email) {
                console.log(`No lead owner email found for lead ${lead.lead_name}`)
                continue
            }
            let option = {
                email: leadOwner.email,
                subject: "Srijan Bandhan",
                message: htmlContent,
            };
            await sendEmail(option);
            await req.leads.update({ mailSent: true }, { where: { lead_id: lead.lead_id } })
        }
        console.log('Emails sent successfully.');
        return
    } catch (error) {
        console.error('Error assigning leads:', error);
    }
}