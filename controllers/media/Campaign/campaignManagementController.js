const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const { responseError, responseSuccess, getEstimateCode } = require("../../../helper/responce");
const fileUpload = require("../../../common/imageExport");
const sendEmail = require("../../../common/mailer");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

exports.addCampaign = async (req, res) => {
    try {
        let body = req.body
        console.log(req.body)
        body.campaign_code = await getEstimateCode(req, 'campaign')
        let proof_attachment = "";

        if (req.files && req.files.proof_attachment) {
            proof_attachment = await fileUpload.imageExport(req, res, "supportDoc", "proof_attachment");
            body.proof_attachment = proof_attachment;
        }
        // if (body.s_o_po_date.toLowerCase() == 'invalid date') {
        //     delete body.s_o_po_date
        // }
        const campaignData = await req.config.mediaCampaignManagement.create(body)
        
        // Send email notifications to CP and BST users
        try {
            console.log('Starting campaign email notification process...');
            await sendCampaignNotificationEmails(req, body, campaignData);
            console.log('Campaign email notification process completed');
        } catch (emailError) {
            console.error('Campaign Email Notification Error:', emailError);
            console.error('Error stack:', emailError.stack);
            // Don't fail the campaign creation if email fails
        }

        // Send WhatsApp notifications to all CP users
        try {
            console.log('Starting campaign WhatsApp notification process...');
            await sendCampaignWhatsAppNotifications(req, body, campaignData);
            console.log('Campaign WhatsApp notification process completed');
        } catch (whatsappError) {
            console.error('Campaign WhatsApp Notification Error:', whatsappError);
            console.error('Error stack:', whatsappError.stack);
            // Don't fail the campaign creation if WhatsApp fails
        }

        return await responseSuccess(req, res, "Campaign Added Succesfully")

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

// Function to send campaign notification emails to CP and BST users
const sendCampaignNotificationEmails = async (req, campaignBody, campaignData) => {
    try {
        // Fetch company name
        let company_name = 'Srijan Bandhan';
        let company = await req.config.organisationInfo.findOne({
            attributes: ['company_name']
        });
        if (company) {
            company_name = company.company_name || 'Srijan Bandhan';
        }

        // Fetch email template from file (campaignCreation.html)
        // Priority: File template (to ensure correct campaign template is used)
        let htmlTemplate = null;
        
        // Path: controllers/media/Campaign -> controllers/media -> controllers -> root -> mail/cp/
        const htmlTemplatePath = path.join(
            __dirname,
            "..",
            "..",
            "..",
            "mail",
            "cp",
            "campaignCreation.html"
        );
        
        try {
            // Check if file exists first
            if (fs.existsSync(htmlTemplatePath)) {
                htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");
                console.log('✅ Campaign email template loaded from file:', htmlTemplatePath);
            } else {
                console.log('⚠️ Campaign email template file not found at:', htmlTemplatePath);
                throw new Error('Template file not found');
            }
        } catch (fileError) {
            console.log('❌ Error reading campaign email template file, trying database...', fileError.message);
            
            // Fallback: Try database template (template_id: 18)
            try {
                const emailTemplate = await req.config.emailTemplates.findOne({ 
                    where: { template_id: 18 } // Campaign Creation Template ID
                });
                if (emailTemplate && emailTemplate.template) {
                    // Validate that it's actually a campaign template, not opportunity template
                    const templateContent = emailTemplate.template.toLowerCase();
                    if (templateContent.includes('campaign') && !templateContent.includes('opportunity')) {
                        htmlTemplate = emailTemplate.template;
                        console.log('✅ Campaign email template loaded from database (template_id: 18)');
                    } else {
                        console.log('⚠️ Database template (template_id: 18) appears to be for Opportunity, not Campaign. Using fallback template.');
                        htmlTemplate = null;
                    }
                } else {
                    console.log('⚠️ No template found in database with template_id: 18');
                }
            } catch (templateError) {
                console.log('❌ Error fetching email template from DB:', templateError.message);
            }
        }

        // Final fallback: Use simple template if file and DB both fail
        if (!htmlTemplate) {
            console.log('Using fallback campaign email template');
            htmlTemplate = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: Arial, sans-serif; background-color: #f6f6f6; padding: 20px; }
                        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; }
                        .header { background-color: #2E86C1; color: #ffffff; padding: 15px; text-align: center; }
                        .body { padding: 20px; color: #333333; }
                        .footer { text-align: center; font-size: 12px; color: #888888; padding: 10px; border-top: 1px solid #dddddd; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>New Campaign Uploaded</h1>
                        </div>
                        <div class="body">
                            <p>Dear {{UserName}},</p>
                            <p>A new campaign has been uploaded with campaign name <strong>{{CampaignName}}</strong> and campaign code <strong>{{CampaignId}}</strong>.</p>
                            <p>Please review the campaign details in your dashboard.</p>
                            <p>Sincerely,<br>{{CompanyName}} Team</p>
                        </div>
                        <div class="footer">
                            <p>© 2026 {{CompanyName}}. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `;
        }

        // Fetch all active CP users (role_id = 1)
        const cpUsers = await req.config.users.findAll({
            where: {
                role_id: 1, // Channel Partner role
                user_status: true,
                deletedAt: null
            },
            attributes: ['user_id', 'user', 'email']
        });

        console.log(`Found ${cpUsers.length} CP users`);

        // Fetch all active BST users (role_id = 2)
        const bstUsers = await req.config.users.findAll({
            where: {
                role_id: 2, // BST role
                user_status: true,
                deletedAt: null
            },
            attributes: ['user_id', 'user', 'email']
        });

        console.log(`Found ${bstUsers.length} BST users`);

        // Combine CP and BST users
        const allUsers = [...cpUsers, ...bstUsers];

        if (allUsers.length === 0) {
            console.log('No CP or BST users found to send campaign notification emails');
            return;
        }

        console.log(`Total users to notify: ${allUsers.length}`);

        // Fetch email configuration
        const emailConfig = await req.config.emailConfig.findAll();
        const emailConfigObj = emailConfig.length > 0 ? {
            host: emailConfig[0].host,
            port: emailConfig[0].port,
            user: emailConfig[0].user,
            pass: emailConfig[0].password,
            from: emailConfig[0].from,
        } : {};

        if (emailConfig.length === 0) {
            console.log('⚠️ No email configuration found. Using default email settings.');
        } else {
            console.log(`✅ Email configuration found: ${emailConfig[0].host}:${emailConfig[0].port}`);
        }

        // Send email to each user
        const campaignName = campaignBody.campaign_name || 'New Campaign';
        const campaignId = campaignData.campaign_code || campaignData.campaign_id;
        
        console.log(`Sending emails for campaign: ${campaignName} (Code: ${campaignId})`);

        for (const user of allUsers) {
            if (!user.email) {
                console.log(`No email found for user ${user.user} (ID: ${user.user_id})`);
                continue;
            }

            try {
                // Replace template variables
                let htmlContent = htmlTemplate
                    .replace(/{{UserName}}/g, user.user || 'User')
                    .replace(/{{CampaignName}}/g, campaignName || 'New Campaign')
                    .replace(/{{CampaignId}}/g, campaignId || 'N/A')
                    .replace(/{{CompanyName}}/g, company_name);

                // Debug: Log template usage (first user only to avoid spam)
                if (user.user_id === allUsers[0].user_id) {
                    console.log(`Using campaign template. Campaign: ${campaignName}, Code: ${campaignId}`);
                    console.log(`Template contains Campaign: ${htmlContent.toLowerCase().includes('campaign')}`);
                    console.log(`Template contains Opportunity: ${htmlContent.toLowerCase().includes('opportunity')}`);
                }

                const emailOptions = {
                    email: user.email,
                    subject: "New Campaign Uploaded",
                    message: htmlContent,
                    ...emailConfigObj
                };

                await sendEmail(emailOptions);
                console.log(`✅ Campaign notification email sent successfully to ${user.email}`);
            } catch (userEmailError) {
                console.error(`❌ Error sending email to ${user.email}:`, userEmailError);
                console.error(`Error details:`, userEmailError.message);
                // Continue with other users even if one fails
            }
        }

        const usersWithEmails = allUsers.filter(u => u.email).length;
        console.log(`Campaign notification process completed. Attempted to send emails to ${usersWithEmails} users (${cpUsers.length} CP users, ${bstUsers.length} BST users)`);
    } catch (error) {
        console.log('Error in sendCampaignNotificationEmails:', error);
        throw error;
    }
}

// Function to send WhatsApp notifications to all CP users when campaign is uploaded
const sendCampaignWhatsAppNotifications = async (req, campaignBody, campaignData) => {
    try {
        const chat360ApiKey = process.env.CHAT360_API_KEY || 'Gvz6Cyws.gIUKcR9yUQTGY7sMKQkYgaHyxTO800ok';
        const chat360ClientNumber = process.env.CHAT360_CLIENT_NUMBER || '916293761990';
        const chat360Endpoint = process.env.CHAT360_ENDPOINT || 'https://app.chat360.io/service/v2/task';
        
        // Fetch all active CP users (role_id = 1) with contact numbers
        const cpUsers = await req.config.users.findAll({
            where: {
                role_id: 1, // Channel Partner role
                user_status: true,
                deletedAt: null,
                contact_number: {
                    [Op.ne]: null,
                    [Op.ne]: ''
                }
            },
            attributes: ['user_id', 'user', 'contact_number']
        });

        console.log(`Found ${cpUsers.length} CP users with contact numbers`);

        if (cpUsers.length === 0) {
            console.log('No CP users with contact numbers found to send WhatsApp notifications');
            return;
        }

        // Extract project name from campaign data
        // Priority: 1. project_name from body, 2. campaign_name, 3. account name (if acc_id exists), 4. default
        let projectName = campaignBody.project_name || campaignBody.campaign_name || null;
        
        // If no project name in body and campaign has acc_id, try to get account name
        if (!projectName && campaignData.acc_id) {
            try {
                const account = await req.config.accounts.findOne({
                    where: { acc_id: campaignData.acc_id },
                    attributes: ['acc_name']
                });
                if (account && account.acc_name) {
                    projectName = account.acc_name;
                    console.log(`Using account name as project name: ${projectName}`);
                }
            } catch (accountError) {
                console.log('Could not fetch account name:', accountError.message);
            }
        }
        
        // Final fallback
        if (!projectName || projectName === 'project_name' || projectName.trim() === '') {
            projectName = campaignBody.campaign_name || 'New Campaign';
        }
        
        const campaignId = campaignData.campaign_code || campaignData.campaign_id || 'N/A';

        console.log(`Sending WhatsApp notifications for campaign: ${projectName} (Code: ${campaignId})`);
        console.log(`Project name extracted: ${projectName}`, {
            from_body_project_name: campaignBody.project_name,
            from_body_campaign_name: campaignBody.campaign_name,
            from_account: campaignData.acc_id ? 'fetched from account' : 'no account'
        });

        // Prepare task body array for batch sending
        const taskBody = [];

        for (const user of cpUsers) {
            try {
                // Format phone number: Extract country code and number
                let phoneNumber = String(user.contact_number || '').trim();
                
                // Remove any non-digit characters except +
                phoneNumber = phoneNumber.replace(/[^\d+]/g, '');
                
                // Extract country code and number
                let countryCode = '+91'; // Default to India
                let receiverNumber = phoneNumber;
                
                // If number starts with +, extract country code
                if (phoneNumber.startsWith('+')) {
                    // Extract country code (assuming 2-3 digits after +)
                    const match = phoneNumber.match(/^\+(\d{1,3})(\d+)$/);
                    if (match) {
                        countryCode = '+' + match[1];
                        receiverNumber = match[2];
                    } else {
                        // If no match, assume +91 and remove it
                        if (phoneNumber.startsWith('+91')) {
                            countryCode = '+91';
                            receiverNumber = phoneNumber.substring(3);
                        } else {
                            receiverNumber = phoneNumber.substring(1);
                        }
                    }
                } else if (phoneNumber.length === 10) {
                    // 10 digit number, assume India (+91)
                    countryCode = '+91';
                    receiverNumber = phoneNumber;
                } else if (phoneNumber.length > 10) {
                    // Number with country code but no +
                    // Assume first 2 digits are country code for India
                    if (phoneNumber.startsWith('91') && phoneNumber.length === 12) {
                        countryCode = '+91';
                        receiverNumber = phoneNumber.substring(2);
                    } else {
                        // Take last 10 digits as number
                        receiverNumber = phoneNumber.slice(-10);
                    }
                }

                // Remove leading 0 if present
                if (receiverNumber.startsWith('0')) {
                    receiverNumber = receiverNumber.substring(1);
                }

                // Validate receiver number
                if (!receiverNumber || receiverNumber.length < 10) {
                    console.log(`⚠️ Invalid phone number for user ${user.user} (ID: ${user.user_id}): ${user.contact_number}`);
                    continue;
                }

                // Add to task body
                taskBody.push({
                    client_number: chat360ClientNumber,
                    receiver_number: receiverNumber,
                    country_code: countryCode,
                    template_data: {
                        param_data: {
                            project_name: projectName  // Use the extracted project name
                        },
                        template_title: "channlepartner_communication",
                        template_code: "en",
                        button_param_data: {}
                    }
                });

                console.log(`✅ Prepared WhatsApp notification for ${user.user} (${countryCode}${receiverNumber})`);

            } catch (userError) {
                console.error(`❌ Error processing user ${user.user} (ID: ${user.user_id}):`, userError);
                // Continue with other users
            }
        }

        if (taskBody.length === 0) {
            console.log('No valid phone numbers found to send WhatsApp notifications');
            return;
        }

        // Chat360 API expects only a single receiver number per request ("Only single number is allowed.")
        // So we send one API request per CP user instead of batching all in one call.
        console.log(`Sending WhatsApp notifications to ${taskBody.length} CP users via Chat360 (one request per user)...`);

        let successCount = 0;
        let failureCount = 0;

        for (const task of taskBody) {
            const requestPayload = {
                task_name: "whatsapp_push_notification",
                extra: "",
                task_body: [task] // Single receiver per request as per Chat360 API restriction
            };

            try {
                const response = await axios.post(chat360Endpoint, requestPayload, {
                    headers: {
                        'Authorization': `Api-Key ${chat360ApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000 // 30 seconds timeout
                });

                console.log(`✅ WhatsApp notification sent successfully to ${task.receiver_number}. Response:`, response.status, response.statusText);
                successCount++;
            } catch (apiError) {
                failureCount++;
                console.error(`❌ Error calling Chat360 API for ${task.receiver_number}:`, apiError.message);
                if (apiError.response) {
                    console.error('API Response:', apiError.response.data);
                    console.error('API Status:', apiError.response.status);
                }
                // Continue with next user; do not throw here
            }
        }

        console.log(`📱 WhatsApp notification summary for campaign "${projectName}": success=${successCount}, failed=${failureCount}, total=${taskBody.length}`);

    } catch (error) {
        console.log('Error in sendCampaignWhatsAppNotifications:', error);
        throw error;
    }
}

exports.getCampaign = async (req, res) => {
    try {
        const { campaign_id } = req.query;
        let data;
        let query = {
            attributes: {
            },
            include: [
                { model: req.config.accounts, paranoid: false },
                { model: req.config.campaignStatus, paranoid: false },
                { model: req.config.campaignProof, paranoid: false },
                { model: req.config.campaignBusinessType, paranoid: false },
            ],
            order: [
                ['campaign_id', 'DESC']
            ]
        };

        if (campaign_id) {
            query.where = { campaign_id: campaign_id };
            data = await req.config.mediaCampaignManagement.findOne(query);
        } else {
            data = await req.config.mediaCampaignManagement.findAll(query);
        }

        return await responseSuccess(req, res, "Campaign Management Fetched Successfully", data);
    } catch (error) {
        logErrorToFile(error);
        console.log(error);
        return await responseError(req, res, "Something Went Wrong");
    }
};

exports.updateCampaign = async (req, res) => {
    try {
        const { campaign_id } = req.body
        let data = req.body
        let proof_attachment = "";

        if (req.files && req.files.proof_attachment) {
            proof_attachment = await fileUpload.imageExport(req, res, "supportDoc", "proof_attachment");
            data.proof_attachment = proof_attachment;
        }

        let campaign = await req.config.mediaCampaignManagement.findOne({ where: { campaign_id: campaign_id } })

        if (!campaign) {
            return await responseError(req, res, "The Campaign does not exist.")
        }

        await campaign.update(data)
        return await responseSuccess(req, res, "Campaign Updated Succesfully")

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.deleteCampaign = async (req, res) => {
    try {
        let { campaign_id } = req.query

        let data = await req.config.mediaCampaignManagement.findOne({ where: { campaign_id: campaign_id } })

        if (!data) {
            return await responseError(req, res, "The Campaign does not exist.")
        }
        await data.destroy()
        return await responseSuccess(req, res, "Campaign Deleted Succesfully")

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.uploadPOPdf = async (req, res) => {
    try {
        const { campaign_id } = req.body

        if (req.files && req.files.pdf) {
            req.body.sales_order_pdf = await fileUpload.imageExport(req, res, "supportDoc", "pdf");
        }

        const estimation = await req.config.estimations.findOne({ where: { campaign_id: campaign_id } })

        const data = await req.config.mediaCampaignManagement.findOne({ where: { campaign_id: campaign_id } })

        if (!data) {
            return await responseError(req, res, "The Campaign does not exist.")
        }

        req.body.last_modified_by = req.user.user_code
        if (req.body.campaign_id) {
            delete req.body.campaign_id
        }
        await estimation.update(req.body)
        await data.update(req.body)
        return await responseSuccess(req, res, "Purchase Order Uploaded Succesfully")

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}