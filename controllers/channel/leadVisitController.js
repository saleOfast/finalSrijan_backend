const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const { responseError, responseSuccess } = require('../../helper/responce')
const axios = require('axios');
const moment = require("moment");
const zeroPad = (num, places) => String(num).padStart(places, '0')

const fetchAccessToken = async (req, retries = 3) => {
    const fetch = (await import('node-fetch')).default;
    const url = `${req.admin?.host_name || process.env.CLIENT_TOKEN_URL}`;
    const params = new URLSearchParams({
        grant_type: req.admin?.grant_type || process.env.GRANTTYPE,
        client_id: req.admin?.salesforce_client_id || process.env.SALESFORCE_CLIENT_ID,
        client_secret: req.admin?.salesforce_client_pwd || process.env.SALESFORCE_CLIENT_PWD
    });

    const requestOptions = {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
        redirect: "follow",
    };

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, requestOptions);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return await response.json(); // Assuming the response is JSON
        } catch (error) {
            logErrorToFile(error);
            if (attempt < retries) {
                console.log(`Retry attempt ${attempt} failed. Retrying...`);
                await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
            } else {
                throw error;
            }
        }
    }
};

function subtractTime(date) {
    let newDate = new Date(date);
    newDate.setHours(newDate.getHours() - 5);
    newDate.setMinutes(newDate.getMinutes() - 30);
    return newDate.toISOString();
}

function addOneDay(date) {
    let newDate = new Date(date);
    newDate.setDate(newDate.getDate() + 1);
    return newDate.toISOString();
}

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

// exports.createLeadVisit = async (req, res) => {
//     try {
//         // Destructuring request body
//         const { lead_id, p_visit_date, p_visit_time, current_date, remarks } = req.body;
//         let sales_visit_id = '';
//         let sales_lead_id
        
//         // Date validation: Admin users can book for any date, others only for current date or next calendar date
//         const isAdmin = req.user.role_id === 2 || req.user.role_id === 3;
        
//         if (!isAdmin) {
//             const today = new Date();
//             today.setHours(0, 0, 0, 0);
            
//             const tomorrow = new Date(today);
//             tomorrow.setDate(tomorrow.getDate() + 1);
            
//             const visitDate = new Date(p_visit_date);
//             visitDate.setHours(0, 0, 0, 0);
            
//             // Debug logging
//             console.log('Date Validation Debug:');
//             console.log('p_visit_date:', p_visit_date);
//             console.log('today:', today.toISOString());
//             console.log('tomorrow:', tomorrow.toISOString());
//             console.log('visitDate:', visitDate.toISOString());
            
//             // Check if visit date is valid (today or tomorrow only for non-admin users)
//             const daysDiff = Math.floor((visitDate - today) / (1000 * 60 * 60 * 24));
            
//             console.log('daysDiff:', daysDiff);
//             console.log('User role_id:', req.user.role_id);
//             console.log('Is admin:', isAdmin);
            
//             if (daysDiff !== 0 && daysDiff !== 1) {
//                 console.log('Validation failed - date not today or tomorrow');
//                 return await responseError(req, res, "Visit request can only be created for Today and Tomorrow");
//             } else {
//                 console.log('Validation passed - date is today or tomorrow');
//             }
//         }
        
//         // Check if lead exists
//         const visitData = await req.config.leads.findByPk(lead_id);
//         if (!visitData) return await responseError(req, res, "No visit found!");

//         // Get the last visit for the lead
//         const lastVisitArr = await req.config.leadVisit.findAll({
//             where: { lead_id: lead_id },
//             order: [["createdAt", "DESC"]],
//             limit: 1,
//         });
//         const lastVisit = lastVisitArr[0];
//         // Count total visits (including soft-deleted ones)
//         const visitCount = await req.config.leadVisit.count({ paranoid: false });

//         // If no previous visit, proceed to create a new visit
//         if (!lastVisit) {

//             const tokenResponse = await fetchAccessToken(req);

//             if (tokenResponse && tokenResponse.access_token) {

//                 let salesforceData_Leads = JSON.stringify({
//                     "Clead_Full_Name__c": visitData.lead_name || "",
//                     "Cell_Phone__c": visitData.p_contact_no || "0000000000",
//                     "CP_User_Name__c": req.user.user || "",
//                     "Email__c": visitData.email_id || "",
//                     "Pin_Code__c": visitData.pincode || "",
//                     "Location__c": visitData.address || "",
//                     "Requirement_Type__c": "Residential",
//                     "Country_pklst__c": "India",
//                     "Registration_Type_pklst__c": "Phone Call",
//                     "Selected_Project_rltn__c": visitData.sales_project_id || "",
//                     "Is_Created_By_Channel_Partner__c": "true"
//                 });

//                 // Configure Salesforce lead creation request
//                 const leadConfig = {
//                     method: 'post',
//                     maxBodyLength: Infinity,
//                     url: `${req.admin?.salesforce_url || process.env.CLIENT_REQ_URL}/sobjects/Clead__c`,
//                     headers: {
//                         'Content-Type': 'application/json',
//                         'Authorization': `Bearer ${tokenResponse.access_token}`,
//                     },
//                     data: salesforceData_Leads
//                 };

//                 // Create lead in Salesforce
//                 await axios.request(leadConfig)
//                     .then((response) => {
//                         sales_lead_id = response.data.id;

//                         visitData.update({ sales_lead_id: sales_lead_id }).then(async (leadData) => {
//                             console.log("Lead updated successfully", { sales_lead_id: sales_lead_id });
//                         }).catch((error) => {
//                             console.error("Error creating lead:", error);
//                             return responseError(req, res, "Something Went Wrong while creating the lead");
//                         });
//                     })

//                 const subtractedDate = subtractTime(`${p_visit_date}T${p_visit_time}Z`);
//                 const addedDate = addOneDay(subtractedDate);

//                 const salesforceData = JSON.stringify({
//                     "Subject__c": "Site Visit",
//                     "Visit_Type_pklst__c": "Site Visit",
//                     "Customer_Name__c": visitData.lead_name,
//                     "Phone_Number__c": visitData.p_contact_no,
//                     "StartDateTime__c": `${subtractedDate}`,
//                     "EndDateTime__c": `${addedDate}`,
//                     "Remarks__c": "",
//                     "CLeads__c": sales_lead_id,
//                 });

//                 console.log('salesforceData', salesforceData);

//                 const configLead = {
//                     method: 'post',
//                     maxBodyLength: Infinity,
//                     url: `${req.admin?.salesforce_url || process.env.CLIENT_REQ_URL}/sobjects/Event_Request__c`,
//                     headers: {
//                         'Content-Type': 'application/json',
//                         'Authorization': `Bearer ${tokenResponse.access_token}`,
//                     },
//                     data: salesforceData,
//                 };

//                 await axios
//                     .request(configLead)
//                     .then((response) => {
//                         sales_visit_id = response.data.id;

//                         // Insert the lead data into the database
//                         req.config.leadVisit
//                             .create({
//                                 lead_id,
//                                 p_visit_date,
//                                 p_visit_time,
//                                 sales_visit_id,
//                                 visit_code: `${req.admin?.user.charAt(0).toUpperCase()}${req.admin?.user_l_name ? req.admin?.user_l_name.charAt(0).toUpperCase() : ''}V_${zeroPad(visitCount + 1, 5)} `,
//                             })
//                             .then(async (visitData) => {
//                                 return await responseSuccess(req, res, "Visit created successfully", visitData);
//                             })
//                             .catch((error) => {
//                                 console.error("Error creating lead:", error);
//                                 return responseError(req, res, "Something went wrong while creating the lead");
//                             });
//                     })
//                     .catch((error) => {
//                         console.error("Error creating lead:", error);
//                         return responseError(req, res, "Something went wrong while creating the lead");
//                     });

//                 // After creating visit, update lead stage
//                 await visitData.update({ lead_stg_id: 2 });
//             } else {
//                 return await responseError(req, res, "Token generation failed", tokenResponse);
//             }
//         } else {
//             // Check if the last visit was completed within the last 90 days
//             if (lastVisit.status === 'Completed') {
//                 return await responseError(req, res, "Cannot request visit. Last visit completed within 90 days");
//             }

//             const createdAt = new Date(lastVisit.createdAt);
//             const expiryTime = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000); // Adds 24 hours in ms

//             const isWithin24Hours = expiryTime >= new Date();
//             const isNotCompleted = lastVisit.status !== 'Completed';

//             console.log("lastVisit.createdAt", lastVisit.createdAt);
//             console.log("expiryTime", expiryTime);
//             console.log("isWithin24Hours", isWithin24Hours);
//             console.log("isNotCompleted", isNotCompleted);

//             if (isNotCompleted && isWithin24Hours) {
//                 return await responseError(req, res, "Cannot request visit. Last visit requested within 24 hours");
//             }

//             // Create a new visit in the local database
//             // const newVisit = await req.config.leadVisit.create({
//             //     lead_id,
//             //     p_visit_date,
//             //     p_visit_time,
//             //     visit_code: `${req.admin?.user.charAt(0).toUpperCase()}${req.admin?.user_l_name ? req.admin?.user_l_name.charAt(0).toUpperCase() : ''}V_${zeroPad(visitCount + 1, 5)}`
//             // });

//             // After creating visit, update lead stage
//             await visitData.update({ lead_stg_id: 2 });

//             // const createVisitHistory = await req.config.revisitLeadsVisits.create({
//             //     visit_id: newVisit.visit_id,
//             //     revisit_date: p_visit_date,
//             //     revisit_time: p_visit_time,
//             //     lead_id: lead_id,
//             //     remarks
//             // })

//             const tokenResponse = await fetchAccessToken(req);

//             if (tokenResponse && tokenResponse.access_token) {

//                 const subtractedDate = subtractTime(`${p_visit_date}T${p_visit_time}Z`);
//                 const addedDate = addOneDay(subtractedDate);

//                 const salesforceData = JSON.stringify({
//                     "Subject__c": "Site Visit",
//                     "Visit_Type_pklst__c": "Site Visit",
//                     "Customer_Name__c": visitData.lead_name,
//                     "Phone_Number__c": visitData.p_contact_no,
//                     "StartDateTime__c": `${subtractedDate}`,
//                     "EndDateTime__c": `${addedDate}`,
//                     "Remarks__c": "",
//                     "CLeads__c": visitData.sales_lead_id,
//                 });

//                 console.log('salesforceData', salesforceData);

//                 const configLead = {
//                     method: 'post',
//                     maxBodyLength: Infinity,
//                     url: `${req.admin?.salesforce_url || process.env.CLIENT_REQ_URL}/sobjects/Event_Request__c`,
//                     headers: {
//                         'Content-Type': 'application/json',
//                         'Authorization': `Bearer ${tokenResponse.access_token}`,
//                     },
//                     data: salesforceData,
//                 };

//                 axios
//                     .request(configLead)
//                     .then((response) => {
//                         sales_visit_id = response.data.id;

//                         // Insert the lead data into the database
//                         req.config.leadVisit
//                             .create({
//                                 lead_id,
//                                 p_visit_date,
//                                 p_visit_time,
//                                 sales_visit_id,
//                                 visit_code: `${req.admin?.user.charAt(0).toUpperCase()}${req.admin?.user_l_name ? req.admin?.user_l_name.charAt(0).toUpperCase() : ''}V_${zeroPad(visitCount + 1, 5)} `,
//                             })
//                             .then(async (newVisit) => {
//                                 console.log("Visit created successfully", newVisit)
//                                 // After creating visit, update lead stage
//                                 await visitData.update({ lead_stg_id: 2 });

//                                 const createVisitHistory = await req.config.revisitLeadsVisits.create({
//                                     visit_id: newVisit.visit_id,
//                                     revisit_date: p_visit_date,
//                                     revisit_time: p_visit_time,
//                                     lead_id: lead_id,
//                                     remarks
//                                 })
//                             })
//                             .catch((error) => {
//                                 console.error("Something went wrong while creating the lead", error);
//                             });
//                     })
//                     .catch((error) => {
//                         console.error("Error creating lead:", error);
//                         return responseError(req, res, "Something went wrong while creating the lead");
//                     });

//             } else {
//                 return await responseError(req, res, "Token generation failed", tokenResponse);
//             }

//             return await responseSuccess(req, res, "Visit requested successfully");
//         }
//     } catch (error) {
//         logErrorToFile(error);
//         console.error("Error:", error);
//         return await responseError(req, res, "Something went wrong", error);
//     }
// };



exports.createLeadVisit = async (req, res) => {
    try {
        const { lead_id, p_visit_date, p_visit_time, remarks } = req.body;
        let sales_visit_id = '';
        let sales_lead_id;

        // Check admin role
        const isAdmin = req.user.role_id === 2 || req.user.role_id === 3;

        // Date validation for non-admin users
        if (!isAdmin) {
            const today = moment().startOf("day");
            const tomorrow = moment().add(1, "day").startOf("day");
            const visitDate = moment(p_visit_date, ["YYYY-MM-DD", "DD-MM-YYYY"], true).startOf("day");

            console.log("Date Validation Debug:");
            console.log("p_visit_date:", p_visit_date);
            console.log("today:", today.toISOString());
            console.log("tomorrow:", tomorrow.toISOString());
            console.log("visitDate:", visitDate.toISOString());

            const daysDiff = visitDate.diff(today, "days");
            console.log("daysDiff:", daysDiff);

            if (daysDiff !== 0 && daysDiff !== 1) {
                return await responseError(req, res, "Visit request can only be created for Today and Tomorrow");
            }
        }

        // Check if lead exists
        const visitData = await req.config.leads.findByPk(lead_id);
        if (!visitData) return await responseError(req, res, "No visit found!");

        // Get last visit
        const lastVisitArr = await req.config.leadVisit.findAll({
            where: { lead_id: lead_id },
            order: [["createdAt", "DESC"]],
            limit: 1,
        });
        const lastVisit = lastVisitArr[0];
        const visitCount = await req.config.leadVisit.count({ paranoid: false });

        // First visit case
        if (!lastVisit) {
            const tokenResponse = await fetchAccessToken(req);

            if (tokenResponse?.access_token) {
                const salesforceData_Leads = JSON.stringify({
                    "Clead_Full_Name__c": visitData.lead_name || "",
                    "Cell_Phone__c": visitData.p_contact_no || "0000000000",
                    "CP_User_Name__c": req.user.user || "",
                    "Email__c": visitData.email_id || "",
                    "Pin_Code__c": visitData.pincode || "",
                    "Location__c": visitData.address || "",
                    "Requirement_Type__c": "Residential",
                    "Country_pklst__c": "India",
                    "Registration_Type_pklst__c": "Phone Call",
                    "Selected_Project_rltn__c": visitData.sales_project_id || "",
                    "Is_Created_By_Channel_Partner__c": "true"
                });

                console.log("Lead Payload:", salesforceData_Leads);

                const leadConfig = {
                    method: 'post',
                    url: `${req.admin?.salesforce_url || process.env.CLIENT_REQ_URL}/sobjects/Clead__c`,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${tokenResponse.access_token}`,
                    },
                    data: salesforceData_Leads
                };

                try {
                    const response = await axios.request(leadConfig);
                    sales_lead_id = response.data.id;

                    await visitData.update({ sales_lead_id });
                    console.log("Lead updated successfully", { sales_lead_id });
                } catch (error) {
                    console.error("Salesforce Lead error:", error.response?.data || error.message);
                    return responseError(req, res, "Salesforce Lead creation failed");
                }

                // Visit creation in Salesforce
                const subtractedDate = subtractTime(`${p_visit_date}T${p_visit_time}Z`);
                const addedDate = addOneDay(subtractedDate);

                const salesforceData = JSON.stringify({
                    "Subject__c": "Site Visit",
                    "Visit_Type_pklst__c": "Site Visit",
                    "Customer_Name__c": visitData.lead_name,
                    "Phone_Number__c": visitData.p_contact_no,
                    "StartDateTime__c": subtractedDate,
                    "EndDateTime__c": addedDate,
                    "Remarks__c": remarks || "",
                    "CLeads__c": sales_lead_id,
                });

                console.log("Visit Payload:", salesforceData);

                const configLead = {
                    method: 'post',
                    url: `${req.admin?.salesforce_url || process.env.CLIENT_REQ_URL}/sobjects/Event_Request__c`,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${tokenResponse.access_token}`,
                    },
                    data: salesforceData,
                };

                try {
                    const response = await axios.request(configLead);
                    sales_visit_id = response.data.id;

                    const newVisit = await req.config.leadVisit.create({
                        lead_id,
                        p_visit_date,
                        p_visit_time,
                        sales_visit_id,
                        visit_code: `${req.admin?.user.charAt(0).toUpperCase()}${req.admin?.user_l_name ? req.admin?.user_l_name.charAt(0).toUpperCase() : ''}V_${zeroPad(visitCount + 1, 5)} `,
                    });

                    await visitData.update({ lead_stg_id: 2 });

                    return await responseSuccess(req, res, "Visit created successfully", newVisit);
                } catch (error) {
                    console.error("Salesforce Visit error:", error.response?.data || error.message);
                    return responseError(req, res, "Salesforce Visit creation failed");
                }
            } else {
                return await responseError(req, res, "Token generation failed", tokenResponse);
            }
        }

        // If last visit exists
        if (lastVisit.status === "Completed") {
            return await responseError(req, res, "Cannot request visit. Last visit completed within 90 days");
        }

        const createdAt = new Date(lastVisit.createdAt);
        const expiryTime = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
        const isWithin24Hours = expiryTime >= new Date();

        if (lastVisit.status !== "Completed" && isWithin24Hours) {
            return await responseError(req, res, "Cannot request visit. Last visit requested within 24 hours");
        }

        // Otherwise, proceed with new visit creation in Salesforce
        const tokenResponse = await fetchAccessToken(req);

        if (tokenResponse?.access_token) {
            const subtractedDate = subtractTime(`${p_visit_date}T${p_visit_time}Z`);
            const addedDate = addOneDay(subtractedDate);

            const salesforceData = JSON.stringify({
                "Subject__c": "Site Visit",
                "Visit_Type_pklst__c": "Site Visit",
                "Customer_Name__c": visitData.lead_name,
                "Phone_Number__c": visitData.p_contact_no,
                "StartDateTime__c": subtractedDate,
                "EndDateTime__c": addedDate,
                "Remarks__c": remarks || "",
                "CLeads__c": visitData.sales_lead_id,
            });

            console.log("Visit Payload:", salesforceData);

            const configLead = {
                method: 'post',
                url: `${req.admin?.salesforce_url || process.env.CLIENT_REQ_URL}/sobjects/Event_Request__c`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokenResponse.access_token}`,
                },
                data: salesforceData,
            };

            try {
                const response = await axios.request(configLead);
                sales_visit_id = response.data.id;

                const newVisit = await req.config.leadVisit.create({
                    lead_id,
                    p_visit_date,
                    p_visit_time,
                    sales_visit_id,
                    visit_code: `${req.admin?.user.charAt(0).toUpperCase()}${req.admin?.user_l_name ? req.admin?.user_l_name.charAt(0).toUpperCase() : ''}V_${zeroPad(visitCount + 1, 5)} `,
                });

                await visitData.update({ lead_stg_id: 2 });

                await req.config.revisitLeadsVisits.create({
                    visit_id: newVisit.visit_id,
                    revisit_date: p_visit_date,
                    revisit_time: p_visit_time,
                    lead_id,
                    remarks,
                });

                return await responseSuccess(req, res, "Visit requested successfully", newVisit);
            } catch (error) {
                console.error("Salesforce Visit error:", error.response?.data || error.message);
                return responseError(req, res, "Salesforce Visit creation failed");
            }
        } else {
            return await responseError(req, res, "Token generation failed", tokenResponse);
        }
    } catch (error) {
        logErrorToFile(error);
        console.error("Error:", error);
        return await responseError(req, res, "Something went wrong", error);
    }
};

async function updateVisitStatuses(req, visitData = [], currentDateTime) {
    const visitIdsToUpdate = Array.isArray(visitData) ?
        visitData.filter(visit => {
            const visitDateTime = moment(`${visit.p_visit_date} ${visit.p_visit_time}`);
            return currentDateTime.isAfter(visitDateTime) && visit.status !== 'Completed';
        })
            .map(visit => visit.visit_id)
        : [];

    if (visitIdsToUpdate.length > 0) {
        // Perform the bulk update
        await req.config.leadVisit.update(
            { status: 'VISIT NOT DONE' },
            { where: { visit_id: { [Op.in]: visitIdsToUpdate } } }
        );
    }

    // Fetch and return all rows
    // const updatedData = await req.config.leadVisit.findAll();

    // return updatedData;
}
exports.getleadsVisit = async (req, res) => {
    try {
        let visitData;
        let whereClause = {};
        let whereAdminClause = {};
        let owner = {}
        let statusClause = {}
        if (req.query.cp_id) {
            owner = { lead_owner: decodeURIComponent(req.query.cp_id) }
        }
        if (req.query.status_id) {
            statusClause.status = decodeURIComponent(req.query.status_id)
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
            whereAdminClause.assigned_lead = req.user.user_id
        }
        if (!req.query.visit_id) {

            if (req.user.role_id === 2) {
                visitData = await req.config.leadVisit.findAll({
                    where: {
                        ...whereClause, ...statusClause,
                    },
                    include: [
                        {
                            model: req.config.leads,
                            as: 'leadData',
                            where: {
                                ...whereAdminClause
                            },
                            attributes: {
                                exclude: ["createdAt", "updatedAt", "deletedAt"],
                            },

                            include: [
                                {
                                    model: req.config.users, paranoid: false,
                                    as: 'leadOwner',
                                    // where: { ...owner },
                                    where: {
                                        report_to: req.user.user_id
                                    },
                                    attributes: {
                                        exclude: ["createdAt", "updatedAt", "deletedAt"],
                                    },
                                    required: true
                                },

                            ],
                            required: true,
                        },

                    ],
                    order: [["visit_id", "DESC"]],
                })
            }
            // Role 3 (BST Head): Recursively find all users under this BST head and fetch leads assigned to those users.
            else if (req.user.role_id === 3) {
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

                // Fetch all users under the current BST Head
                const bstUsers = await req.config.sequelize.query(getUserHierarchyQuery, {
                    replacements: { user_id: req.user.user_id },
                    type: QueryTypes.SELECT
                });

                const userIds = bstUsers.map(user => user.user_id); // Extract user IDs
                // Now fetch all lead visits assigned to those users (BST head and users under them)
                visitData = await req.config.leadVisit.findAll({
                    where: { ...whereClause, ...statusClause },
                    include: [
                        {
                            model: req.config.leads,
                            as: 'leadData',
                            where: {
                                assigned_lead: { [Op.in]: userIds } // Fetch leads assigned to all BST and channel partner users
                            },
                            attributes: {
                                exclude: ["createdAt", "updatedAt", "deletedAt"]
                            },
                            include: [
                                {
                                    model: req.config.users,
                                    paranoid: false,
                                    as: 'leadOwner',
                                    where: { ...owner },
                                    attributes: {
                                        exclude: ["createdAt", "updatedAt", "deletedAt"]
                                    },
                                    required: true
                                }
                            ],
                            required: true
                        }
                    ],
                    order: [["visit_id", "DESC"]]
                });
            } else {
                visitData = await req.config.leadVisit.findAll({
                    where: {
                        ...whereClause, ...statusClause
                    },
                    include: [
                        {
                            model: req.config.leads,
                            as: 'leadData',
                            where: { ...whereAdminClause, ...owner },
                            attributes: {
                                exclude: ["createdAt", "updatedAt", "deletedAt"],
                            },
                            include: [
                                {
                                    model: req.config.users,
                                    paranoid: false,
                                    as: 'leadOwner',
                                    where: { ...owner },
                                    attributes: {
                                        exclude: ["createdAt", "updatedAt", "deletedAt"]
                                    },
                                    required: true
                                }
                            ],
                            required: true,
                        },
                    ],
                    order: [["visit_id", "DESC"]],
                })
            }

        } else {
            visitData = await req.config.leadVisit.findByPk(req.query.visit_id, {
                include: [
                    {
                        model: req.config.leads,
                        as: 'leadData',
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "deletedAt"],
                        },

                        include: [
                            {
                                model: req.config.channelProject,
                                as: 'projectData',
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
                            },
                        ]
                    },

                ],
            })
        }
        const currentDateTime = moment();
        await updateVisitStatuses(req, visitData, currentDateTime);

        return await responseSuccess(req, res, "Visit data list", visitData);

    } catch (error) {
        logErrorToFile(error)
        console.log("error", error)
        return await responseError(req, res, "leadList fetching failed", error)
    }
}

exports.editleadsVisit = async (req, res) => {
    try {

        let { visit_id, p_visit_date, p_visit_time, lead_id } = req.body
        let body = req.body

        // Date validation: Admin users can book for any date, others only for current date or next calendar date
        if (p_visit_date) {
            const isAdmin = req.user.role_id === 2 || req.user.role_id === 3;
            
            if (!isAdmin) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                
                const visitDate = new Date(p_visit_date);
                visitDate.setHours(0, 0, 0, 0);
                
                // Debug logging
                console.log('Date Validation Debug:');
                console.log('p_visit_date:', p_visit_date);
                console.log('today:', today.toISOString());
                console.log('tomorrow:', tomorrow.toISOString());
                console.log('visitDate:', visitDate.toISOString());
                
                // Check if visit date is valid (today or tomorrow only for non-admin users)
                const daysDiff = Math.floor((visitDate - today) / (1000 * 60 * 60 * 24));
                
                console.log('daysDiff:', daysDiff);
                console.log('User role_id:', req.user.role_id);
                console.log('Is admin:', isAdmin);
                
                if (daysDiff !== 0 && daysDiff !== 1) {
                    console.log('Validation failed - date not today or tomorrow');
                    return await responseError(req, res, "Visit request can only be created for the current date or the next calendar date");
                } else {
                    console.log('Validation passed - date is today or tomorrow');
                }
            }
        }

        let visitData = await req.config.leadVisit.findByPk(visit_id)
        if (!visitData) return await responseError(req, res, "no visit existed")

        let visitDuplicateData = await req.config.leadVisit.findOne({
            where: {
                visit_id: { [Op.ne]: visit_id },
                lead_id: lead_id,
                p_visit_date,
                p_visit_time,
            }
        })
        if (visitDuplicateData) return await responseError(req, res, "lead visit request already existed with this date and time")

        await visitData.update(body)
        return await responseSuccess(req, res, "visit updated")

    } catch (error) {
        logErrorToFile(error)
        return await responseError(req, res, "visit updated failed")
    }
}

exports.deleteVisit = async (req, res) => {
    try {

        let { visit_id } = req.query
        let visitData = await req.config.leadVisit.findOne({
            where: {
                visit_id
            }
        })

        if (!visitData) return await responseError(req, res, "visit does not existed")
        await visitData.destroy()
        return await responseSuccess(req, res, "visit deleted")

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "visit deletion failed")
    }
}

exports.getRevisitHistory = async (req, res) => {
    try {
        let { visit_id } = req.query
        let visitData = await req.config.leadVisit.findOne({
            where: {
                visit_id: visit_id
            }
        })

        if (!visitData) {
            return await responseError(req, res, "Visit does not existed")
        }

        let revisitHistory = await req.config.revisitLeadsVisits.findAll({
            where: {
                visit_id: visit_id
            }
        })
        if (revisitHistory.length <= 0) {
            return await responseSuccess(req, res, "No Revist History Fetched Successfully", revisitHistory)
        }
        return await responseSuccess(req, res, "Revist History Fetched Successfully", revisitHistory)

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}