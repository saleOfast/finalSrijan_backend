const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const { responseError, responseSuccess, getEstimateCode } = require("../../../helper/responce");
const fileUpload = require("../../../common/imageExport");
const sendEmail = require("../../../common/mailer");
const fs = require("fs");
const path = require("path");

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
            await sendCampaignNotificationEmails(req, body, campaignData);
        } catch (emailError) {
            console.log('Campaign Email Notification Error:', emailError);
            // Don't fail the campaign creation if email fails
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
        let company_name = 'NK Realtors';
        let company = await req.config.organisationInfo.findOne({
            attributes: ['company_name']
        });
        if (company) {
            company_name = company.company_name || 'NK Realtors';
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
                            <p>© 2024 {{CompanyName}}. All rights reserved.</p>
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

        // Fetch all active BST users (role_id = 2)
        const bstUsers = await req.config.users.findAll({
            where: {
                role_id: 2, // BST role
                user_status: true,
                deletedAt: null
            },
            attributes: ['user_id', 'user', 'email']
        });

        // Combine CP and BST users
        const allUsers = [...cpUsers, ...bstUsers];

        if (allUsers.length === 0) {
            console.log('No CP or BST users found to send campaign notification emails');
            return;
        }

        // Fetch email configuration
        const emailConfig = await req.config.emailConfig.findAll();
        const emailConfigObj = emailConfig.length > 0 ? {
            host: emailConfig[0].host,
            port: emailConfig[0].port,
            user: emailConfig[0].user,
            pass: emailConfig[0].password,
            from: emailConfig[0].from,
        } : {};

        // Send email to each user
        const campaignName = campaignBody.campaign_name || 'New Campaign';
        const campaignId = campaignData.campaign_code || campaignData.campaign_id;

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
                console.log(`Campaign notification email sent to ${user.email}`);
            } catch (userEmailError) {
                console.log(`Error sending email to ${user.email}:`, userEmailError);
                // Continue with other users even if one fails
            }
        }

        console.log(`Campaign notification emails sent to ${allUsers.length} users (${cpUsers.length} CP users, ${bstUsers.length} BST users)`);
    } catch (error) {
        console.log('Error in sendCampaignNotificationEmails:', error);
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