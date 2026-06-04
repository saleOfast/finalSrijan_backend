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

const channelProjectLocationInclude = (config) => [
    { model: config.states, as: "projectState", attributes: ["state_id", "state_name", "country_id"] },
    { model: config.city, as: "projectCity", attributes: ["city_id", "city_name", "state_id"] },
];

const normalizeProjectBody = (body) => {
    const next = { ...body };
    if (next.project_name != null && next.project == null) {
        next.project = next.project_name;
    }
    return next;
};

const toNullableInt = (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

async function validateProjectStateCity(req, stateRaw, cityRaw) {
    const state_id = toNullableInt(stateRaw);
    const city_id = toNullableInt(cityRaw);
    if (!state_id && !city_id) return { ok: true, state_id, city_id };
    if (city_id && !state_id) {
        return { ok: false, msg: "state_id is required when city_id is provided" };
    }
    const state = await req.config.states.findByPk(state_id);
    if (!state) return { ok: false, msg: "Invalid state_id" };
    if (!city_id) return { ok: true, state_id, city_id: null };
    const city = await req.config.city.findByPk(city_id);
    if (!city) return { ok: false, msg: "Invalid city_id" };
    if (Number(city.state_id) !== Number(state_id)) {
        return { ok: false, msg: "Selected city does not belong to the selected state" };
    }
    return { ok: true, state_id, city_id };
}

// for admin
exports.storeChannelProject = async(req, res) => {
    try {
        let body = normalizeProjectBody({
            ...req.body,
            status: true,
            created_by: req.user.user_id,
        });
        const { project } = body;
        if (project == null || String(project).trim() === "") {
            return await responseError(req, res, "project or project_name is required");
        }
        let projectData;

        projectData = await req.config.channelProject.findOne({ where: { project } });

        if (projectData) return await responseError(req, res, "project name already exist")

        const locCheck = await validateProjectStateCity(req, body.state_id, body.city_id);
        if (!locCheck.ok) return await responseError(req, res, locCheck.msg);
        body.state_id = locCheck.state_id;
        body.city_id = locCheck.city_id;

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
        delete body.project_name
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
        const locInc = channelProjectLocationInclude(req.config);
        if(req.query.project_id){
            if(req.user.isDB){
                projectData = await req.config.channelProject.findByPk(req.query.project_id, {
                    include: locInc,
                })
            }else{
                projectData = await req.config.userProjectModel.findOne({
                    where: {project_id: req.query.project_id, created_by: req.user.user_id},
                    include: [{
                        model: req.config.channelProject,
                        as: "channelProjectData",
                        include: locInc,
                    }],
                })
                if(!projectData){
                    projectData = await req.config.channelProject.findByPk(req.query.project_id, {
                        include: locInc,
                    })
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
            projectData = await req.config.channelProject.findAll({
                include: locInc,
                order: [["project_id", "DESC"]],
            })
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
        let body = normalizeProjectBody({ ...req.body })

        let CurrentProjectData = await req.config.channelProject.findByPk(project_id)
        if(!CurrentProjectData) return await responseError(req, res, "project not found") 

        const mergedStateId = Object.prototype.hasOwnProperty.call(req.body, "state_id")
            ? body.state_id
            : CurrentProjectData.state_id;
        const mergedCityId = Object.prototype.hasOwnProperty.call(req.body, "city_id")
            ? body.city_id
            : CurrentProjectData.city_id;
        const locCheck = await validateProjectStateCity(req, mergedStateId, mergedCityId);
        if (!locCheck.ok) return await responseError(req, res, locCheck.msg);
        if (Object.prototype.hasOwnProperty.call(req.body, "state_id")) {
            body.state_id = locCheck.state_id;
        }
        if (Object.prototype.hasOwnProperty.call(req.body, "city_id")) {
            body.city_id = locCheck.city_id;
        }

        const projectNameForDup = body.project != null ? body.project : project;
        if(projectNameForDup) {
            let projectData = await req.config.channelProject.findOne({
                where:{
                    project_id: {[Op.ne]: project_id},
                    project: projectNameForDup
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

        delete body.project_name

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