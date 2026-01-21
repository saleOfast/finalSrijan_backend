const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const dbConfig = require("../config/db.config.js");

exports.first = async (db_name, req, res) => {
  try {
    // for our home server
    const sequelize2 = new Sequelize(
      db_name, dbConfig.USER, dbConfig.PASSWORD,
      {
        host: dbConfig.HOST || 'localhost',
        dialect: "mysql",
        port: dbConfig.PORT,
        logging: false,
        timezone: "+05:30", dialectOptions: {
          // useUTC: false, //for reading from database
          dateStrings: true,
          typeCast: true,
          timezone: "+05:30",
          connectTimeout: 10000 // 10 seconds in milliseconds
        }, pool: {
          max: dbConfig.pool.max,
          min: dbConfig.pool.min,
          acquire: dbConfig.pool.acquire,
          idle: dbConfig.pool.idle
        }
      }
    );
    // for current server
    // const sequelize2 = new Sequelize(db_name, db_name, dbConfig.PASSWORD, {
    //     host: "localhost",
    //     dialect: "mysql",
    //     logging: false,
    //     timezone: "+05:30",
    //     pool: {
    //       max: dbConfig.pool.max,
    //       min: dbConfig.pool.min,
    //       acquire: dbConfig.pool.acquire,
    //       idle: dbConfig.pool.idle,
    //     },
    //   });

    await sequelize2.authenticate();
    console.log("tenant DB Connected");

    const Userdb = {};
    Userdb.Sequelize = Sequelize;
    Userdb.sequelize = sequelize2;

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


    Userdb.estimationType = require("../model/media/estimationTypeModel.js")(sequelize2, DataTypes);
    Userdb.NDPReason = require("../model/media/ndpReasonModel.js")(sequelize2, DataTypes);
    Userdb.jobCards = require("../model/media/jobCardModel.js")(sequelize2, DataTypes);

    Userdb.paymentStatus = require("../model/media/paymentStatusModel.js")(sequelize2, DataTypes);
    Userdb.conversionPercentage = require("../model/media/conversionModel.js")(sequelize2, DataTypes);

    Userdb.cplDetails = require("../model/contactUsLeadsDetailsModel.js")(sequelize2, DataTypes)
    Userdb.salesOrder = require("../model/media/salesOrderModel.js")(sequelize2, DataTypes)

    Userdb.estimations = require("../model/media/estimationModel.js")(sequelize2, DataTypes);//Agency

    Userdb.ndp = require("../model/media/ndpModel.js")(sequelize2, DataTypes);
    Userdb.estimateStatus = require("../model/media/estimateStatusModel.js")(sequelize2, DataTypes);
    Userdb.emailTemplates = require("../model/emailTemplatesModel.js")(sequelize2, DataTypes);

    try {
      await Userdb.sequelize.sync({ alter: false });
      console.log(`db synced for first time: ${db_name}`);
    } catch (error) {
      logErrorToFile(error);
      console.error(`Error syncing database ${db_name}:`, error);
      // Re-throw error so caller knows sync failed
      throw error;
    }
    return Userdb;
  } catch (error) {
    logErrorToFile(error)
    console.log(error);
    return { status: 400, message: error };
  }
};
