/**
 * Sequelize CLI config. For multi-tenant setups, set TENANT_DB to the target database name before migrating.
 */
require("dotenv").config();
const dbConfig = require("./db.config.js");

const base = {
  username: dbConfig.USER,
  password: dbConfig.PASSWORD,
  host: dbConfig.HOST,
  port: dbConfig.PORT,
  dialect: dbConfig.dialect || "mysql",
  dialectOptions: dbConfig.dialectOptions,
  timezone: dbConfig.timezone,
  logging: false,
};

module.exports = {
  development: {
    ...base,
    database: process.env.TENANT_DB || dbConfig.DB,
  },
};
