const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const dbConfig = require("../config/db.config.js");

exports.first_small = async (db_name, req, res) => {
  try {
    // for our home server
    const sequelize2 = new Sequelize(db_name, dbConfig.USER, dbConfig.PASSWORD, {
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

    await sequelize2.authenticate();
    console.log("tenant DB Connected");

    const Userdb = {};
    Userdb.Sequelize = Sequelize;
    Userdb.sequelize = sequelize2;

    Userdb.users = require("../model/userModel")(sequelize2, DataTypes);
    Userdb.usersProfiles = require("../model/userProfileModel")(sequelize2, DataTypes);
    Userdb.platform = require("../model/platformModel.js")(sequelize2, DataTypes);
    Userdb.userPlatform = require("../model/userPlatformModel.js")(sequelize2, DataTypes);
    Userdb.menus = require("../model/menuModel")(sequelize2, DataTypes);

    try {
      await Userdb.sequelize.sync({ alter: false });
      console.log("db synced for first time");
    } catch (error) {
      console.log("Ignoring error");
      console.log(error);
    }
    return Userdb;
  } catch (error) {
    logErrorToFile(error)
    console.log(error);
    return { status: 400, message: error };
  }
};
