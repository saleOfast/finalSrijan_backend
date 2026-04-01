const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const { responseError, responseSuccess } = require('../../helper/responce');
const fileUpload = require("../../common/imageExport");
const sendEmail = require("../../common/mailer");
var fs = require("fs");
const path = require("path");

// Helper: send notification email to all CP and BST users when a new project is created
const sendProjectNotificationEmails = async (req, projectData) => {
    try {
        // Fetch company name
        let company_name = 'Srijan Bandhan';
        const company = await req.config.organisationInfo.findOne({
            attributes: ['company_name']
        });
        if (company) {
            company_name = company.company_name || 'Srijan Bandhan';
        }

        // Try to load campaignCreation.html as a generic "project/campaign" template
        let htmlTemplate = null;
        const htmlTemplatePath = path.join(
            __dirname,
            "..",
            "..",
            "mail",
            "cp",
            "campaignCreation.html"
        );

        try {
            if (fs.existsSync(htmlTemplatePath)) {
                htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");
            }
        } catch (e) {
            console.log("Error reading project notification template:", e.message);
        }

        // Fallback simple template if file not found
        if (!htmlTemplate) {
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
                            <h1>New Project Uploaded</h1>
                        </div>
                        <div class="body">
                            <p>Dear {{UserName}},</p>
                            <p>A new project has been uploaded with project name <strong>{{ProjectName}}</strong>.</p>
                            <p>Please review the project details in your dashboard.</p>
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

        // Fetch all active CP users (role_id = 1) who are fully onboarded (doc_verification == 2)
        const cpUsers = await req.config.users.findAll({
            where: {
                role_id: 1,
                user_status: true,
                deletedAt: null,
                doc_verification: 2
            },
            attributes: ['user_id', 'user', 'email']
        });

        // Fetch all active BST users (role_id = 2)
        const bstUsers = await req.config.users.findAll({
            where: {
                role_id: 2,
                user_status: true,
                deletedAt: null
            },
            attributes: ['user_id', 'user', 'email']
        });

        const allUsers = [...cpUsers, ...bstUsers];
        if (allUsers.length === 0) {
            return;
        }

        const projectName = projectData.project || projectData.project_name || 'New Project';

        for (const user of allUsers) {
            if (!user.email) continue;

            try {
                let htmlContent = htmlTemplate
                    .replace(/{{UserName}}/g, user.user || 'User')
                    .replace(/{{ProjectName}}/g, projectName)
                    // for campaignCreation.html compatibility
                    .replace(/{{CampaignName}}/g, projectName)
                    .replace(/{{CampaignId}}/g, projectData.project_id ? String(projectData.project_id) : 'N/A')
                    .replace(/{{CompanyName}}/g, company_name);

                const emailOptions = {
                    email: user.email,
                    subject: "New Project Uploaded",
                    message: htmlContent,
                };

                await sendEmail(emailOptions);
            } catch (err) {
                console.error(`Error sending project notification email to ${user.email}:`, err.message);
            }
        }
    } catch (err) {
        console.error("Error in sendProjectNotificationEmails:", err.message);
    }
};

// for admin
exports.storeChannelProject = async(req, res) => {
    try {
        let {project} = req.body
        let projectData;

        projectData = await req.config.channelProject.findOne({where:{project:project
        }})

        if(projectData) return await responseError(req, res, "project name already exist")

        let body = {...req.body, status:true, created_by: req.user.user_id}

        if (req.files && req.files.file) {
            req.body._imageName = 0
            let cover_image =  await fileUpload.imageExport(req, res, "project");
            body.cover_image = cover_image;
        }

        if (req.files && req.files.logo) {
            req.body._imageName = 0
            let logo_image =  await fileUpload.imageExport(req, res, "projectLogo", "logo");
            body.logo_image = logo_image;
        }

        if (req.files && req.files.template) {
            req.body._imageName = 0
            let html_file =  await fileUpload.imageExport(req, res, "projectHtml", "template");
            body.html_file = html_file;
        }

        delete body.project_id
        console.log("body",body)

        projectData =  await req.config.channelProject.create(body)

        // After creating the project, notify all CP and BST users (similar to campaign upload)
        try {
            await sendProjectNotificationEmails(req, projectData);
        } catch (notifyErr) {
            console.error("Project notification email error:", notifyErr.message);
        }

        return await responseSuccess(req, res, "project created Succesfully", projectData )
       
    } catch (error) {
    logErrorToFile(error)
        console.log(error, "error")
        return await responseError(req, res, "Something Went Wrong")
    }
}

// for admin
exports.storeUserChannelTemplate = async(req, res) => {
    try {
        const {project_id, contact_no} = req.body
        let projectData;

        projectData = await req.config.userProjectModel.findOne(
            {where:{project_id, created_by: req.user.user_id}}
        )

        let projectMainData = await req.config.channelProject.findByPk(project_id)

        let newData = {...projectMainData.dataValues}
        delete newData.logo_image
        
        let body = {...projectMainData.dataValues, status:true, created_by: req.user.user_id, contact_no: contact_no}
        if (req.files && req.files.logo) {
            req.body._imageName = projectData?.logo_image || 0
            let logo_image =  await fileUpload.imageExport(req, res, "projectLogo", 'logo');
            body.logo_image = logo_image;
        }

      

        if(projectData) {
            if (req.body.logo_preview === 'null') {
                req.body._imageName = projectData.logo_image || 0
                await fileUpload.deleteImage(req, res, "projectHtml", 'logo');
                body.logo_image = null; 
            }
            await projectData.update(body)
            return await responseSuccess(req, res, "project template updation success", projectData)
        }else{
            projectData = await req.config.userProjectModel.create(body)
            return await responseSuccess(req, res, "project template creation successfull", projectData)
        }
       
    } catch (error) {
    logErrorToFile(error)
        console.log(error, "error")
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.getChannelProject = async(req, res) =>{
    try {
        let projectData ;
        if(req.query.project_id){
            if(req.user.isDB){
                projectData = await req.config.channelProject.findByPk(req.query.project_id)
            }else{
                projectData = await req.config.userProjectModel.findOne({
                    where: {project_id: req.query.project_id, created_by: req.user.user_id}
                })
                if(!projectData){
                    projectData = await req.config.channelProject.findByPk(req.query.project_id)
                }
            }
            let htmlTemplate = ''
            if(projectData.html_file) {
                const htmlTemplatePath  = path.resolve(
                    __dirname,
                    `../../uploads/projectHtml/images${projectData.html_file}`
                  );
                // htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");
                if (fs.existsSync(htmlTemplatePath)) {
                    htmlTemplate = fs.readFileSync(htmlTemplatePath, 'utf-8');
                  } else {
                    console.warn(`HTML file not found: ${htmlTemplatePath}`);
                  }
            }
            
            return await responseSuccess(req, res, "project Data", {projectData, htmlTemplate})
        }else{
            projectData = await req.config.channelProject.findAll({ })
            return await responseSuccess(req, res, "project list", projectData)
        }
       
       
    } catch (error) {
    logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.editChannelProject = async(req, res) =>{
    try {

        let {project , project_id} = req.body
        let body = req.body

        let CurrentProjectData = await req.config.channelProject.findByPk(project_id)
        if(!CurrentProjectData) return await responseError(req, res, "project not found") 

        if(project) {
            let projectData = await req.config.channelProject.findOne({
                where:{
                    project_id: {[Op.ne]: project_id},
                    project: project
                }
            })
            if(projectData) return await responseError(req, res, "project name already existed") 
        }

        if (req.files && req.files.file) {
            req.body._imageName = CurrentProjectData.cover_image || 0
            let cover_image =  await fileUpload.imageExport(req, res, "project");
            body.cover_image = cover_image;
        }

        if (req.files && req.files.logo) {
            req.body._imageName = CurrentProjectData.logo_image || 0
            let logo_image =  await fileUpload.imageExport(req, res, "projectLogo", 'logo');
            body.logo_image = logo_image;
        }

        if (req.files && req.files.template) {
            req.body._imageName = CurrentProjectData.html_file || 0
            let html_file =  await fileUpload.imageExport(req, res, "projectHtml", 'template');
            body.html_file = html_file; 
        }

        if (req.body.template_name === 'null') {
            console.log("inside null")
            req.body._imageName = CurrentProjectData.html_file || 0
            await fileUpload.deleteImage(req, res, "projectHtml", 'template');
            body.html_file = null; 
        }

        if (req.body.file_preview === 'null') {
            req.body._imageName = CurrentProjectData.cover_image || 0
            await fileUpload.deleteImage(req, res, "projectHtml", 'template');
            body.cover_image = null; 
        }

        if (req.body.logo_preview === 'null') {
            req.body._imageName = CurrentProjectData.logo_image || 0
            await fileUpload.deleteImage(req, res, "projectHtml", 'template');
            body.logo_image = null; 
        }
     
            await CurrentProjectData.update(body)
            return await responseSuccess(req, res, "project updated" , {data: req.body.template_name, file: req.body.template  })

    } catch (error) {
    logErrorToFile(error)
        console.log("error", error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.deleteChannelProject = async(req, res) =>{
    try {

        let {project_id} = req.query
        let projectData = await req.config.channelProject.findOne({
            where:{
                project_id
            }
        })

        if(!projectData) return await responseError(req, res, "project name does not existed") 
        await projectData.destroy()
        return await responseSuccess(req, res, "project deleted")

    } catch (error) {
    logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}