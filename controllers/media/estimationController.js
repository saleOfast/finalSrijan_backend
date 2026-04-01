const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const { responseError, responseSuccess, getEstimateCode } = require("../../helper/responce");
const fileUpload = require("../../common/imageExport");
const sendEmail = require("../../common/mailer");
const { date } = require("joi");

exports.addEstimation = async (req, res) => {
    try {
        let body = req.body
        let dataArray = []

        let campaignCheck = await req.config.estimations.findOne({ where: { campaign_id: body.campaign_id } })
        if (campaignCheck) {
            return await responseError(req, res, "Estimate for the campaign already created")
        }

        body.created_by = body.last_modified_by = req.user.user_code
        body.est_s_id = 1
        body.estimation_code = await getEstimateCode(req, 'estimate')

        let [data, approvalRoles] = await Promise.all([
            req.config.estimations.create(body),
            req.config.settings.findOne({ where: { setting_id: 3 } })
        ]);

        approvalRoles = approvalRoles.setting_value.split(',').map(item => parseInt(item.trim()));

        for (let i = 0; i < approvalRoles.length; i++) {

            let check = await req.config.estimateApprovals.findOne({
                where: {
                    role_id: approvalRoles[i],
                    estimate_id: data?.dataValues?.estimate_id || data?.estimate_id
                }
            })

            if (!check) {
                const element = {
                    role_id: approvalRoles[i],
                    site_type: "ASSET",
                    approval_status: false,
                    responded: false,
                    approved_by: null,
                    estimate_id: data?.dataValues?.estimate_id || data?.estimate_id,
                    status: true,
                };
                dataArray.push(element)
            }
        }
        let approvals = await req.config.estimateApprovals.bulkCreate(dataArray)
        console.log("approvalsapprovalsapprovalsapprovals", approvals)


        return await responseSuccess(req, res, "Estimation Added Succesfully", data)

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.addReprintEstimate = async (req, res) => {
    try {
        const { estimate_id } = req.body
        let body = {}
        let dataArray = []

        const estimate = await req.config.estimations.findOne({ where: { estimate_id: estimate_id }, })

        body.created_by = req.user.user_code
        body.last_modified_by = req.user.user_code
        body.est_s_id = 1
        body.est_t_id = 3
        body.campaign_id = estimate?.campaign_id || estimate?.dataValues?.campaign_id
        body.estimation_code = await getEstimateCode(req, 'estimate')

        let [data, approvalRoles] = await Promise.all([
            req.config.estimations.create(body),
            req.config.settings.findOne({ where: { setting_id: 3 } })
        ]);

        approvalRoles = approvalRoles.setting_value.split(',').map(item => parseInt(item.trim()));

        for (let i = 0; i < approvalRoles.length; i++) {

            let check = await req.config.estimateApprovals.findOne({
                where: {
                    role_id: approvalRoles[i],
                    estimate_id: data?.dataValues?.estimate_id || data?.estimate_id
                }
            })

            if (!check) {
                const element = {
                    role_id: approvalRoles[i],
                    site_type: "ASSET",
                    approval_status: false,
                    responded: false,
                    approved_by: null,
                    estimate_id: data?.dataValues?.estimate_id || data?.estimate_id,
                    status: true,
                };
                dataArray.push(element)
            }
        }
        let approvals = await req.config.estimateApprovals.bulkCreate(dataArray)
        console.log("approvalsapprovalsapprovalsapprovals", approvals)

        return await responseSuccess(req, res, "Estimation Added Succesfully", data)

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.getEstimation = async (req, res) => {
    try {
        const { estimate_id, campaign_id } = req.query;
        if (estimate_id) {
            data = await req.config.estimations.findOne({
                where: { estimate_id: estimate_id },
                include: [
                    { model: req.config.estimateStatus, paranoid: false, foreignKey: 'est_s_id', as: `estimateStatus` },
                    {
                        model: req.config.mediaCampaignManagement, paranoid: false,
                        include: [
                            { model: req.config.accounts, paranoid: false },
                            { model: req.config.campaignStatus, paranoid: false },
                            { model: req.config.campaignProof, paranoid: false },
                            { model: req.config.campaignBusinessType, paranoid: false },
                        ],
                    },
                    { model: req.config.estimationType, paranoid: false },
                ]
            });
        }
        else if (campaign_id) {
            data = await req.config.estimations.findAll({
                where: { campaign_id: campaign_id },
                include: [
                    {
                        model: req.config.mediaCampaignManagement, paranoid: false,
                        include: [
                            { model: req.config.accounts, paranoid: false },
                            { model: req.config.campaignStatus, paranoid: false },
                        ],
                    },
                    { model: req.config.estimateStatus, paranoid: false, foreignKey: 'est_s_id', as: `estimateStatus` },
                    { model: req.config.estimationType, paranoid: false },
                ],
                order: [['createdAt', 'DESC']]
            });
        }
        else {
            data = await req.config.estimations.findAll({
                include: [
                    {
                        model: req.config.mediaCampaignManagement, paranoid: false,
                        include: [
                            { model: req.config.accounts, paranoid: false },
                            { model: req.config.campaignStatus, paranoid: false },
                        ],
                    },
                    { model: req.config.estimateStatus, paranoid: false, foreignKey: 'est_s_id', as: `estimateStatus` },
                    { model: req.config.estimationType, paranoid: false },
                ],
                order: [['createdAt', 'DESC']]
            });
        }
        return await responseSuccess(req, res, "Estimations Fetched Successfully", data);
    } catch (error) {
        logErrorToFile(error);
        console.log(error);
        return await responseError(req, res, "Something Went Wrong");
    }
};

exports.updateEstimation = async (req, res) => {
    try {
        const { estimate_id } = req.body
        let body = req.body

        let data = await req.config.estimations.findOne({ where: { estimate_id: estimate_id } })
        if (!data) {
            return await responseError(req, res, "The Estimation does not exist.")
        }
        body.last_modified_by = req.user.user_code
        await data.update(body)
        return await responseSuccess(req, res, "Estimation Updated Succesfully")

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.deleteEstimation = async (req, res) => {
    try {
        let { estimate_id } = req.query
        let body = await req.config.estimations.findOne({ where: { estimate_id: estimate_id } })
        if (!body) {
            return await responseError(req, res, "The Estimation does not exist.")
        }
        await body.destroy()
        return await responseSuccess(req, res, "Estimation Deleted Succesfully")

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.sendMailForApproval = async (req, res) => {
    try {
        let { estimate_id } = req.body

        let currentRoles = await req.config.settings.findOne({ where: { setting_id: 3 } })
        let roles = currentRoles.setting_value.split(',').map(item => parseInt(item.trim()));

        let [data, users] = await Promise.all([
            req.config.estimations.findOne({ where: { estimate_id: estimate_id } }),
            req.config.users.findAll({ where: { role_id: { [Op.in]: roles } } })
        ])

        if (!data) {
            return await responseError(req, res, "The Estimation does not exist.")
        }

        let message = "You have new estimations to approve."

        for (let i = 0; i < users.length; i++) {
            const element = users[i];

            let option = {
                email: element?.dataValues?.email || element?.email,
                subject: "Srijan Bandhan",
                message: message,
            };

            await sendEmail(option);
        }
        await data.update({ est_s_id: 5 })
        return await responseSuccess(req, res, "Approval Mail for Estimations has been sent successfully.")

    } catch (error) {
        logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.approveEstimate = async (req, res) => {
    try {
        const { estimate_id, approval } = req.body;
        let userData = req.user;

        // Fetch estimation data and approvals
        let [data, approvals] = await Promise.all([
            req.config.estimations.findOne({ where: { estimate_id: estimate_id } }),
            req.config.estimateApprovals.findAll({ where: { estimate_id: estimate_id, status: true } })
        ]);

        if (!data) {
            return res.status(404).json({ message: 'Estimation not found' });
        }

        if (!approvals) {
            return res.status(404).json({ message: 'Estimation Approvals not found' });
        }

        if (userData.isDB) {
            // Admin is approving, update all approvals
            await req.config.estimateApprovals.update(
                { approval_status: approval, responded: true },
                { where: { estimate_id: estimate_id } }
            );

            if (approval) {
                await req.config.estimations.update(
                    { est_s_id: 2, approved_date: new Date().toISOString() },
                    { where: { estimate_id: estimate_id } }
                );

                let arr = [];
                let sitesArray = await req.config.estimationForAssetBusiness.findAll({ where: { estimate_id: estimate_id } });

                for (let i = 0; i < sitesArray.length; i++) {
                    const element = sitesArray[i];
                    let clientCostSheet = await req.config.assetClientCostSheet.findOne({
                        where: { site_id: element?.dataValues?.site_id, eab_id: element?.dataValues?.eab_id }
                    });
                    let vendorCostSheet = await req.config.assetVendorCostSheet.findOne({
                        where: { site_id: element?.dataValues?.site_id, eab_id: element?.dataValues?.eab_id }
                    });
                    let count = await req.config.siteBookingHistory.count();
                    arr.push({
                        site_id: element?.dataValues?.site_id,
                        campaign_id: data?.dataValues?.campaign_id,
                        estimate_id: estimate_id,
                        ccs_id: clientCostSheet?.dataValues?.ccs_id,
                        vcs_id: vendorCostSheet?.dataValues?.vcs_id,
                        sb_code: `BH000${count + 1}`
                    });
                }

                await req.config.siteBookingHistory.bulkCreate(arr).catch(err => console.log(err));

                return await responseSuccess(req, res, "Estimation approved successfully.");
            } else {
                await req.config.estimations.update(
                    { est_s_id: 3, rejected_date: new Date().toISOString() },
                    { where: { estimate_id: estimate_id } }
                );
                return await responseSuccess(req, res, "Estimation has been rejected.");
            }
        }

        let check = await req.config.estimateApprovals.findOne({
            where: { estimate_id: estimate_id, role_id: userData.role_id, responded: true }
        });

        if (check) {
            return res.status(200).json({ status: 200, message: 'You have already responded', data: null });
        }

        await req.config.estimateApprovals.update(
            { approval_status: approval, responded: true },
            { where: { estimate_id: estimate_id, role_id: userData.role_id } }
        );

        approvals = await req.config.estimateApprovals.findAll({ where: { estimate_id: estimate_id, status: true } });

        const allResponded = approvals.every(approval => approval.responded === true);

        const allApproved = approvals.every(approval => approval.approval_status === true);

        // If all users have responded
        if (allResponded) {
            if (allApproved) {
                // All approvals are true
                await req.config.estimations.update(
                    { est_s_id: 2, approved_date: new Date().toISOString() },
                    { where: { estimate_id: estimate_id } }
                );
                let arr = [];
                let sitesArray = await req.config.estimationForAssetBusiness.findAll({ where: { estimate_id: estimate_id } })

                for (let i = 0; i < sitesArray.length; i++) {
                    const element = sitesArray[i];
                    let clientCostSheet = await req.config.assetClientCostSheet.findOne({ where: { site_id: element?.dataValues?.site_id, eab_id: element?.dataValues?.eab_id } })
                    let vendorCostSheet = await req.config.assetVendorCostSheet.findOne({ where: { site_id: element?.dataValues?.site_id, eab_id: element?.dataValues?.eab_id } })
                    let count = await req.config.siteBookingHistory.count()
                    let bookingHistory = arr.push({
                        site_id: element?.dataValues?.site_id,
                        campaign_id: data?.dataValues?.campaign_id,
                        estimate_id: estimate_id,
                        ccs_id: clientCostSheet?.dataValues?.ccs_id,
                        vcs_id: vendorCostSheet?.dataValues?.vcs_id,
                        sb_code: `BH000${count + 1}`
                    })
                }
                await req.config.siteBookingHistory.bulkCreate(arr).catch(err => console.log(err))

                return await responseSuccess(req, res, "Estimation approved successfully.");
            } else {
                // At least one approval is false
                await req.config.estimations.update(
                    { est_s_id: 3, rejected_date: new Date().toISOString() },
                    { where: { estimate_id: estimate_id } }
                );
                return await responseSuccess(req, res, "Estimation has been rejected.");
            }
        } else {
            return res.status(200).json({ status: 200, message: 'Waiting for other users to approve', data: null });
        }
    } catch (error) {
        logErrorToFile(error);
        console.log(error);
        return await responseError(req, res, "Something Went Wrong");
    }
};

exports.proformaInvoice = async (req, res) => {
    try {
        const { estimate_id } = req.query;
        if (!estimate_id) {
            return await responseError(req, res, "Estimate ID is required.");
        }

        const data = await req.config.estimations.findOne({
            where: { estimate_id },
            include: [
                {
                    model: req.config.mediaCampaignManagement,
                    paranoid: false,
                    include: [
                        { model: req.config.campaignBusinessType, paranoid: false },
                        {
                            model: req.config.accounts,
                            paranoid: false,
                            include: [
                                { model: req.config.country, as: "billCountry", paranoid: false },
                                { model: req.config.states, as: "billState", paranoid: false },
                                { model: req.config.city, as: "billCity", paranoid: false },
                            ],
                        },
                    ],
                },
            ],
        });

        if (!data) {
            return await responseError(req, res, "The Estimation does not exist.");
        }

        const siteType = data?.dataValues?.db_media_campaign?.dataValues?.db_campaign_business_type?.dataValues?.cmpn_b_t_name ||
            data?.db_media_campaigns?.db_campaign_business_types?.cmpn_b_t_name;

        let siteData;
        let costSheets = [];

        if (siteType === 'Agency') {
            siteData = await req.config.sitesForAgencyEstimates.findAll({
                where: { estimate_id },
                include: [
                    { model: req.config.agencyClientCostSheet, paranoid: false },
                ],
            });

            // Collect all cost sheets into the costSheets array
            if (siteData.length) {
                siteData.forEach(item => {
                    const sheets = item.dataValues.db_agency_client_cost_sheets;
                    if (sheets) costSheets.push(...sheets);
                });
            }
        } else if (siteType === 'Asset') {
            siteData = await req.config.estimationForAssetBusiness.findAll({
                where: { estimate_id },
                include: [
                    {
                        model: req.config.sites,
                        paranoid: false,
                        include: [
                            { model: req.config.accounts, paranoid: false },
                            { model: req.config.assetClientCostSheet, paranoid: false },
                            { model: req.config.siteCategories, paranoid: false },
                            { model: req.config.mediaFormat, paranoid: false },
                            { model: req.config.mediaVehicle, paranoid: false },
                            { model: req.config.mediaType, paranoid: false },
                            { model: req.config.siteStatus, paranoid: false },
                            { model: req.config.rating, paranoid: false },
                            { model: req.config.availabiltyStatus, paranoid: false },
                            { model: req.config.country, paranoid: false },
                            { model: req.config.states, paranoid: false },
                            { model: req.config.city, paranoid: false },
                        ],
                    },
                ],
            });

            // Collect all cost sheets into the costSheets array
            if (siteData.length) {
                siteData.forEach(item => {
                    const sheets = item.dataValues.db_site?.dataValues?.db_asset_client_cost_sheets;
                    if (sheets) costSheets.push(...sheets);
                });
            }
        }

        data.dataValues.siteData = siteData;
        data.dataValues.costSheets = costSheets;

        return await responseSuccess(req, res, "Proforma Invoice Data Fetched Successfully", data);
    } catch (error) {
        logErrorToFile(error);
        console.log(error);
        return await responseError(req, res, "Something Went Wrong");
    }
};

exports.getSiteBookingHistory = async (req, res) => {
    try {
        const { site_id, estimate_id } = req.query;
        let data
        if (site_id) {
            data = await req.config.siteBookingHistory.findAll({
                where: { site_id: site_id },
                include: [
                    {
                        model: req.config.mediaCampaignManagement, paranoid: false,
                        include: [
                            { model: req.config.accounts, paranoid: false },
                            { model: req.config.campaignStatus, paranoid: false },
                            { model: req.config.campaignProof, paranoid: false },
                            { model: req.config.campaignBusinessType, paranoid: false },
                        ],
                    },
                    {
                        model: req.config.estimations, paranoid: false,
                    },
                    {
                        model: req.config.assetClientCostSheet, paranoid: false,
                    },
                    {
                        model: req.config.assetVendorCostSheet, paranoid: false,
                    },
                ]
            })
        }
        if (estimate_id) {
            data = await req.config.siteBookingHistory.findAll({
                where: { estimate_id: estimate_id },
                include: [
                    {
                        model: req.config.mediaCampaignManagement, paranoid: false,
                        include: [
                            { model: req.config.accounts, paranoid: false },
                            { model: req.config.campaignStatus, paranoid: false },
                            { model: req.config.campaignProof, paranoid: false },
                            { model: req.config.campaignBusinessType, paranoid: false },
                        ],
                    },
                    {
                        model: req.config.sites, paranoid: false,
                        include: [
                            { model: req.config.accounts, paranoid: false },
                            { model: req.config.siteCategories, paranoid: false },
                            { model: req.config.mediaFormat, paranoid: false },
                            { model: req.config.mediaVehicle, paranoid: false },
                            { model: req.config.mediaType, paranoid: false },
                            { model: req.config.siteStatus, paranoid: false },
                            { model: req.config.rating, paranoid: false },
                            { model: req.config.availabiltyStatus, paranoid: false },
                            { model: req.config.country, paranoid: false },
                            { model: req.config.states, paranoid: false },
                            { model: req.config.city, paranoid: false },
                        ],
                    },
                    {
                        model: req.config.assetClientCostSheet, paranoid: false,
                    },
                    {
                        model: req.config.assetVendorCostSheet, paranoid: false,
                    },
                ]
            })
        }


        return await responseSuccess(req, res, "Estimations Fetched Successfully", data);
    } catch (error) {
        logErrorToFile(error);
        console.log(error);
        return await responseError(req, res, "Something Went Wrong");
    }
};