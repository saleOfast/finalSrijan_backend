const { Sequelize, DataTypes, Op } = require("sequelize");
const masterDb = require("../model");
const dbConfig = require("../config/db.config.js");
const { responseError } = require("../helper/responce.js");

const tenants = {};
const connectionLocks = {};

module.exports = async function erpResolver(req, res, next) {
  try {
    let clientCode = req.headers["x-client-code"] || req.headers["x-tenant-code"];
    if (!clientCode) {
      console.log("[ERP Resolver] Missing x-client-code header. Received headers:", Object.keys(req.headers));
      return responseError(req, res, "Missing x-client-code header. Please include 'x-client-code' header in your request.");
    }

    // Trim whitespace from client code
    clientCode = clientCode.trim();
    console.log(`[ERP Resolver] Looking up client with user_code: '${clientCode}' (length: ${clientCode.length})`);

    // First try exact match
    let clientUser = await masterDb.clients.findOne({ 
      where: { user_code: clientCode },
      attributes: ['user_id', 'user_code', 'user', 'email', 'db_name']
    });

    // If not found, try case-insensitive search
    if (!clientUser) {
      console.log(`[ERP Resolver] Exact match not found, trying case-insensitive search...`);
      clientUser = await masterDb.clients.findOne({ 
        where: { 
          user_code: { [Op.like]: clientCode }
        },
        attributes: ['user_id', 'user_code', 'user', 'email', 'db_name']
      });
    }

    if (!clientUser) {
      console.log(`[ERP Resolver] Client code '${clientCode}' not found in database.`);

      // NOTE: We only log debug info on the server side now.
      // The API response to ERP will be a simple error message without suggesting codes.
      try {
        const availableClients = await masterDb.clients.findAll({ 
          where: {
            user_code: { 
              [Op.ne]: null,
              [Op.ne]: ''
            }
          },
          attributes: ['user_code', 'user', 'email'],
          limit: 50,
          order: [['user_id', 'DESC']]
        });
        const totalClients = await masterDb.clients.count();
        const clientsWithCode = await masterDb.clients.count({
          where: {
            user_code: { 
              [Op.ne]: null,
              [Op.ne]: ''
            }
          }
        });
        const clientCodes = availableClients.map(c => c.user_code).filter(code => code);
        console.log(`[ERP Resolver] Available client codes (${clientCodes.length} of ${clientsWithCode} total with codes, ${totalClients} total clients):`, clientCodes);
      } catch (debugError) {
        console.log("[ERP Resolver] Failed to fetch debug client code list:", debugError.message);
      }
      
      return responseError(
        req,
        res,
        `Invalid client code '${clientCode}'. Please verify the x-client-code header matches an existing client's user_code.`
      );
    }
    
    console.log(`[ERP Resolver] Client found: ${clientUser.user} (user_code: '${clientUser.user_code}', db_name: ${clientUser.db_name})`);

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


