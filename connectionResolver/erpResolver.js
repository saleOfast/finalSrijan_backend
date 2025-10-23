const { Sequelize, DataTypes } = require("sequelize");
const masterDb = require("../model");
const dbConfig = require("../config/db.config.js");
const { responseError } = require("../helper/responce.js");

const tenants = {};
const connectionLocks = {};

module.exports = async function erpResolver(req, res, next) {
  try {
    const clientCode = req.headers["x-client-code"] || req.headers["x-tenant-code"];
    if (!clientCode) return responseError(req, res, "Missing x-client-code header");

    const clientUser = await masterDb.clients.findOne({ where: { user_code: clientCode } });
    if (!clientUser) return responseError(req, res, "Invalid client code");

    const tenantKey = clientUser.db_name;

    if (connectionLocks[tenantKey]) {
      while (connectionLocks[tenantKey]) {
        // simple spin-wait
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    if (!tenants[tenantKey]) {
      connectionLocks[tenantKey] = true;
      try {
        const sequelize2 = new Sequelize(
          clientUser.db_name,
          dbConfig.USER,
          dbConfig.PASSWORD,
          {
            host: dbConfig.HOST || "localhost",
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

        const Userdb = {};
        Userdb.Sequelize = Sequelize;
        Userdb.sequelize = sequelize2;
        // Minimal models needed for lead create
        Userdb.users = require("../model/userModel.js")(sequelize2, DataTypes);
        Userdb.leads = require("../model/leadModel.js")(sequelize2, DataTypes);
        Userdb.emailTemplates = require("../model/emailTemplatesModel.js")(sequelize2, DataTypes);
        Userdb.organisationInfo = require("../model/organisationInfo.js")(sequelize2, DataTypes);
        Userdb.emailConfig = require("../model/emailConfigModel.js")(sequelize2, DataTypes);
        Userdb.leadBooking = require("../model/channel/bookingModel.js")(sequelize2, DataTypes);

        // Foreign key reference models used by leads
        Userdb.leadTypes = require("../model/leadTypeModel.js")(sequelize2, DataTypes);
        Userdb.leadSources = require("../model/leadSourceModel.js")(sequelize2, DataTypes);
        Userdb.leadStatuses = require("../model/leadStatusModel.js")(sequelize2, DataTypes);
        Userdb.leadStages = require("../model/leadStageModel.js")(sequelize2, DataTypes);
        Userdb.channelProject = require("../model/channel/projectModel.js")(sequelize2, DataTypes);

        await Userdb.sequelize.sync({ alter: false });

        const adminUser = await Userdb.users.findOne({ where: { isDB: true }, attributes: ["user_id", "user", "user_l_name", "client_url", "db_name"] });

        tenants[tenantKey] = { instance: Userdb, admin: adminUser, lastAccess: Date.now() };
      } catch (error) {
        logErrorToFile(error);
        return responseError(req, res, "Tenant DB connection failed");
      } finally {
        connectionLocks[tenantKey] = false;
      }
    } else {
      tenants[tenantKey].lastAccess = Date.now();
    }

    req.config = tenants[tenantKey].instance;
    req.admin = tenants[tenantKey].admin || {};
    // For ERP, impersonate admin as current user if present
    if (req.admin && req.admin.user_id) {
      req.user = { user_id: req.admin.user_id, user: req.admin.user, user_l_name: req.admin.user_l_name, role_id: 2, isDB: true };
    } else {
      req.user = { user_id: null, user: "ERP", user_l_name: "", role_id: null, isDB: false };
    }

    next();
  } catch (error) {
    logErrorToFile(error);
    return responseError(req, res, "Resolver error");
  }
}

module.exports.tenantsObj = tenants;


