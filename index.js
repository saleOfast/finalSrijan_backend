const express = require("express");
const cors = require("cors");
const cluster = require("cluster");
const os = require("os");
const bodyParser = require("body-parser");
require('dotenv').config();
const PORT = process.env.PORT || 3000;
const cookieParser = require("cookie-parser");
const fileUpload = require("express-fileupload");
const errorLogger = require('./helper/errorLogger')
const { createFolder } = require("./common/createFolder");
const { tenantsObj } = require("./connectionResolver/resolver")
// const config = require(`./config/${process.env.NODE_ENV || 'development'}`);

const db = require("./model");
const dbRoute = require("./routes/dbRoute");
const divisionRoute = require("./routes/divisionRoute");
const designationRoute = require("./routes/designationRoute");
const departmentRoute = require("./routes/departmentRoute");
const AreaRoutes = require("./routes/AreaRoutes");
const industryRoute = require("./routes/industryRoute");
const leeadRatingRoute = require("./routes/leeadRatingRoute");
const leeadSrcRoute = require("./routes/leeadSrcRoute");
const leeadStgRoute = require("./routes/leeadStgRoute");
const leadTypeRoute = require("./routes/leadTypeRoute");
const OpportunityStageRoute = require("./routes/OpportunityStageRoute");
const productCategoryRoutes = require("./routes/productCategoryRoutes");
const roleRoutes = require("./routes/roleRoutes");
const lossRoutes = require("./routes/lossRoutes");
const userRoutes = require("./routes/userRoutes");
const permissionRoutes = require("./routes/permissionRoutes");
const leadStatusRoutes = require("./routes/leadStatusRoutes");
const leadsRoute = require("./routes/leadsRoute");
const taskSubRoutes = require("./routes/taskSubRoutes");
const tasksRoutes = require("./routes/tasksRoutes");
const AccountRoutes = require("./routes/AccountRoutes");
const productRoute = require("./routes/productRoute");
const taxRoutes = require("./routes/taxRoutes");
const productTaxRoute = require("./routes/productTaxRoute");
const contactRoutes = require("./routes/contactRoutes");
const opportunityRoutes = require("./routes/opportunityRoutes");
const quatStatusRoutes = require("./routes/quatStatusRoutes");
const quatationMasterRoutes = require("./routes/quatationMasterRoutes");
const dashboardRoute = require("./routes/dashboardRoute");
const leaveHeadRoutes = require("./routes/leaveHeadRoutes");
const leaveAppRoutes = require("./routes/leaveAppRoutes");
const userCheckInRoutes = require("./routes/userCheckInRoutes");
const policyHeadRoutes = require("./routes/policyHeadRoutes");
const userExpenceRoutes = require("./routes/userExpenceRoutes");
const oppotunityTypeRoutes = require("./routes/oppotunityTypeRoutes");
const messageRoutes = require("./routes/messageRoutes");
const opporProductRoutes = require("./routes/opporProductRoutes");
const FieldRoutes = require("./routes/FieldRoutes");
// const emailRoutes = require("./routes/emailRoutes");
const EmailConfigRoutes = require("./routes/emailConfigRoutes")
const cpcategoryRoutes = require("./routes/cpcategoryRoutes");

//-------mart model--------//
const BrandRoutes = require("./routes/mart/BrandRoutes");
const QuizRoutes = require("./routes/mart/LearningModule/quizRoutes");
const StoreCategoryRoutes = require("./routes/mart/martStoreCategoryRoutes");
const SchemeRoutes = require("./routes/mart/martSchemeRoute");
//-------mart model--------//

//-----------DMS----------//
const brandRoutes = require("./routes/dms/brandRoutes");
const couponRoutes = require("./routes/dms/couponRoutes");
const bannerRoutes = require("./routes/dms/bannerRoutes");
const cartRoutes = require("./routes/dms/cartRoutes");
const orderRoutes = require("./routes/dms/orderRoutes");

//-----------Channel----------//
const projectRoutes = require("./routes/channel/projectRoutes");
const channelLeadRoutes = require("./routes/channel/leadRoutes");
const visitRoutes = require("./routes/channel/visitRoutes");
const bookingRoutes = require("./routes/channel/bookingRoutes");
const brokerageRoutes = require("./routes/channel/brokerageRoutes");
const channemDashboardRoutes = require("./routes/channel/channemDashboardRoutes");
const channelReportRoutes = require("./routes/channel/channelReportRoutes");
const salesForceRoutes = require("./routes/channel/salesForceRoutes");
const settingsRoutes = require("./routes/generalSettingsRoutes");

const media = require("./routes/media/routes");

const channelPartnerLeads = require("./routes/contactUsRoutes");

const organisation = require("./routes/organisationRoutes");
const emailTemplates = require("./routes/emailTemplateRoutes");
const erpRoutes = require("./routes/erpRoutes");

const path = require("path");

// Port is already defined at the top of the file

//assigning the variable app to express
const app = express();
app.use(cors({ origin: '*' }));
// app.use(cors({
//   origin: ['*'] }));
// const corsOptions = {
//   origin: 'http://crm.Srijan Bandhan.com:8050', // Your frontend origin
//   methods: ['GET', 'POST', 'PUT', 'DELETE'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
//   credentials: true
// };

// app.use(cors(corsOptions));
// app.use(cors());


const CLEANUP_INTERVAL = 1000 * 60 * 5; // 60 seconds
const IDLE_THRESHOLD = 1000 * 60 * 60 * 24 * 10; // 30  minutes

app.use(express.json({ limit: "2000kb" }));
app.use(
  fileUpload({
    limits: {
      fileSize: 50 * 1024 * 1024,
      useTempFiles: true,
      tempFileDir: "/tmp/",
    },
  })
);

app.use("/images", express.static(path.join(__dirname, "uploads")));

//middleware
app.use(express.json());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

//synchronizing the database and forcing it to false so we dont lose data
try {
  db.sequelize.sync({ alter: false }).then(() => {
    console.log("db has been re sync");
  });
} catch (error) {
  logErrorToFile(error)
  console.log(error);
}

// create folder on upper level if not created
createFolder();

// clean unused DB Instance
setInterval(() => {
  const now = Date.now();
  for (const tenantId in tenantsObj) {
    if (tenantsObj.hasOwnProperty(tenantId)) {
      if (now - tenantsObj[tenantId].lastAccess > IDLE_THRESHOLD) {
        tenantsObj[tenantId].instance.sequelize.close(); // Close the connection
        // await req.config.sequelize.close();
        delete tenantsObj[tenantId]; // Remove from tenants object
      }
    }
  }
}, CLEANUP_INTERVAL);

//routes for the user API
app.use("/api/v1/db", dbRoute);
app.use("/api/v1/db/divison", divisionRoute);
app.use("/api/v1/db/designation", designationRoute);
app.use("/api/v1/db/department", departmentRoute);
app.use("/api/v1/db/area", AreaRoutes);
app.use("/api/v1/db/industry", industryRoute);
app.use("/api/v1/db/leadrate", leeadRatingRoute);
app.use("/api/v1/db/leadsrc", leeadSrcRoute);
app.use("/api/v1/db/leadstg", leeadStgRoute);
app.use("/api/v1/db/leadtype", leadTypeRoute);
app.use("/api/v1/db/oppr", OpportunityStageRoute);
app.use("/api/v1/db/role", roleRoutes);
app.use("/api/v1/db/loss", lossRoutes);
app.use("/api/v1/db/productCat", productCategoryRoutes);
app.use("/api/v1/db/users", userRoutes);
app.use("/api/v1/db/permission", permissionRoutes);
app.use("/api/v1/db/leadstatus", leadStatusRoutes);
app.use("/api/v1/db/leads", leadsRoute);
app.use("/api/v1/db/subtask", taskSubRoutes);
app.use("/api/v1/db/tasks", tasksRoutes);
app.use("/api/v1/db/account", AccountRoutes);
app.use("/api/v1/db/product", productRoute);
app.use("/api/v1/db/tax", taxRoutes);
app.use("/api/v1/db/producttax", productTaxRoute);
app.use("/api/v1/db/contacts", contactRoutes);
app.use("/api/v1/db/opportunity", opportunityRoutes);
app.use("/api/v1/db/quatStatus", quatStatusRoutes);
app.use("/api/v1/db/quatMaster", quatationMasterRoutes);
app.use("/api/v1/db/dashboard", dashboardRoute);
app.use("/api/v1/db/leavehead", leaveHeadRoutes);
app.use("/api/v1/db/leaveapp", leaveAppRoutes);
app.use("/api/v1/db/checkin", userCheckInRoutes);
app.use("/api/v1/db/policy", policyHeadRoutes);
app.use("/api/v1/db/expence", userExpenceRoutes);
app.use("/api/v1/db/opprtype", oppotunityTypeRoutes);
app.use("/api/v1/db/message", messageRoutes);
app.use("/api/v1/db/oppro", opporProductRoutes);
app.use("/api/v1/db/field", FieldRoutes);
app.use("/api/v1/db/emailConfig", EmailConfigRoutes);
app.use("/api/v1/db/cpcategory", cpcategoryRoutes);


//-------mart model--------//
app.use("/api/v1/db/mart/brand", BrandRoutes);
app.use("/api/v1/db/mart/quiz", QuizRoutes);
app.use("/api/v1/db/mart/store_category", StoreCategoryRoutes);
app.use("/api/v1/db/mart/scheme", SchemeRoutes);
//-------mart model--------//

//-------DMS---------------//
app.use("/api/v1/db/brand", brandRoutes);
app.use("/api/v1/db/coupon", couponRoutes);
app.use("/api/v1/db/banner", bannerRoutes);
app.use("/api/v1/db/cart", cartRoutes);
app.use("/api/v1/db/order", orderRoutes);

//-------Chnanel---------------//
app.use("/api/v1/db/channel/project", projectRoutes)
app.use("/api/v1/db/channel/lead", channelLeadRoutes);
app.use("/api/v1/db/channel/visit", visitRoutes);
app.use("/api/v1/db/channel/booking", bookingRoutes);
app.use("/api/v1/db/channel/brokerage", brokerageRoutes);
app.use("/api/v1/db/channel/dashboard", channemDashboardRoutes);
app.use("/api/v1/db/channel/report", channelReportRoutes);
app.use("/api/v1/db/channel/salesforce", salesForceRoutes);
app.use("/api/v1/db/settings", settingsRoutes);

app.use("/api/v1/db/media", media);

app.use("/api/v1/db/channelPartnerLeads", channelPartnerLeads);

app.use("/api/v1/db/organisation", organisation);

app.use("/api/v1/db/emailTemplates", emailTemplates);
app.use("/api/v1/erp", erpRoutes);


app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Press Ctrl+C to stop the server`);
});
