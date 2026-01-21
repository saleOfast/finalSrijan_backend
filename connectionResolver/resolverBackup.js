const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const db = require("../model");
const user = db.clients;
const { promisify } = require("util");
const cron = require('node-cron');
const jwt = require("jsonwebtoken");
const dbConfig = require("../config/db.config.js");
const { responseError } = require("../helper/responce.js");
const { assignLeadsRoundRobin } = require('../controllers/contactUsController.js')
const { sendMailToLeadOwners } = require("../controllers/channel/channelLeadController.js");
const { sendMailToReportTos } = require("../controllers/userController.js");

const tenants = {};
const connectionLocks = {};

exports.resolver = async (req, res, next) => {
  try {
    // verify token

    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) return res.status(400).json({ message: "No Token Found !" });

    // token verification
    const decoded = await promisify(jwt.verify)(token, process.env.CLIENT_SECRET);
    const clientUser = await user.findOne({
      where: {
        user_code: decoded.user_code,
      },
    });
    if (!clientUser) return res.status(400).json({ message: "Auth Failed No User found!" });

    // Check if there's a lock for this tenant
    if (connectionLocks[decoded.user_code]) {
      console.log('Waiting for connection lock to be released...');
      while (connectionLocks[decoded.user_code]) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait and retry
      }
    }

    // Check if tenant instance exists
    if (!tenants[decoded.user_code]) {
      // Set the lock before starting connection creation
      connectionLocks[decoded.user_code] = true;

      console.log('Creating new connection...');

      try {
        const sequelize2 = new Sequelize(
          clientUser.db_name,
          dbConfig.USER,
          dbConfig.PASSWORD,
          {
            host: dbConfig.HOST,
            dialect: "mysql",
            port: dbConfig.PORT,
            logging: false,
            timezone: "+05:30",
            pool: {
              max: dbConfig.pool.max,
              min: dbConfig.pool.min,
              acquire: dbConfig.pool.acquire,
              idle: dbConfig.pool.idle,
            },
          }
        );

        await sequelize2.authenticate();
        console.log("Tenant DB Connected");

        const Userdb = {};
        Userdb.Sequelize = Sequelize;
        Userdb.sequelize = sequelize2;

        Userdb.estimateStatus = require("../model/media/estimateStatusModel.js")(sequelize2, DataTypes);
        Userdb.estimations = require("../model/media/estimationModel.js")(sequelize2, DataTypes);//Agency

        Userdb.emailTemplates = require("../model/emailTemplatesModel.js")(sequelize2, DataTypes);
        Userdb.users = require("../model/userModel.js")(sequelize2, DataTypes);
        Userdb.leads = require("../model/leadModel.js")(sequelize2, DataTypes);
        Userdb.organisationInfo = require("../model/organisationInfo.js")(sequelize2, DataTypes);
        Userdb.usersProfiles = require("../model/userProfileModel")(sequelize2, DataTypes);
        Userdb.user_role = require("../model/userRoleModel")(sequelize2, DataTypes);
        Userdb.channelPartnerLeads = require("../model/contactUsModel.js")(sequelize2, DataTypes);

        Userdb.country = require("../model/countryModel")(sequelize2, DataTypes);
        Userdb.states = require("../model/StateModel")(sequelize2, DataTypes);
        Userdb.districts = require("../model/districtModel")(sequelize2, DataTypes);
        Userdb.city = require("../model/cityModel")(sequelize2, DataTypes);
        Userdb.menus = require("../model/menuModel")(sequelize2, DataTypes);
        Userdb.role_permissions = require("../model/rolePermissionModel")(sequelize2, DataTypes);
        Userdb.divisions = require("../model/divisionModel")(sequelize2, DataTypes);
        Userdb.departments = require("../model/departmentModel")(sequelize2, DataTypes);
        Userdb.designations = require("../model/designationModel")(sequelize2, DataTypes);
        Userdb.leadRatings = require("../model/leadRatingModel")(sequelize2, DataTypes);
        Userdb.leadSources = require("../model/leadSourceModel")(sequelize2, DataTypes);
        Userdb.leadStages = require("../model/leadStageModel")(sequelize2, DataTypes);
        Userdb.leadTypes = require("../model/leadTypeModel")(sequelize2, DataTypes);
        Userdb.industry = require("../model/industryModel")(sequelize2, DataTypes);
        Userdb.losses = require("../model/lossModel")(sequelize2, DataTypes);
        Userdb.opprStage = require("../model/oppotunityStageModel")(sequelize2, DataTypes);
        Userdb.productCategories = require("../model/productCatModel")(sequelize2, DataTypes);
        Userdb.leadStatuses = require("../model/leadStatusModel")(sequelize2, DataTypes);
        Userdb.accountTypes = require("../model/accountTypeModel")(sequelize2, DataTypes);
        Userdb.accounts = require("../model/accountModel")(sequelize2, DataTypes);
        Userdb.taskStatus = require("../model/taskStatusModel")(sequelize2, DataTypes);
        Userdb.opportunities = require("../model/opportunityModel")(sequelize2, DataTypes);
        Userdb.contacts = require("../model/contactModel")(sequelize2, DataTypes);
        Userdb.taskPriority = require("../model/taskPriorityModels")(sequelize2, DataTypes);
        Userdb.products = require("../model/productModel")(sequelize2, DataTypes);
        Userdb.tax = require("../model/taxModel")(sequelize2, DataTypes);
        Userdb.productTaxes = require("../model/productTaxModel")(sequelize2, DataTypes);
        Userdb.quatStatuses = require("../model/quatationStatusModel")(sequelize2, DataTypes);
        Userdb.quatMasters = require("../model/quatationMasterModel")(sequelize2, DataTypes);
        Userdb.quatProducts = require("../model/quatationProduct")(sequelize2, DataTypes);
        Userdb.quatTaxes = require("../model/quationTaxModel")(sequelize2, DataTypes);
        Userdb.tasks = require("../model/Taskmodel")(sequelize2, DataTypes);
        Userdb.callLogs = require("../model/callLogModel")(sequelize2, DataTypes);
        Userdb.leaveHeads = require("../model/leaveHeadModel")(sequelize2, DataTypes);
        Userdb.leaveHeadCounts = require("../model/leaveHeadCountModel.js")(sequelize2, DataTypes);
        Userdb.userLeaveApps = require("../model/userLeaveApplicationModel")(sequelize2, DataTypes);
        Userdb.userLeaves = require("../model/userLeaveModel")(sequelize2, DataTypes);
        Userdb.userAttandance = require("../model/userAttandanceModel.js")(sequelize2, DataTypes);
        Userdb.policyHead = require("../model/policyHeadModel.js")(sequelize2, DataTypes);
        Userdb.policyTypeHead = require("../model/policyHeadTypeModel.js")(sequelize2, DataTypes);
        Userdb.userExpences = require("../model/expenceReportModel.js")(sequelize2, DataTypes);
        Userdb.opprType = require("../model/opportunityTypeModel.js")(sequelize2, DataTypes);
        Userdb.productOpportunity = require("../model/OpportunityProductModel.js")(sequelize2, DataTypes);
        Userdb.expenceFl = require("../model/expenceFlModel")(sequelize2, DataTypes);
        Userdb.userField = require("../model/FieldModel.js")(sequelize2, DataTypes);
        Userdb.userExtraFiled = require("../model/leadFiledModel.js")(sequelize2, DataTypes);
        Userdb.Field = require("../model/FieldModel.js")(sequelize2, DataTypes);
        Userdb.leadField = require("../model/leadFiledModel.js")(sequelize2, DataTypes);
        Userdb.accountField = require("../model/accountfieldModel.js")(sequelize2, DataTypes);
        Userdb.contactField = require("../model/contactfieldModel.js")(sequelize2, DataTypes);
        Userdb.platform = require("../model/platformModel.js")(sequelize2, DataTypes);
        Userdb.userPlatform = require("../model/userPlatformModel.js")(sequelize2, DataTypes);
        Userdb.emailConfig = require("../model/emailConfigModel.js")(sequelize2, DataTypes);
        Userdb.leadLocation = require("../model/leadLocation.js")(sequelize2, DataTypes);
        Userdb.channelPartnerType = require("../model/channelPartnerType.js")(sequelize2, DataTypes);

        Userdb.opportunityField = require("../model/opportunityFieldModel.js")(sequelize2, DataTypes);
        Userdb.userFieldModel = require("../model/userFieldModel.js")(sequelize2, DataTypes);

        //  MART MODELS STARTED
        Userdb.martBrandModel = require("../model/mart/martBrandModel.js")(sequelize2, DataTypes);
        Userdb.quizModel = require("../model/mart/LearningModule/quizModel.js")(sequelize2, DataTypes);
        Userdb.martStoreCategoryModel =
          require("../model/mart/martStoreCategoryModel.js")(sequelize2, DataTypes);
        Userdb.martSchemeModel = require("../model/mart/martSchemeModel.js")(sequelize2, DataTypes);
        //   MART MODEL ENDED

        //  DMS MODELS STARTED
        Userdb.dmsBrand = require("../model/dms/brandModel.js")(sequelize2, DataTypes);
        Userdb.dmsCoupon = require("../model/dms/couponModel.js")(sequelize2, DataTypes);
        Userdb.dmsBanner = require("../model/dms/bannerModel.js")(sequelize2, DataTypes);
        Userdb.dmsCart = require("../model/dms/cartModel.js")(sequelize2, DataTypes);
        Userdb.dmsOrder = require("../model/dms/orderModel.js")(sequelize2, DataTypes);
        Userdb.dmsOrderItems = require("../model/dms/orderItemModel.js")(sequelize2, DataTypes);
        //   DMS MODEL ENDED

        //  Channel MODELS STARTED
        Userdb.channelProject = require("../model/channel/projectModel.js")(sequelize2, DataTypes);
        Userdb.leadVisit = require("../model/channel/visitModel.js")(sequelize2, DataTypes);
        Userdb.leadBooking = require("../model/channel/bookingModel.js")(sequelize2, DataTypes);
        Userdb.leadBrokerage = require("../model/channel/brokerageModel.js")(sequelize2, DataTypes);
        Userdb.userProjectModel = require("../model/channel/userProjectModel.js")(sequelize2, DataTypes);

        Userdb.settings = require("../model/generalSettings.js")(sequelize2, DataTypes);

        //   DMS Channel ENDED

        // Media Models

        Userdb.siteCategories = require("../model/media/siteCategoryModel.js")(sequelize2, DataTypes);
        Userdb.mediaFormat = require("../model/media/mediaFormatModel.js")(sequelize2, DataTypes);
        Userdb.mediaVehicle = require("../model/media/mediaVehicleModel.js")(sequelize2, DataTypes);
        Userdb.mediaType = require("../model/media/mediaTypeModel.js")(sequelize2, DataTypes);
        Userdb.siteStatus = require("../model/media/siteStatusModel.js")(sequelize2, DataTypes);
        Userdb.rating = require("../model/media/ratingModel.js")(sequelize2, DataTypes);
        Userdb.availabiltyStatus = require("../model/media/availabiltyStatus.js")(sequelize2, DataTypes);

        Userdb.mountingCost = require("../model/media/mountingCostManagementModel.js")(sequelize2, DataTypes);

        Userdb.printingMaterial = require("../model/media/printingMaterialModel.js")(sequelize2, DataTypes);
        Userdb.printingCost = require("../model/media/printingCostModel.js")(sequelize2, DataTypes);

        Userdb.campaignStatus = require("../model/media/Campaign/campaignStatusModel.js")(sequelize2, DataTypes);
        Userdb.campaignProof = require("../model/media/Campaign/campaignProofModel.js")(sequelize2, DataTypes);
        Userdb.campaignBusinessType = require("../model/media/Campaign/campaignBusinessTypeModel.js")(sequelize2, DataTypes);
        Userdb.mediaCampaignManagement = require("../model/media/Campaign/campaignManagementModel.js")(sequelize2, DataTypes);

        Userdb.currency = require("../model/countryCurrencyModel.js")(sequelize2, DataTypes);

        Userdb.sites = require("../model/media/siteManagementModel.js")(sequelize2, DataTypes);//Asset
        Userdb.sitesForAgencyEstimates = require("../model/media/sitesForAgencyBusinessEstimationModel.js")(sequelize2, DataTypes);//Agency

        Userdb.siteBookingHistory = require("../model/media/siteBookingHistory.js")(sequelize2, DataTypes);//Agency

        Userdb.estimationForAssetBusiness = require("../model/media/estimationForAssetBusiness.js")(sequelize2, DataTypes);//Asset

        Userdb.estimateApprovals = require("../model/media/estimatesApproval.js")(sequelize2, DataTypes);//Agency

        Userdb.assetClientCostSheet = require("../model/media/costSheets/assetClientCostSheet.js")(sequelize2, DataTypes); //Asset
        Userdb.agencyClientCostSheet = require("../model/media/costSheets/agencyClientCostSheet.js")(sequelize2, DataTypes); //Agency

        Userdb.assetVendorCostSheet = require("../model/media/costSheets/assetVendorCostSheet.js")(sequelize2, DataTypes); //Asset
        Userdb.agencyVendorCostSheet = require("../model/media/costSheets/agencyVendorCostSheet.js")(sequelize2, DataTypes); //Agency

        Userdb.changeLog = require("../model/media/costSheets/costSheetChangeLogs.js")(sequelize2, DataTypes);

        Userdb.revisitLeadsVisits = require("../model/channel/revisitModel.js")(sequelize2, DataTypes);

        Userdb.purchaseOrders = require("../model/media/purchaseOrderModel.js")(sequelize2, DataTypes);

        // associate

        Userdb.users.hasOne(Userdb.usersProfiles, { foreignKey: 'user_id' })
        Userdb.usersProfiles.belongsTo(Userdb.users, { foreignKey: 'user_id' })

        Userdb.user_role.hasOne(Userdb.users, { foreignKey: 'role_id' })
        Userdb.users.belongsTo(Userdb.user_role, { foreignKey: 'role_id' })

        Userdb.divisions.hasMany(Userdb.usersProfiles, { foreignKey: 'div_id' })
        Userdb.usersProfiles.belongsTo(Userdb.divisions, { foreignKey: 'div_id' })

        Userdb.departments.hasMany(Userdb.usersProfiles, { foreignKey: 'dep_id' })
        Userdb.usersProfiles.belongsTo(Userdb.departments, { foreignKey: 'dep_id' })

        Userdb.designations.hasMany(Userdb.usersProfiles, { foreignKey: 'des_id' })
        Userdb.usersProfiles.belongsTo(Userdb.designations, { foreignKey: 'des_id' })

        Userdb.country.hasMany(Userdb.users, { foreignKey: 'country_id' })
        Userdb.users.belongsTo(Userdb.country, { foreignKey: 'country_id' })

        Userdb.states.hasMany(Userdb.users, { foreignKey: 'state_id' })
        Userdb.users.belongsTo(Userdb.states, { foreignKey: 'state_id' })

        Userdb.city.hasMany(Userdb.users, { foreignKey: 'city_id' })
        Userdb.users.belongsTo(Userdb.city, { foreignKey: 'city_id' })

        Userdb.users.belongsTo(Userdb.users, { foreignKey: 'report_to', as: 'reportToUser' });

        /* --------------------leads associate ---------------------------- */
        Userdb.departments.hasMany(Userdb.leads, { foreignKey: 'dep_id' })
        Userdb.leads.belongsTo(Userdb.departments, { foreignKey: 'dep_id' })

        Userdb.leadStatuses.hasMany(Userdb.leads, { foreignKey: 'lead_status_id' })
        Userdb.leads.belongsTo(Userdb.leadStatuses, { foreignKey: 'lead_status_id' })

        Userdb.leadSources.hasMany(Userdb.leads, { foreignKey: 'lead_src_id' })
        Userdb.leads.belongsTo(Userdb.leadSources, { foreignKey: 'lead_src_id' })

        Userdb.leadStages.hasMany(Userdb.leads, { foreignKey: 'lead_stg_id' })
        Userdb.leads.belongsTo(Userdb.leadStages, { foreignKey: 'lead_stg_id' })

        Userdb.country.hasMany(Userdb.leads, { foreignKey: 'country_id' })
        Userdb.leads.belongsTo(Userdb.country, { foreignKey: 'country_id' })

        Userdb.states.hasMany(Userdb.leads, { foreignKey: 'state_id' })
        Userdb.leads.belongsTo(Userdb.states, { foreignKey: 'state_id' })

        Userdb.city.hasMany(Userdb.leads, { foreignKey: 'city_id' })
        Userdb.leads.belongsTo(Userdb.city, { foreignKey: 'city_id' })

        Userdb.users.hasMany(Userdb.leads, { foreignKey: 'assigned_lead' })
        Userdb.leads.belongsTo(Userdb.users, { foreignKey: 'assigned_lead' })

        Userdb.users.hasMany(Userdb.leads, { as: "leadAssignedBy", foreignKey: 'assigned_by' })
        Userdb.leads.belongsTo(Userdb.users, { as: "leadAssignedBy", foreignKey: 'assigned_by' })

        Userdb.users.hasMany(Userdb.leads, { as: "leadOwner", foreignKey: 'lead_owner' })
        Userdb.leads.belongsTo(Userdb.users, { as: "leadOwner", foreignKey: 'lead_owner' })

        Userdb.accounts.hasMany(Userdb.leads, { foreignKey: 'acc_id' })
        Userdb.leads.belongsTo(Userdb.accounts, { foreignKey: 'acc_id' })

        Userdb.contacts.hasMany(Userdb.leads, { foreignKey: 'contact_id' })
        Userdb.leads.belongsTo(Userdb.contacts, { foreignKey: 'contact_id' })

        Userdb.opportunities.hasMany(Userdb.leads, { foreignKey: 'opp_id' })
        Userdb.leads.belongsTo(Userdb.opportunities, { foreignKey: 'opp_id' })
        /* --------------------leads associate End ---------------------------- */

        /* --------------------tasks associate start ---------------------------- */
        Userdb.taskStatus.hasMany(Userdb.tasks, { foreignKey: 'task_status_id' })
        Userdb.tasks.belongsTo(Userdb.taskStatus, { foreignKey: 'task_status_id' })

        Userdb.taskPriority.hasMany(Userdb.tasks, { foreignKey: 'task_priority_id' })
        Userdb.tasks.belongsTo(Userdb.taskPriority, { foreignKey: 'task_priority_id' })

        Userdb.opportunities.hasMany(Userdb.tasks, { as: "linkWithOpportunity", foreignKey: 'link_with_opportunity' })
        Userdb.tasks.belongsTo(Userdb.opportunities, { as: "linkWithOpportunity", foreignKey: 'link_with_opportunity' })

        Userdb.leads.hasMany(Userdb.tasks, { foreignKey: 'lead_id' })
        Userdb.tasks.belongsTo(Userdb.leads, { foreignKey: 'lead_id' })

        Userdb.users.hasMany(Userdb.tasks, { as: "assignedToUser", foreignKey: 'assigned_to' })
        Userdb.tasks.belongsTo(Userdb.users, { as: "assignedToUser", foreignKey: 'assigned_to' })

        Userdb.users.hasMany(Userdb.tasks, { as: "createdByUser", foreignKey: 'created_by' })
        Userdb.tasks.belongsTo(Userdb.users, { as: "createdByUser", foreignKey: 'created_by' })
        /* --------------------tasks associate end ---------------------------- */

        /* --------------------lead event add  ---------------------------- */

        Userdb.leads.hasMany(Userdb.callLogs, { foreignKey: 'lead_id' })
        Userdb.callLogs.belongsTo(Userdb.leads, { foreignKey: 'lead_id' })

        Userdb.opportunities.hasMany(Userdb.callLogs, { foreignKey: 'link_with_opportunity' })
        Userdb.callLogs.belongsTo(Userdb.opportunities, { foreignKey: 'link_with_opportunity' })

        /* --------------------lead event end ---------------------------- */

        /* --------------------account associate start ---------------------------- */
        Userdb.country.hasMany(Userdb.accounts, { as: "billCountry", foreignKey: 'bill_cont' })
        Userdb.accounts.belongsTo(Userdb.country, { as: "billCountry", foreignKey: 'bill_cont' })

        Userdb.states.hasMany(Userdb.accounts, { as: "billState", foreignKey: 'bill_state' })
        Userdb.accounts.belongsTo(Userdb.states, { as: "billState", foreignKey: 'bill_state' })

        Userdb.city.hasMany(Userdb.accounts, { as: "billCity", foreignKey: 'bill_city' })
        Userdb.accounts.belongsTo(Userdb.city, { as: "billCity", foreignKey: 'bill_city' })

        Userdb.country.hasMany(Userdb.accounts, { as: "shipCountry", foreignKey: 'ship_cont' })
        Userdb.accounts.belongsTo(Userdb.country, { as: "shipCountry", foreignKey: 'ship_cont' })

        Userdb.states.hasMany(Userdb.accounts, { as: "shipState", foreignKey: 'ship_state' })
        Userdb.accounts.belongsTo(Userdb.states, { as: "shipState", foreignKey: 'ship_state' })

        Userdb.city.hasMany(Userdb.accounts, { as: "shipCity", foreignKey: 'ship_city' })
        Userdb.accounts.belongsTo(Userdb.city, { as: "shipCity", foreignKey: 'ship_city' })

        Userdb.accountTypes.hasMany(Userdb.accounts, { foreignKey: 'account_type_id' })
        Userdb.accounts.belongsTo(Userdb.accountTypes, { foreignKey: 'account_type_id' })

        Userdb.users.hasMany(Userdb.accounts, { as: "account_owner", foreignKey: 'acc_owner' })
        Userdb.accounts.belongsTo(Userdb.users, { as: "account_owner", foreignKey: 'acc_owner' })

        Userdb.users.hasMany(Userdb.accounts, { as: "assignedAcc", foreignKey: 'assigned_to' })
        Userdb.accounts.belongsTo(Userdb.users, { as: "assignedAcc", foreignKey: 'assigned_to' })

        Userdb.industry.hasMany(Userdb.accounts, { foreignKey: 'ind_id' })
        Userdb.accounts.belongsTo(Userdb.industry, { foreignKey: 'ind_id' })

        /* --------------------account associate end ---------------------------- */

        /* --------------------product associate start ---------------------------- */
        Userdb.productCategories.hasMany(Userdb.products, { foreignKey: 'p_cat_id' })
        Userdb.products.belongsTo(Userdb.productCategories, { foreignKey: 'p_cat_id' })

        Userdb.dmsBrand.hasMany(Userdb.products, { foreignKey: 'brand_id' })
        Userdb.products.belongsTo(Userdb.dmsBrand, { foreignKey: 'brand_id' })


        /* --------------------product associate ends ---------------------------- */

        /* --------------------tax associate start ---------------------------- */
        Userdb.users.hasMany(Userdb.tax, { as: "updatedBy", foreignKey: 'updated_by' })
        Userdb.tax.belongsTo(Userdb.users, { as: "updatedBy", foreignKey: 'updated_by' })
        /* --------------------tax associate end ---------------------------- */

        /* --------------------product tax associate start ---------------------------- */
        Userdb.products.hasMany(Userdb.productTaxes, { foreignKey: 'p_id' })
        Userdb.productTaxes.belongsTo(Userdb.products, { foreignKey: 'p_id' })

        Userdb.tax.hasMany(Userdb.productTaxes, { foreignKey: 'tax_id' })
        Userdb.productTaxes.belongsTo(Userdb.tax, { foreignKey: 'tax_id' })
        /* --------------------product tax associate end ---------------------------- */

        /* --------------------contact associate start ---------------------------- */
        Userdb.accounts.hasMany(Userdb.contacts, { as: "contactList", foreignKey: 'account_name' })
        Userdb.contacts.belongsTo(Userdb.accounts, { as: "accountName", foreignKey: 'account_name' })


        Userdb.users.hasMany(Userdb.contacts, { as: "contactOwner", foreignKey: 'contact_owner' })
        Userdb.contacts.belongsTo(Userdb.users, { as: "contactOwner", foreignKey: 'contact_owner' })

        Userdb.users.hasMany(Userdb.contacts, { as: "assignedContact", foreignKey: 'assigned_to' })
        Userdb.contacts.belongsTo(Userdb.users, { as: "assignedContact", foreignKey: 'assigned_to' })


        Userdb.country.hasMany(Userdb.contacts, { as: "MaillingCountry", foreignKey: 'mailing_cont' })
        Userdb.contacts.belongsTo(Userdb.country, { as: "MaillingCountry", foreignKey: 'mailing_cont' })

        Userdb.states.hasMany(Userdb.contacts, { as: "MaillingState", foreignKey: 'mailing_state' })
        Userdb.contacts.belongsTo(Userdb.states, { as: "MaillingState", foreignKey: 'mailing_state' })

        Userdb.city.hasMany(Userdb.contacts, { as: "MaillingCity", foreignKey: 'mailing_city' })
        Userdb.contacts.belongsTo(Userdb.city, { as: "MaillingCity", foreignKey: 'mailing_city' })
        /* --------------------contact associate end ---------------------------- */

        /* --------------------opportunity associate start ---------------------------- */
        Userdb.accounts.hasMany(Userdb.opportunities, { as: "oppList", foreignKey: 'account_name' })
        Userdb.opportunities.belongsTo(Userdb.accounts, { as: "accName", foreignKey: 'account_name' })

        Userdb.users.hasMany(Userdb.opportunities, { as: "oppOwner", foreignKey: 'opp_owner' })
        Userdb.opportunities.belongsTo(Userdb.users, { as: "oppOwner", foreignKey: 'opp_owner' })

        Userdb.users.hasMany(Userdb.opportunities, { as: "assignedOpp", foreignKey: 'assigned_to' })
        Userdb.opportunities.belongsTo(Userdb.users, { as: "assignedOpp", foreignKey: 'assigned_to' })

        Userdb.opprStage.hasMany(Userdb.opportunities, { foreignKey: 'opportunity_stg_id' })
        Userdb.opportunities.belongsTo(Userdb.opprStage, { foreignKey: 'opportunity_stg_id' })

        Userdb.opprType.hasMany(Userdb.opportunities, { foreignKey: 'opportunity_type_id' })
        Userdb.opportunities.belongsTo(Userdb.opprType, { foreignKey: 'opportunity_type_id' })

        Userdb.leadSources.hasMany(Userdb.opportunities, { foreignKey: 'lead_src_id' })
        Userdb.opportunities.belongsTo(Userdb.leadSources, { foreignKey: 'lead_src_id' })

        /* --------------------opportunity associate end ---------------------------- */

        /* --------------------quatation master start ---------------------------- */

        Userdb.opportunities.hasMany(Userdb.quatMasters, { as: "quatOpportunityList", foreignKey: 'opp_id' })
        Userdb.quatMasters.belongsTo(Userdb.opportunities, { as: "quatOpportunity", foreignKey: 'opp_id' })

        Userdb.users.hasMany(Userdb.quatMasters, { as: "quatOwner", foreignKey: 'quat_owner' })
        Userdb.quatMasters.belongsTo(Userdb.users, { as: "quatOwner", foreignKey: 'quat_owner' })

        Userdb.users.hasMany(Userdb.quatMasters, { as: "assignedQuat", foreignKey: 'assigned_to' })
        Userdb.quatMasters.belongsTo(Userdb.users, { as: "assignedQuat", foreignKey: 'assigned_to' })

        Userdb.quatStatuses.hasMany(Userdb.quatMasters, { as: "quatStatus", foreignKey: 'quat_status' })
        Userdb.quatMasters.belongsTo(Userdb.quatStatuses, { as: "quatStatus", foreignKey: 'quat_status' })

        Userdb.country.hasMany(Userdb.quatMasters, { as: "quatCountry", foreignKey: 'bill_cont' })
        Userdb.quatMasters.belongsTo(Userdb.country, { as: "quatCountry", foreignKey: 'bill_cont' })

        Userdb.states.hasMany(Userdb.quatMasters, { as: "quatState", foreignKey: 'bill_state' })
        Userdb.quatMasters.belongsTo(Userdb.states, { as: "quatState", foreignKey: 'bill_state' })

        Userdb.city.hasMany(Userdb.quatMasters, { as: "quatCity", foreignKey: 'bill_city' })
        Userdb.quatMasters.belongsTo(Userdb.city, { as: "quatCity", foreignKey: 'bill_city' })

        Userdb.country.hasMany(Userdb.quatMasters, { as: "quatShipCountry", foreignKey: 'ship_cont' })
        Userdb.quatMasters.belongsTo(Userdb.country, { as: "quatShipCountry", foreignKey: 'ship_cont' })

        Userdb.states.hasMany(Userdb.quatMasters, { as: "quatShipState", foreignKey: 'ship_state' })
        Userdb.quatMasters.belongsTo(Userdb.states, { as: "quatShipState", foreignKey: 'ship_state' })

        Userdb.city.hasMany(Userdb.quatMasters, { as: "quatShipCity", foreignKey: 'ship_city' })
        Userdb.quatMasters.belongsTo(Userdb.city, { as: "quatShipCity", foreignKey: 'ship_city' })

        /* --------------------quatation master end ---------------------------- */

        /* --------------------quatation product start ---------------------------- */

        Userdb.products.hasMany(Userdb.quatProducts, { as: "qautProduct", foreignKey: 'p_id' })
        Userdb.quatProducts.belongsTo(Userdb.products, { as: "qautProduct", foreignKey: 'p_id' })

        /* --------------------quatation product end ---------------------------- */

        /* --------------------quatation tax start ---------------------------- */

        Userdb.products.hasMany(Userdb.quatTaxes, { as: "qautTaxProduct", foreignKey: 'p_id' })
        Userdb.quatTaxes.belongsTo(Userdb.products, { as: "qautTaxProduct", foreignKey: 'p_id' })

        /* --------------------quatation tax end ---------------------------- */

        /* --------------------role permission start ---------------------------- */

        Userdb.user_role.hasMany(Userdb.role_permissions, { foreignKey: 'role_id' })
        Userdb.role_permissions.belongsTo(Userdb.user_role, { as: "qautTaxProduct", foreignKey: 'role_id' })

        Userdb.menus.hasMany(Userdb.role_permissions, { foreignKey: 'menu_id' })
        Userdb.role_permissions.belongsTo(Userdb.menus, { foreignKey: 'menu_id' })

        /* --------------------role permission end ---------------------------- */

        /* ------------------- leave head count start ---------------------------- */

        Userdb.leaveHeads.hasMany(Userdb.leaveHeadCounts, { as: "leaveHead", foreignKey: 'head_leave_id' })
        Userdb.leaveHeadCounts.belongsTo(Userdb.leaveHeads, { as: "leaveHead", foreignKey: 'head_leave_id' })

        /* --------------------leave head count end ---------------------------- */

        /* ------------------- leave application start ---------------------------- */

        Userdb.users.hasMany(Userdb.userLeaveApps, { as: "submittedTo", foreignKey: 'report_to' })
        Userdb.userLeaveApps.belongsTo(Userdb.users, { as: "submittedTo", foreignKey: 'report_to' })

        Userdb.users.hasMany(Userdb.userLeaveApps, { as: "submittedBy", foreignKey: 'submitted_by' })
        Userdb.userLeaveApps.belongsTo(Userdb.users, { as: "submittedBy", foreignKey: 'submitted_by' })

        Userdb.leaveHeads.hasMany(Userdb.userLeaveApps, { as: "leaveType", foreignKey: 'head_leave_id' })
        Userdb.userLeaveApps.belongsTo(Userdb.leaveHeads, { as: "leaveType", foreignKey: 'head_leave_id' })

        Userdb.leaveHeadCounts.hasMany(Userdb.userLeaveApps, { foreignKey: 'head_leave_cnt_id' })
        Userdb.userLeaveApps.belongsTo(Userdb.leaveHeadCounts, { foreignKey: 'head_leave_cnt_id' })

        /* --------------------leave application end ---------------------------- */


        /* ------------------- user leave start ---------------------------- */

        Userdb.users.hasMany(Userdb.userLeaves, { foreignKey: 'user_id' })
        Userdb.userLeaves.belongsTo(Userdb.users, { foreignKey: 'user_id' })

        Userdb.leaveHeads.hasMany(Userdb.userLeaves, { foreignKey: 'head_leave_id' })
        Userdb.userLeaves.belongsTo(Userdb.leaveHeads, { foreignKey: 'head_leave_id' })

        Userdb.leaveHeadCounts.hasMany(Userdb.userLeaves, { foreignKey: 'head_leave_cnt_id' })
        Userdb.userLeaves.belongsTo(Userdb.leaveHeadCounts, { foreignKey: 'head_leave_cnt_id' })

        /* -------------------- user leave end ---------------------------- */

        /* ------------------- user attendance start ---------------------------- */
        Userdb.users.hasMany(Userdb.userAttandance, { foreignKey: 'user_id' })
        Userdb.userAttandance.belongsTo(Userdb.users, { foreignKey: 'user_id' })
        /* --------------------user attendance end ---------------------------- */

        /* ------------------- Policy Type Start  ---------------------------- */
        Userdb.policyHead.hasMany(Userdb.policyTypeHead, { foreignKey: 'policy_id' })
        Userdb.policyTypeHead.belongsTo(Userdb.policyHead, { foreignKey: 'policy_id' })
        /* ------------------- Policy Type end  ---------------------------- */

        /* ------------------- UserExpence application start ---------------------------- */

        Userdb.users.hasMany(Userdb.userExpences, { as: "ExpenceSubmittedTo", foreignKey: 'report_to' })
        Userdb.userExpences.belongsTo(Userdb.users, { as: "ExpenceSubmittedTo", foreignKey: 'report_to' })

        Userdb.users.hasMany(Userdb.userExpences, { as: "ExpenceSubmittedBy", foreignKey: 'submitted_by' })
        Userdb.userExpences.belongsTo(Userdb.users, { as: "ExpenceSubmittedBy", foreignKey: 'submitted_by' })

        Userdb.policyHead.hasMany(Userdb.userExpences, { foreignKey: 'policy_id' })
        Userdb.userExpences.belongsTo(Userdb.policyHead, { foreignKey: 'policy_id' })

        Userdb.policyTypeHead.hasMany(Userdb.userExpences, { foreignKey: 'policy_type_id' })
        Userdb.userExpences.belongsTo(Userdb.policyTypeHead, { foreignKey: 'policy_type_id' })

        /* --------------------UserExpence application end ---------------------------- */

        /* ------------------- product opportunity start ---------------------------- */

        Userdb.products.hasMany(Userdb.productOpportunity, { foreignKey: 'p_id' })
        Userdb.productOpportunity.belongsTo(Userdb.products, { foreignKey: 'p_id' })

        Userdb.opportunities.hasMany(Userdb.productOpportunity, { foreignKey: 'opp_id' })
        Userdb.productOpportunity.belongsTo(Userdb.opportunities, { foreignKey: 'opp_id' })

        /* ------------------- product opportunity end ---------------------------- */

        /* ------------------- test start ---------------------------- */

        Userdb.userExpences.hasMany(Userdb.expenceFl, { foreignKey: 'expence_by' })
        Userdb.expenceFl.belongsTo(Userdb.userExpences, { foreignKey: 'expence_by' })

        /* ------------------- test end ---------------------------- */

        /* ------------------- user Field start ---------------------------- */

        Userdb.leads.hasMany(Userdb.leadField, { foreignKey: 'lead' })
        Userdb.leadField.belongsTo(Userdb.leads, { foreignKey: 'lead' })

        /* ------------------- user Field end ---------------------------- */


        /* ------------------- account Field start ---------------------------- */

        Userdb.accounts.hasMany(Userdb.accountField, { foreignKey: 'acc_id' })
        Userdb.accountField.belongsTo(Userdb.accounts, { foreignKey: 'acc_id' })
        /* ------------------- account Field start ---------------------------- */


        /* ------------------- contact Field start ---------------------------- */

        Userdb.contacts.hasMany(Userdb.contactField, { foreignKey: 'contact_id' })
        Userdb.contactField.belongsTo(Userdb.contacts, { foreignKey: 'contact_id' })

        /* ------------------- contact Field end ---------------------------- */

        /* --------------------role permission start ---------------------------- */

        Userdb.platform.hasMany(Userdb.userPlatform, { foreignKey: 'platform_id' })
        Userdb.userPlatform.belongsTo(Userdb.platform, { foreignKey: 'platform_id' })

        Userdb.users.hasMany(Userdb.userPlatform, { foreignKey: 'user_id' })
        Userdb.userPlatform.belongsTo(Userdb.users, { foreignKey: 'user_id' })

        /* --------------------role permission end ---------------------------- */


        /* ------------------- MART WORK STARTED ---------------------------- */


        //-------martBrandModel---------//
        Userdb.users.hasMany(Userdb.martBrandModel, { as: "userBrandList", foreignKey: 'user_id' })
        Userdb.martBrandModel.belongsTo(Userdb.users, { as: "BrandUserData", foreignKey: 'user_id' })
        //-------martBrandModel---------//

        //------martStoreCategoryModel--------//
        Userdb.users.hasMany(Userdb.martStoreCategoryModel, { as: "userCategoryList", foreignKey: 'user_id' })
        Userdb.martStoreCategoryModel.belongsTo(Userdb.users, { as: "CategoryUserData", foreignKey: 'user_id' })
        //------martStoreCategoryModel--------//


        //-----martSchemeModel--------------//
        Userdb.users.hasMany(Userdb.martSchemeModel, { as: "userSchemeList", foreignKey: 'user_id' })
        Userdb.martSchemeModel.belongsTo(Userdb.users, { as: "SchemeUserData", foreignKey: 'user_id' })
        //-----martSchemeModel--------------//

        //-----mart Cart Model--------------//
        Userdb.dmsCart.belongsTo(Userdb.users, { as: "userData", foreignKey: "user_id", });
        Userdb.users.hasMany(Userdb.dmsCart, { as: "userCartList", foreignKey: "user_id" });

        Userdb.dmsCart.belongsTo(Userdb.products, { as: "productData", foreignKey: "product_id", });
        Userdb.products.hasMany(Userdb.dmsCart, { as: "productCartList", foreignKey: "product_id" });

        //-----mart Cart Model end --------------//

        //-----mart Order Model--------------//
        Userdb.users.hasMany(Userdb.dmsOrder, { as: "orderList", foreignKey: "user_id" });
        Userdb.dmsOrder.belongsTo(Userdb.users, { as: "orderuserData", foreignKey: "user_id", });
        //-----mart Order Model end --------------//


        //-----mart Order Item Model--------------//
        Userdb.dmsOrder.hasMany(Userdb.dmsOrderItems, { as: "orderItemList", foreignKey: "o_id" });
        Userdb.dmsOrderItems.belongsTo(Userdb.dmsOrder, { as: "orderData", foreignKey: "o_id", });

        Userdb.products.hasMany(Userdb.dmsOrderItems, { as: "orderProductList", foreignKey: "p_id" });
        Userdb.dmsOrderItems.belongsTo(Userdb.products, { as: "OrderProductData", foreignKey: "p_id", });
        //-----mart Order Model end --------------//

        /* ------------------- CHANNEL WORK STARTED ---------------------------- */

        Userdb.channelProject.hasMany(Userdb.leads, { foreignKey: 'project_id', as: 'projectLead' })
        Userdb.leads.belongsTo(Userdb.channelProject, { foreignKey: 'project_id', as: 'projectData' })

        Userdb.leads.hasMany(Userdb.leadVisit, { foreignKey: 'lead_id', as: 'visitList' })
        Userdb.leadVisit.belongsTo(Userdb.leads, { foreignKey: 'lead_id', as: 'leadData' })

        Userdb.leads.hasMany(Userdb.leadBooking, { foreignKey: 'lead_id', as: 'BookingLeadList' })
        Userdb.leadBooking.belongsTo(Userdb.leads, { foreignKey: 'lead_id', as: 'BookingleadData' })

        Userdb.channelProject.hasMany(Userdb.leadBooking, { foreignKey: 'project_id', as: 'BookingprojectList' })
        Userdb.leadBooking.belongsTo(Userdb.channelProject, { foreignKey: 'project_id', as: 'BookingprojectData' })

        Userdb.leadBooking.hasMany(Userdb.leadBrokerage, { foreignKey: 'booking_id', as: 'BrokerageBookingList' })
        Userdb.leadBrokerage.belongsTo(Userdb.leadBooking, { foreignKey: 'booking_id', as: 'BrokerageBookingtData' })

        Userdb.leads.hasMany(Userdb.leadBrokerage, { foreignKey: 'lead_id', as: 'BrokerageLeadList' })
        Userdb.leadBrokerage.belongsTo(Userdb.leads, { foreignKey: 'lead_id', as: 'BrokerageLeadData' })

        Userdb.users.hasMany(Userdb.userProjectModel, { foreignKey: 'created_by', as: 'userProjectList' })
        Userdb.userProjectModel.belongsTo(Userdb.users, { foreignKey: 'created_by', as: 'projectUserData' })

        Userdb.channelProject.hasMany(Userdb.userProjectModel, { foreignKey: 'project_id', as: 'channelProjectList' })
        Userdb.userProjectModel.belongsTo(Userdb.channelProject, { foreignKey: 'project_id', as: 'channelProjectData' })

        /* ------------------- CHANNEL WORK Ended ---------------------------- */

        Userdb.users.hasOne(Userdb.channelPartnerType, { foreignKey: 'cpt_id' })
        Userdb.channelPartnerType.belongsTo(Userdb.users, { foreignKey: 'cpt_id' })

        Userdb.opportunities.hasMany(Userdb.opportunityField, { foreignKey: 'opportunity' })
        Userdb.opportunityField.belongsTo(Userdb.opportunities, { foreignKey: 'opportunity' })

        Userdb.users.hasMany(Userdb.userFieldModel, { foreignKey: 'user' })
        Userdb.userFieldModel.belongsTo(Userdb.users, { foreignKey: 'user' })

        /* ------------------- MEDIA WORK STARTED ---------------------------- */

        Userdb.mediaFormat.hasMany(Userdb.mediaVehicle, { foreignKey: 'm_f_id' })
        Userdb.mediaVehicle.belongsTo(Userdb.mediaFormat, { foreignKey: 'm_f_id' })

        Userdb.siteCategories.hasMany(Userdb.sites, { foreignKey: 'site_cat_id' })
        Userdb.sites.belongsTo(Userdb.siteCategories, { foreignKey: 'site_cat_id' })

        Userdb.mediaVehicle.hasMany(Userdb.sites, { foreignKey: 'm_v_id' })
        Userdb.sites.belongsTo(Userdb.mediaVehicle, { foreignKey: 'm_v_id' })

        Userdb.mediaFormat.hasMany(Userdb.sites, { foreignKey: 'm_f_id' })
        Userdb.sites.belongsTo(Userdb.mediaFormat, { foreignKey: 'm_f_id' })

        Userdb.mediaType.hasMany(Userdb.sites, { foreignKey: 'm_t_id' })
        Userdb.sites.belongsTo(Userdb.mediaType, { foreignKey: 'm_t_id' })

        Userdb.siteStatus.hasMany(Userdb.sites, { foreignKey: 's_s_id' })
        Userdb.sites.belongsTo(Userdb.siteStatus, { foreignKey: 's_s_id' })

        Userdb.rating.hasMany(Userdb.sites, { foreignKey: 'rating_id' })
        Userdb.sites.belongsTo(Userdb.rating, { foreignKey: 'rating_id' })

        Userdb.availabiltyStatus.hasMany(Userdb.sites, { foreignKey: 'a_s_id' })
        Userdb.sites.belongsTo(Userdb.availabiltyStatus, { foreignKey: 'a_s_id' })

        Userdb.country.hasMany(Userdb.sites, { foreignKey: 'country_id' })
        Userdb.sites.belongsTo(Userdb.country, { foreignKey: 'country_id' })

        Userdb.states.hasMany(Userdb.sites, { foreignKey: 'state_id' })
        Userdb.sites.belongsTo(Userdb.states, { foreignKey: 'state_id' })

        Userdb.city.hasMany(Userdb.sites, { foreignKey: 'city_id' })
        Userdb.sites.belongsTo(Userdb.city, { foreignKey: 'city_id' })

        Userdb.accounts.hasMany(Userdb.sites, { foreignKey: 'acc_id' })
        Userdb.sites.belongsTo(Userdb.accounts, { foreignKey: 'acc_id' })

        Userdb.leadTypes.hasMany(Userdb.leads, { foreignKey: 'lead_type_id' })  //adding lead type in leads
        Userdb.leads.belongsTo(Userdb.leadTypes, { foreignKey: 'lead_type_id' })

        Userdb.leadTypes.hasMany(Userdb.leads, { foreignKey: 'lead_type_id' })  //adding lead type in leads
        Userdb.leads.belongsTo(Userdb.leadTypes, { foreignKey: 'lead_type_id' })

        Userdb.accounts.hasMany(Userdb.mountingCost, { foreignKey: 'acc_id' })
        Userdb.mountingCost.belongsTo(Userdb.accounts, { foreignKey: 'acc_id' })

        Userdb.mediaType.hasMany(Userdb.mountingCost, { foreignKey: 'm_t_id' })
        Userdb.mountingCost.belongsTo(Userdb.mediaType, { foreignKey: 'm_t_id' })

        Userdb.mediaType.hasMany(Userdb.printingCost, { foreignKey: 'm_t_id' })
        Userdb.printingCost.belongsTo(Userdb.mediaType, { foreignKey: 'm_t_id' })

        Userdb.accounts.hasMany(Userdb.printingCost, { foreignKey: 'acc_id' })
        Userdb.printingCost.belongsTo(Userdb.accounts, { foreignKey: 'acc_id' })

        Userdb.printingMaterial.hasMany(Userdb.printingCost, { foreignKey: 'pr_m_id' })
        Userdb.printingCost.belongsTo(Userdb.printingMaterial, { foreignKey: 'pr_m_id' })

        Userdb.accounts.hasMany(Userdb.mediaCampaignManagement, { foreignKey: 'acc_id' })
        Userdb.mediaCampaignManagement.belongsTo(Userdb.accounts, { foreignKey: 'acc_id' })

        Userdb.campaignStatus.hasMany(Userdb.mediaCampaignManagement, { foreignKey: 'cmpn_s_id' })
        Userdb.mediaCampaignManagement.belongsTo(Userdb.campaignStatus, { foreignKey: 'cmpn_s_id' })

        Userdb.campaignProof.hasMany(Userdb.mediaCampaignManagement, { foreignKey: 'cmpn_p_id' })
        Userdb.mediaCampaignManagement.belongsTo(Userdb.campaignProof, { foreignKey: 'cmpn_p_id' })

        Userdb.campaignBusinessType.hasMany(Userdb.mediaCampaignManagement, { foreignKey: 'cmpn_b_t_id' })
        Userdb.mediaCampaignManagement.belongsTo(Userdb.campaignBusinessType, { foreignKey: 'cmpn_b_t_id' })

        Userdb.mediaCampaignManagement.hasMany(Userdb.estimations, { foreignKey: 'campaign_id' })
        Userdb.estimations.belongsTo(Userdb.mediaCampaignManagement, { foreignKey: 'campaign_id' })

        Userdb.estimateStatus.hasMany(Userdb.estimations, { foreignKey: 'est_s_id', as: 'estimateStatus' })
        Userdb.estimations.belongsTo(Userdb.estimateStatus, { foreignKey: 'est_s_id', as: 'estimateStatus' })

        Userdb.sites.hasMany(Userdb.estimationForAssetBusiness, { foreignKey: 'site_id' })
        Userdb.estimationForAssetBusiness.belongsTo(Userdb.sites, { foreignKey: 'site_id' })

        Userdb.estimations.hasMany(Userdb.estimationForAssetBusiness, { foreignKey: 'estimate_id' })
        Userdb.estimationForAssetBusiness.belongsTo(Userdb.estimations, { foreignKey: 'estimate_id' })

        Userdb.estimations.hasMany(Userdb.sitesForAgencyEstimates, { foreignKey: 'estimate_id' })
        Userdb.sitesForAgencyEstimates.belongsTo(Userdb.estimations, { foreignKey: 'estimate_id' })

        Userdb.sites.hasMany(Userdb.assetClientCostSheet, { foreignKey: 'site_id' })
        Userdb.assetClientCostSheet.belongsTo(Userdb.sites, { foreignKey: 'site_id' })

        Userdb.estimationForAssetBusiness.hasMany(Userdb.assetClientCostSheet, { foreignKey: 'eab_id' })
        Userdb.assetClientCostSheet.belongsTo(Userdb.estimationForAssetBusiness, { foreignKey: 'eab_id' })

        Userdb.mediaCampaignManagement.hasMany(Userdb.assetClientCostSheet, { foreignKey: 'campaign_id' })
        Userdb.assetClientCostSheet.belongsTo(Userdb.mediaCampaignManagement, { foreignKey: 'campaign_id' })

        Userdb.sitesForAgencyEstimates.hasMany(Userdb.agencyClientCostSheet, { foreignKey: 'site_id' })
        Userdb.agencyClientCostSheet.belongsTo(Userdb.sitesForAgencyEstimates, { foreignKey: 'site_id' })

        Userdb.estimations.hasMany(Userdb.agencyClientCostSheet, { foreignKey: 'estimate_id' })
        Userdb.agencyClientCostSheet.belongsTo(Userdb.estimations, { foreignKey: 'estimate_id' })

        Userdb.mediaCampaignManagement.hasMany(Userdb.agencyClientCostSheet, { foreignKey: 'campaign_id' })
        Userdb.agencyClientCostSheet.belongsTo(Userdb.mediaCampaignManagement, { foreignKey: 'campaign_id' })

        Userdb.sites.hasMany(Userdb.assetVendorCostSheet, { foreignKey: 'site_id' })
        Userdb.assetVendorCostSheet.belongsTo(Userdb.sites, { foreignKey: 'site_id' })

        Userdb.estimationForAssetBusiness.hasMany(Userdb.assetVendorCostSheet, { foreignKey: 'eab_id' })
        Userdb.assetVendorCostSheet.belongsTo(Userdb.estimationForAssetBusiness, { foreignKey: 'eab_id' })

        Userdb.estimations.hasMany(Userdb.assetVendorCostSheet, { foreignKey: 'estimate_id' })
        Userdb.assetVendorCostSheet.belongsTo(Userdb.estimations, { foreignKey: 'estimate_id' })

        Userdb.mediaCampaignManagement.hasMany(Userdb.assetVendorCostSheet, { foreignKey: 'campaign_id' })
        Userdb.assetVendorCostSheet.belongsTo(Userdb.mediaCampaignManagement, { foreignKey: 'campaign_id' })

        Userdb.printingMaterial.hasMany(Userdb.assetVendorCostSheet, { foreignKey: 'pr_m_id' })
        Userdb.assetVendorCostSheet.belongsTo(Userdb.printingMaterial, { foreignKey: 'pr_m_id' })

        Userdb.accounts.hasMany(Userdb.assetVendorCostSheet, { foreignKey: 'printing_vendor_id', as: 'printingVendor' });
        Userdb.assetVendorCostSheet.belongsTo(Userdb.accounts, { foreignKey: 'printing_vendor_id', as: 'printingVendor' });

        Userdb.accounts.hasMany(Userdb.assetVendorCostSheet, { foreignKey: 'mounting_vendor_id', as: 'mountingVendor' });
        Userdb.assetVendorCostSheet.belongsTo(Userdb.accounts, { foreignKey: 'mounting_vendor_id', as: 'mountingVendor' });

        // Userdb.sites.hasMany(Userdb.agencyVendorCostSheet, { foreignKey: 'site_id' })
        // Userdb.agencyVendorCostSheet.belongsTo(Userdb.sites, { foreignKey: 'site_id' })

        Userdb.sitesForAgencyEstimates.hasMany(Userdb.agencyVendorCostSheet, { foreignKey: 'site_id' })
        Userdb.agencyVendorCostSheet.belongsTo(Userdb.sitesForAgencyEstimates, { foreignKey: 'site_id' })

        Userdb.estimations.hasMany(Userdb.agencyVendorCostSheet, { foreignKey: 'estimate_id' })
        Userdb.agencyVendorCostSheet.belongsTo(Userdb.estimations, { foreignKey: 'estimate_id' })

        Userdb.mediaCampaignManagement.hasMany(Userdb.agencyVendorCostSheet, { foreignKey: 'campaign_id' })
        Userdb.agencyVendorCostSheet.belongsTo(Userdb.mediaCampaignManagement, { foreignKey: 'campaign_id' })

        Userdb.printingMaterial.hasMany(Userdb.agencyVendorCostSheet, { foreignKey: 'pr_m_id' })
        Userdb.agencyVendorCostSheet.belongsTo(Userdb.printingMaterial, { foreignKey: 'pr_m_id' })

        Userdb.accounts.hasMany(Userdb.agencyVendorCostSheet, { foreignKey: 'printing_vendor_id', as: 'printingVendorAgency' });
        Userdb.agencyVendorCostSheet.belongsTo(Userdb.accounts, { foreignKey: 'printing_vendor_id', as: 'printingVendorAgency' });

        Userdb.accounts.hasMany(Userdb.agencyVendorCostSheet, { foreignKey: 'mounting_vendor_id', as: 'mountingVendorAgency' });
        Userdb.agencyVendorCostSheet.belongsTo(Userdb.accounts, { foreignKey: 'mounting_vendor_id', as: 'mountingVendorAgency' });

        Userdb.accounts.hasMany(Userdb.agencyVendorCostSheet, { foreignKey: 'display_vendor_id', as: 'displayVendorAgency' });
        Userdb.agencyVendorCostSheet.belongsTo(Userdb.accounts, { foreignKey: 'display_vendor_id', as: 'displayVendorAgency' });

        Userdb.sites.hasMany(Userdb.siteBookingHistory, { foreignKey: 'site_id' });
        Userdb.siteBookingHistory.belongsTo(Userdb.sites, { foreignKey: 'site_id' });

        Userdb.mediaCampaignManagement.hasMany(Userdb.siteBookingHistory, { foreignKey: 'campaign_id' });
        Userdb.siteBookingHistory.belongsTo(Userdb.mediaCampaignManagement, { foreignKey: 'campaign_id' });

        Userdb.estimations.hasMany(Userdb.siteBookingHistory, { foreignKey: 'estimate_id' });
        Userdb.siteBookingHistory.belongsTo(Userdb.estimations, { foreignKey: 'estimate_id' });

        Userdb.assetClientCostSheet.hasMany(Userdb.siteBookingHistory, { foreignKey: 'ccs_id' });
        Userdb.siteBookingHistory.belongsTo(Userdb.assetClientCostSheet, { foreignKey: 'ccs_id' });

        Userdb.assetVendorCostSheet.hasMany(Userdb.siteBookingHistory, { foreignKey: 'vcs_id' });
        Userdb.siteBookingHistory.belongsTo(Userdb.assetVendorCostSheet, { foreignKey: 'vcs_id' });

        Userdb.mediaCampaignManagement.hasMany(Userdb.purchaseOrders, { foreignKey: 'campaign_id' });
        Userdb.purchaseOrders.belongsTo(Userdb.mediaCampaignManagement, { foreignKey: 'campaign_id' });

        Userdb.accounts.hasMany(Userdb.purchaseOrders, { foreignKey: 'acc_id' });
        Userdb.purchaseOrders.belongsTo(Userdb.accounts, { foreignKey: 'acc_id' });

        Userdb.accountTypes.hasMany(Userdb.purchaseOrders, { foreignKey: 'account_type_id' });
        Userdb.purchaseOrders.belongsTo(Userdb.accountTypes, { foreignKey: 'account_type_id' });

        Userdb.mediaType.hasMany(Userdb.purchaseOrders, { foreignKey: 'm_t_id' });
        Userdb.purchaseOrders.belongsTo(Userdb.mediaType, { foreignKey: 'm_t_id' });

        Userdb.country.hasMany(Userdb.organisationInfo, { foreignKey: 'country_id' });
        Userdb.organisationInfo.belongsTo(Userdb.country, { foreignKey: 'country_id' });

        Userdb.states.hasMany(Userdb.organisationInfo, { foreignKey: 'state_id' });
        Userdb.organisationInfo.belongsTo(Userdb.states, { foreignKey: 'state_id' });

        Userdb.city.hasMany(Userdb.organisationInfo, { foreignKey: 'city_id' });
        Userdb.organisationInfo.belongsTo(Userdb.city, { foreignKey: 'city_id' });

        Userdb.platform.hasMany(Userdb.emailTemplates, { foreignKey: 'platform_id' })
        Userdb.emailTemplates.belongsTo(Userdb.platform, { foreignKey: 'platform_id' })

        /* ------------------- MEDIA WORK ENDED ---------------------------- */

        await Userdb.sequelize.sync({ alter: true });
        console.log("DB for user has been re-synced");

        const currentUser = await Userdb.users.findByPk(decoded.id);
        if (!currentUser) return responseError(req, res, "user not found");

        const adminUser = await Userdb.users.findOne({
          where: { isDB: true },
          attributes: ['user', 'user_l_name', 'client_url', 'db_name']
        });

        tenants[clientUser.user_code] = {
          instance: Userdb,
          lastAccess: Date.now(),
          user: currentUser.dataValues,
          admin: adminUser
        };

        // Start cron jobs
        let cronJob = cron.schedule('* * * * *', async () => assignLeadsRoundRobin(Userdb));
        cronJob.start();
        let cronJobForPendingLeads = cron.schedule('* * * * *', async () => sendMailToLeadOwners(Userdb)); // Every 1 minute
        cronJobForPendingLeads.start();
        let cronJobForPendingCPs = cron.schedule('* * * * *', async () => sendMailToReportTos(Userdb)); // Every 1 minute
        cronJobForPendingCPs.start();

      } catch (error) {
        console.log(error);
        logErrorToFile(error);
        return res.status(500).json({ message: "Connection Error!" });
      } finally {
        // Release the lock
        connectionLocks[decoded.user_code] = false;
      }
    } else {
      tenants[clientUser.user_code].lastAccess = Date.now();
    }

    req.config = tenants[clientUser.user_code].instance;
    req.user = tenants[clientUser.user_code].user;
    req.admin = tenants[clientUser.user_code].admin;

    next();

  } catch (error) {
    logErrorToFile(error);
    console.log(error);
    res.status(400).json({ message: error });
  }
};

exports.tenantsObj = tenants;
