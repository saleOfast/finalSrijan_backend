const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const dbConfig = require("../config/db.config.js");

exports.middle = async (db_name, req, res) => {
  try {
    // for our home server
    const sequelize2 = new Sequelize(db_name, dbConfig.USER, dbConfig.PASSWORD, {
      host: dbConfig.HOST,
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

    Userdb.channelPartnerType = require("../model/channelPartnerType.js")(sequelize2, DataTypes);
    Userdb.user_role = require("../model/userRoleModel")(sequelize2, DataTypes);
    Userdb.users = require("../model/userModel")(sequelize2, DataTypes);
    Userdb.menus = require("../model/menuModel")(sequelize2, DataTypes);
    Userdb.role_permissions = require("../model/rolePermissionModel")(sequelize2, DataTypes);
    Userdb.usersProfiles = require("../model/userProfileModel")(sequelize2, DataTypes);
    Userdb.platform = require("../model/platformModel.js")(sequelize2, DataTypes);
    Userdb.userPlatform = require("../model/userPlatformModel.js")(sequelize2, DataTypes);


    // associate
    Userdb.users.hasOne(Userdb.usersProfiles, { foreignKey: 'user_id' })
    Userdb.usersProfiles.belongsTo(Userdb.users, { foreignKey: 'user_id' })

    Userdb.user_role.hasOne(Userdb.users, { foreignKey: 'role_id' })
    Userdb.users.belongsTo(Userdb.user_role, { foreignKey: 'role_id' })

    Userdb.users.hasOne(Userdb.users, { foreignKey: 'report_to', as: 'reportToUser' });

    /* --------------------role permission start ---------------------------- */

    Userdb.user_role.hasMany(Userdb.role_permissions, { foreignKey: 'role_id' })
    Userdb.role_permissions.belongsTo(Userdb.user_role, { as: "qautTaxProduct", foreignKey: 'role_id' })

    Userdb.menus.hasMany(Userdb.role_permissions, { foreignKey: 'menu_id' })
    Userdb.role_permissions.belongsTo(Userdb.menus, { foreignKey: 'menu_id' })

    /* --------------------role permission end ---------------------------- */


    /* --------------------role permission start ---------------------------- */

    Userdb.platform.hasMany(Userdb.userPlatform, { foreignKey: 'platform_id' })
    Userdb.userPlatform.belongsTo(Userdb.platform, { foreignKey: 'platform_id' })

    Userdb.users.hasMany(Userdb.userPlatform, { foreignKey: 'user_id' })
    Userdb.userPlatform.belongsTo(Userdb.users, { foreignKey: 'user_id' })

    /* --------------------role permission end ---------------------------- */


    /* ------------------- MART WORK STARTED ---------------------------- */

    try {
      await Userdb.sequelize.sync({ alter: false });
      console.log("DB for user has been re-synced");
    } catch (error) {
      if (error.name === 'SequelizeUnknownConstraintError') {
        console.log(`Ignoring error: ${error}`);
      } else {
        logErrorToFile(error)
        console.log(error);
      }
    }
    return Userdb;
  } catch (error) {
    logErrorToFile(error)
    console.log(error);
    return { status: 400, message: error };
  }
};
