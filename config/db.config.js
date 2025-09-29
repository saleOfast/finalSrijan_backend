// module.exports = {
//     HOST: "localhost",
//     PORT: "3306",
//     USER: "root",
//     PASSWORD: "",
//     DB: "your_daily_crm",
//     dialect: "mysql",
//     dialectOptions: {
//         // useUTC: false, //for reading from database
//         dateStrings: true,
//         typeCast: true,
//         timezone: "+05:30"
//     },
//     timezone: "+05:30", //for writing to database
//     pool: {
//         max: 100,
//         min: 0,
//         acquire: 30000,
//         idle: 180000
//     }
// };

// for client server NK Realtors

// module.exports = {
//       HOST: "localhost",
//       PORT: "3306",
//       USER: "daily_crm",
//       PASSWORD: "qT:WWrak5j:#[eaT",
//       DB: "daily_crm",
//       dialect: "mysql",
//       dialectOptions: {
//           // useUTC: false, //for reading from database
//           dateStrings: true,
//           typeCast: true,
//           timezone: "+05:30"
//         },
//         timezone: "+05:30", //for writing to database
//       pool: {
//           max: 100,
//           min: 0,
//           acquire: 30000,
//           idle: 10000
//         }
// }

// NK Realtors Server

// module.exports = {
//     HOST: "10.124.3.253",
//     PORT: "3336",
//     USER: "dbadmin",
//     PASSWORD: "wN0J-%Kv3kR*H3ypcrbj",
//     DB: "daily_crm",
//     dialect: "mysql",
//     dialectOptions: {
//         // useUTC: false, //for reading from database
//         dateStrings: true,
//         typeCast: true,
//         timezone: "+05:30",
//         connectTimeout: 60000
//     },
//     timezone: "+05:30", //for writing to database
//     pool: {
//         max: 100,
//         min: 0,
//         acquire: 30000,
//         idle: 180000
//     }
// };



// local database


module.exports = {
    HOST: "127.0.0.1",
    PORT: "3306",
    USER: "root",
    PASSWORD: "Admin@0676",
    DB: "daily_crm",
    dialect: "mysql",
    dialectOptions: {
        dateStrings: true,
        typeCast: true,
        timezone: "+05:30"
    },
    timezone: "+05:30",
    pool: {
        max: 100,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
};
