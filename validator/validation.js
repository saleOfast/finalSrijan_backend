const { body, check, validationResult, query } = require("express-validator");
const userValidationRules = (params) => {
  switch (params) {
    case "login":
      return [
        check("email", "Please enter email").notEmpty(),
        check("password", "Please enter password").notEmpty(),
      ];

    case "registerUser":
      return [
        check("user").notEmpty().withMessage("Please enter user name"),
        check("email")
          .notEmpty()
          .withMessage("Please enter email")
          .isEmail()
          .withMessage("Please enter a valid email"),
        check("role_id")
          .notEmpty()
          .withMessage("Please choose user role")
          .isNumeric()
          .withMessage("Please enter a valid role "),
      ];

    case "editUser":
      return [
        check("user_id")
          .optional()
          .notEmpty()
          .withMessage("Please send user id")
          .isNumeric()
          .withMessage("Please send a valid user id"),
        check("user_code").notEmpty().withMessage("Please send user code"),
        check("user")
          .optional()
          .notEmpty()
          .withMessage("Please enter user name"),
        check("email")
          .optional()
          .notEmpty()
          .withMessage("Please enter email")
          .isEmail()
          .withMessage("Please enter a valid email"),
        check("report_to")
          .optional()
          .notEmpty()
          .withMessage("Please choose one user to report")
          .isNumeric()
          .withMessage("Please enter a valid user to report"),
      ];

    case "editInDbClientUser":
      return [
        check("user_id")
          .optional()
          .notEmpty()
          .withMessage("Please send user id")
          .isNumeric()
          .withMessage("Please send a valid user id"),
        check("user_code").notEmpty().withMessage("Please send user code"),
        check("user")
          .optional()
          .notEmpty()
          .withMessage("Please enter user name"),
        check("email")
          .optional()
          .notEmpty()
          .withMessage("Please enter email")
          .isEmail()
          .withMessage("Please enter a valid email"),
        check("password")
          .optional()
          .isLength({ min: 5 })
          .withMessage("password length should be of minimum 5"),
      ];

    case "deleteUser":
      return [query("id").notEmpty().withMessage("Please send user id")];

    case "registerClientUser":
      return [
        body("user").notEmpty().withMessage("Please enter user name"),
        body("email")
          .notEmpty()
          .withMessage("Please enter email").isEmail().withMessage("Please enter valid email"),

        body("contact_number")
          .notEmpty()
          .withMessage("Please enetr contact no")
          .isNumeric()
          .withMessage("Please enter a valid contact no"),
        // body("subscription_start_date")
        //   .notEmpty()
        //   .withMessage("Please choose subscription start date"),
        // body("subscription_end_date")
        //   .notEmpty()
        //   .withMessage("Please choose subscription end date"),


        // body("no_of_license")
        //   .notEmpty()
        //   .withMessage("Please enter license"),

        body("country_id")
          .notEmpty()
          .withMessage("Please choose country")
          .isNumeric()
          .withMessage("Please enter a valid country id"),

        body("state_id")
          .notEmpty()
          .withMessage("Please choose state")
          .isNumeric()
          .withMessage("Please enter a valid state id"),

        // body("city_id")
        //   .optional()
        //   .withMessage("Please choose city")
        //   .isNumeric()
        //   .withMessage("Please enter a valid city"),
      ];

    case "editClientUser":
      return [
        check("user_id")
          .optional()
          .notEmpty()
          .withMessage("Please send user id")
          .isNumeric()
          .withMessage("Please send a valid user id"),
        check("user_code").notEmpty().withMessage("Please send user code"),
        check("user")
          .optional()
          .notEmpty()
          .withMessage("Please enter user name"),
        check("email")
          .optional()
          .notEmpty()
          .withMessage("Please enter email")
          .isEmail()
          .withMessage("Please enter a valid email"),
        check("contact_number")
          .optional()
          .notEmpty()
          .withMessage("Please enetr contact no")
          .isNumeric()
          .withMessage("Please enter a valid contact no"),
        check("subscription_start_date")
          .optional()
          .notEmpty()
          .withMessage("Please choose subscription start date"),
        check("subscription_end_date")
          .optional()
          .notEmpty()
          .withMessage("Please choose subscription end date"),

        check("no_of_license")
          .optional()
          .notEmpty()
          .withMessage("Please enter license")
          .isNumeric()
          .withMessage("Please enter a valid license no"),
      ];

    case "addTask":
      return [
        check("task_name").notEmpty().withMessage("Please enter task name"),
        check("task_status_id")
          .optional()
          .notEmpty()
          .withMessage("Please choose task status")
          .isNumeric()
          .withMessage("Please enter a valid task status id"),
        check("task_priority_id")
          .optional()
          .notEmpty()
          .withMessage("Please choose task priority")
          .isNumeric()
          .withMessage("Please enter a valid task priority id"),
        check("link_with_opportunity")
          .optional()
          .notEmpty()
          .withMessage("Please choose opportunity")
          .isNumeric()
          .withMessage("Please enter a valid opportunity id"),
        check("assigned_to")
          .notEmpty()
          .withMessage("Please choose a user to assign task")
          .isNumeric()
          .withMessage("Please enter a valid user id"),
        check("due_date").notEmpty().withMessage("Please choose due date"),
        check("lead_id")
          .optional()
          .notEmpty()
          .withMessage("Please choose lead")
          .isNumeric()
          .withMessage("Please enter a valid lead id"),
      ];

    case "editTask":
      return [
        check("task_name").notEmpty().withMessage("Please enter task name"),
        check("task_id")
          .notEmpty()
          .withMessage("Please send task id")
          .isNumeric()
          .withMessage("Please send a valid task id"),
        check("task_status_id")
          .optional()
          .notEmpty()
          .withMessage("Please choose task status")
          .isNumeric()
          .withMessage("Please enter a valid task status id"),
        check("task_priority_id")
          .optional()
          .notEmpty()
          .withMessage("Please choose task priority")
          .isNumeric()
          .withMessage("Please enter a valid task priority id"),
        check("link_with_opportunity")
          .optional()
          .notEmpty()
          .withMessage("Please choose opportunity")
          .isNumeric()
          .withMessage("Please enter a valid opportunity id"),
        check("assigned_to")
          .notEmpty()
          .withMessage("Please choose a user to assign task")
          .isNumeric()
          .withMessage("Please enter a valid user id"),
        check("due_date").notEmpty().withMessage("Please choose due date"),
        check("lead_id")
          .optional()
          .notEmpty()
          .withMessage("Please choose lead")
          .isNumeric()
          .withMessage("Please enter a valid lead id"),
      ];
    case "deleteTask":
      return [
        query("t_id")
          .notEmpty()
          .withMessage("Please send task id")
          .isNumeric()
          .withMessage("Please send a valid task id"),
      ];

    case "addEvent":
      return [
        check("lead_id")
          .optional()
          .notEmpty()
          .withMessage("Please choose lead")
          .isNumeric()
          .withMessage("Please enter a valid lead id"),
        check("link_with_opportunity")
          .optional()
          .notEmpty()
          .withMessage("Please choose opportunity")
          .isNumeric()
          .withMessage("Please enter a valid opportunity id"),
        check("call_subject").notEmpty().withMessage("Please enter task name"),
        check("event_date").optional().notEmpty().withMessage("Please choose date"),
      ];

    case "editEvent":
      return [
        check("call_lead_id")
          .notEmpty()
          .withMessage("Please send call event id")
          .isNumeric()
          .withMessage("Please send valid event id"),
        check("lead_id")
          .optional()
          .notEmpty()
          .withMessage("Please choose lead")
          .isNumeric()
          .withMessage("Please enter a valid lead id"),
        check("link_with_opportunity")
          .optional()
          .notEmpty()
          .withMessage("Please choose opportunity")
          .isNumeric()
          .withMessage("Please enter a valid opportunity id"),
        check("call_subject").notEmpty().withMessage("Please enter task name"),
        check("event_date").notEmpty().withMessage("Please choose date"),
      ];

    case "deleteEvent":
      return [
        query("event_id")
          .notEmpty()
          .withMessage("Please send event id")
          .isNumeric()
          .withMessage("Please send a valid event id"),
      ];

    case "addAccount":
      return [
        check("acc_name").notEmpty().withMessage("Please enter account name"),
        // check("email_id")
        //   .notEmpty()
        //   .withMessage("Please enter email")
        //   .isEmail()
        //   .withMessage("Please enter a valid email"),

       // check("contact_no")
       //   .optional()
       //   .notEmpty()
        //  .withMessage("Please enter contact no"),

        check("ind_id")
          .optional()
          .notEmpty()
          .withMessage("Please choose industry type")
          .isNumeric()
          .withMessage("Please enter a valid industry type id"),

        check("account_type_id")
          .optional()
          .notEmpty()
          .withMessage("Please choose account type")
          .isNumeric()
          .withMessage("Please enter a valid account type id"),
        check("bill_cont")
          .optional()
          .notEmpty()
          .withMessage("Please choose billing country")
          .isNumeric()
          .withMessage("Please enter a billing country id"),

        check("bill_state")
          .optional()
          .notEmpty()
          .withMessage("Please choose billing state")
          .isNumeric()
          .withMessage("Please enter a valid state country id"),

        // check("bill_city")
        //   .optional()
        //   .withMessage("Please choose billing city")
        //   .isNumeric()
        //   .withMessage("Please enter a valid billing city id"),

        check("bill_pincode")
          .optional()
          .notEmpty()
          .withMessage("Please choose billing pincode")
          .isNumeric()
          .withMessage("Please enter a valid billing pincode"),

        check("ship_cont")
          .optional()
          .notEmpty()
          .withMessage("Please choose shipping country")
          .isNumeric()
          .withMessage("Please enter a valid shipping country id"),

        check("ship_state")
          .optional()
          .notEmpty()
          .withMessage("Please choose shipping state")
          .isNumeric()
          .withMessage("Please enter a valid shipping state id"),

        // check("ship_city")
        //   .optional()
        //   .withMessage("Please choose shipping city")
        //   .isNumeric()
        //   .withMessage("Please enter a valid shipping city"),

        check("ship_pincode")
          .optional()
          .notEmpty()
          .withMessage("Please choose shipping pincode")
          .isNumeric()
          .withMessage("Please enter a valid shipping pincode"),

        // check("emp_name")
        //   .if((value, { req }) => req.query.l_id)
        //   .notEmpty()
        //   .withMessage("Please enter Employee Name"),
      ];

    case "editAccount":
      return [
        check("acc_id")
          .notEmpty()
          .withMessage("Please choose account id")
          .isNumeric()
          .withMessage("Please send a valid account id"),
        // check("email_id")
        //   .notEmpty()
        //   .withMessage("Please enter email")
        //   .isEmail()
        //   .withMessage("Please enter a valid email"),
        check("acc_name").notEmpty().withMessage("Please enter account name"),
        check("contact_no").notEmpty().withMessage("Please enter contact no"),
        check("ind_id")
          .notEmpty()
          .withMessage("Please choose industry type")
          .isNumeric()
          .withMessage("Please enter a valid industry type id"),

        check("account_type_id")
          .notEmpty()
          .withMessage("Please choose account type")
          .isNumeric()
          .withMessage("Please enter a valid account type id"),
        check("bill_cont")
          .notEmpty()
          .withMessage("Please choose billing country")
          .isNumeric()
          .withMessage("Please enter a billing country id"),

        check("bill_state")
          .notEmpty()
          .withMessage("Please choose billing state")
          .isNumeric()
          .withMessage("Please enter a valid state country id"),

        // check("bill_city")
        //   .optional()
        //   .withMessage("Please choose billing city")
        //   .isNumeric()
        //   .withMessage("Please enter a valid billing city id"),

        check("bill_pincode")
          .notEmpty()
          .withMessage("Please choose billing pincode")
          .isNumeric()
          .withMessage("Please enter a valid billing pincode"),

        check("ship_cont")
          .notEmpty()
          .withMessage("Please choose shipping country")
          .isNumeric()
          .withMessage("Please enter a valid shipping country id"),

        check("ship_state")
          .notEmpty()
          .withMessage("Please choose shipping state")
          .isNumeric()
          .withMessage("Please enter a valid shipping state id"),

        // check("ship_city")
        //   .optional()
        //   .withMessage("Please choose shipping city")
        //   .isNumeric()
        //   .withMessage("Please enter a valid shipping city"),

        check("ship_pincode")
          .notEmpty()
          .withMessage("Please choose shipping pincode")
          .isNumeric()
          .withMessage("Please enter a valid shipping pincode"),
      ];

    case "deleteAccount":
      return [
        query("acc_id")
          .notEmpty()
          .withMessage("Please send account id")
          .isNumeric()
          .withMessage("Please send a valid account id"),
      ];

    case "addContact":
      return [
        check("first_name").notEmpty().withMessage("Please enter contact name"),
        check("last_name")
          .optional()
          .notEmpty()
          .withMessage("Please enter contact name"),
        check("account_name")
          .optional()
          .notEmpty()
          .withMessage("Please choose account owner")
          .isNumeric()
          .withMessage("Please enter a valid account owner"),
      ];

    case "editContact":
      return [
        check("contact_id")
          .notEmpty()
          .withMessage("Please send contact id")
          .isNumeric()
          .withMessage("Please send a valid contact id"),

        check("first_name").notEmpty().withMessage("Please enter contact name"),
        check("last_name").notEmpty().withMessage("Please enter contact name"),
        check("account_name")
          .notEmpty()
          .withMessage("Please choose account owner")
          .isNumeric()
          .withMessage("Please enter a valid account owner"),
      ];
    case "deleteContact":
      return [
        query("c_id")
          .notEmpty()
          .withMessage("Please send contact id")
          .isNumeric()
          .withMessage("Please send a valid contact id"),
      ];

    case "addLead":
      return [
        check("lead_name")
          .notEmpty()
          .withMessage("Please enter lead name")
          .matches(/^(?![\d\W]+$)[a-zA-Z\d\W]+$/)
          .withMessage("Please enter a valid lead name"),

        check("lead_status_id")
          .notEmpty()
          .withMessage("Please choose lead status")
          .isNumeric()
          .withMessage("Please enter a valid  lead status id"),

        check("company_name")
          .notEmpty()
          .withMessage("Please enter organisation name"),

        check("lead_owner")
          .notEmpty()
          .withMessage("Please choose lead owner")
          .isNumeric()
          .withMessage("Please enter a valid lead owner"),

        check("zone")
          .optional()
          .notEmpty()
          .withMessage("Please enter zone"),

        check("zone_area")
          .optional()
          .notEmpty()
          .withMessage("Please enter zone area"),

        check("aadhar_card_number")
          .optional()
          .notEmpty()
          .withMessage("Please enter aadhar card number")
          .matches(/^\d{12}$/)
          .withMessage("Please enter a valid 12-digit aadhar card number"),
      ];

    case "editLead":
      return [
        check("lead_id")
          .notEmpty()
          .withMessage("Please send lead id")
          .isNumeric()
          .withMessage("Please send a valid lead id"),
        check("lead_name")
          .notEmpty()
          .withMessage("Please enter lead name")
          .matches(/^(?![\d\W]+$)[a-zA-Z\d\W]+$/)
          .withMessage("Please enter a valid lead name"),
        check("company_name")
          .notEmpty()
          .withMessage("Please enter organisation name"),
        check("lead_status_id")
          .notEmpty()
          .withMessage("Please choose lead status")
          .isNumeric()
          .withMessage("Please enter a valid  lead status id"),
        check("lead_owner")
          .notEmpty()
          .withMessage("Please choose lead owner")
          .isNumeric()
          .withMessage("Please enter a valid lead owner"),

        check("zone")
          .optional()
          .notEmpty()
          .withMessage("Please enter zone"),

        check("zone_area")
          .optional()
          .notEmpty()
          .withMessage("Please enter zone area"),

        check("aadhar_card_number")
          .optional()
          .notEmpty()
          .withMessage("Please enter aadhar card number")
          .matches(/^\d{12}$/)
          .withMessage("Please enter a valid 12-digit aadhar card number"),
      ];

    case "editLeadAssign":
      return [
        check("lead_id")
          .notEmpty()
          .withMessage("Please send lead id")
          .isNumeric()
          .withMessage("Please send a valid lead id"),
        check("assigned_lead")
          .notEmpty()
          .withMessage("Please send assigned_lead")
          .isNumeric()
          .withMessage("Please send a valid assigned_lead"),
      ];

    case "deleteLead":
      return [
        query("l_id")
          .notEmpty()
          .withMessage("Please send lead id")
          .isNumeric()
          .withMessage("Please send a valid lead id"),
      ];

    case "addProduct":
      return [
        check("p_code").notEmpty().withMessage("Please enter product code"),
        check("brand_id").notEmpty().withMessage("Please enter brand"),
        check("p_name").notEmpty().withMessage("Please enter product name"),
        check("unit_in_case")
          .notEmpty()
          .withMessage("Please enter unit of case"),
        check("p_price")
          .notEmpty()
          .withMessage("Please choose product price")
          .isNumeric()
          .withMessage("Please enter a valid product price"),
        check("p_cat_id")
          .notEmpty()
          .withMessage("Please choose product category")
          .isNumeric()
          .withMessage("Please enter a valid product category id"),
      ];

    case "editProduct":
      return [
        check("p_id")
          .notEmpty()
          .withMessage("Please send product id ")
          .isNumeric()
          .withMessage("Please send a valid product id"),
        check("brand_id").notEmpty().withMessage("Please enter brand"),
        check("p_code").notEmpty().withMessage("Please enter product code"),
        check("p_name").notEmpty().withMessage("Please enter product name"),
        check("p_price")
          .notEmpty()
          .withMessage("Please choose product price")
          .isNumeric()
          .withMessage("Please enter a valid product price"),
        check("p_cat_id")
          .notEmpty()
          .withMessage("Please choose product category")
          .isNumeric()
          .withMessage("Please enter a valid product category id"),
      ];

    case "deleteProduct":
      return [
        query("p_id")
          .notEmpty()
          .withMessage("Please send product id")
          .isNumeric()
          .withMessage("Please send a valid product id"),
      ];

    case "addOpp":
      return [
        check("opp_name")
          .notEmpty()
          .withMessage("Please enter opportunity name")
          .matches(/^(?![\d\W]+$)[a-zA-Z\d\W]+$/)
          .withMessage("Please enter a valid opportunity name"),
        check("account_name")
          .optional()
          .notEmpty()
          .withMessage("Please choose account name")
          .isNumeric()
          .withMessage("Please enter a valid account name"),
        check("close_date")
          .optional()
          .notEmpty()
          .withMessage("Please choose close date"),
        check("opportunity_stg_id")
          .optional()
          .notEmpty()
          .withMessage("Please choose opportunity stage")
          .isNumeric()
          .withMessage("Please enter a valid opportunity stage"),
        check("opportunity_type_id")
          .optional()
          .notEmpty()
          .withMessage("Please choose opportunity type")
          .isNumeric()
          .withMessage("Please enter a valid lead opportunity type"),
        check("lead_src_id")
          .optional()
          .notEmpty()
          .withMessage("Please choose lead source")
          .isNumeric()
          .withMessage("Please enter a valid lead source"),
        check("amount")
          .optional()
          .notEmpty()
          .withMessage("Please enter amount")
          .isNumeric()
          .withMessage("Please enter a valid amount"),
      ];

    case "editOpp":
      return [
        check("opp_name")
          .notEmpty()
          .withMessage("Please enter opportunity name")
          .matches(/^(?![\d\W]+$)[a-zA-Z\d\W]+$/)
          .withMessage("Please enter a valid opportunity name"),
        check("opp_id")
          .notEmpty()
          .withMessage("Please send opportunity id")
          .isNumeric()
          .withMessage("Please send a valid opportunity id"),
        check("account_name")
          .notEmpty()
          .withMessage("Please choose account name")
          .isNumeric()
          .withMessage("Please enter a valid account name"),
        check("close_date").notEmpty().withMessage("Please choose close date"),
        check("opportunity_stg_id")
          .notEmpty()
          .withMessage("Please choose opportunity stage")
          .isNumeric()
          .withMessage("Please enter a valid opportunity stage"),
        check("opportunity_type_id")
          .notEmpty()
          .withMessage("Please choose opportunity type")
          .isNumeric()
          .withMessage("Please enter a valid lead opportunity type"),
        check("lead_src_id")
          .notEmpty()
          .withMessage("Please choose lead source")
          .isNumeric()
          .withMessage("Please enter a valid lead source"),
        check("amount")
          .notEmpty()
          .withMessage("Please enter amount")
          .isNumeric()
          .withMessage("Please enter a valid amount"),
      ];

    case "deleteOpp":
      return [
        query("o_id")
          .notEmpty()
          .withMessage("Please send opportunity id")
          .isNumeric()
          .withMessage("Please send a valid opportunity id"),
      ];

    case "addQuatation":
      return [
        check("contact_no")
          .notEmpty()
          .withMessage("Please enter contact no")
          .isNumeric()
          .withMessage("Please enter a valid contact no"),

        check("email")
          .notEmpty()
          .withMessage("Please enter email")
          .isEmail()
          .withMessage("Please enter a valid email"),

        check("opp_id")
          .notEmpty()
          .withMessage("Please choose opportunity id")
          .isNumeric()
          .withMessage("Please choose a valid opportunity id"),

        check("assigned_to")
          .optional()
          .notEmpty()
          .withMessage("Please choose user to assign")
          .isNumeric()
          .withMessage("Please choose a valid user to assign"),

        check("quat_status")
          .notEmpty()
          .withMessage("Please choose quotation status")
          .isNumeric()
          .withMessage("Please choose a valid quotation status"),

        check("valid_till").notEmpty().withMessage("Please pick date"),

        check("quat_summery")
          .notEmpty()
          .withMessage("Please enter quatation summery"),

        check("bill_cont")
          .notEmpty()
          .withMessage("Please choose billing country")
          .isNumeric()
          .withMessage("Please enter a billing country id"),

        check("bill_state")
          .notEmpty()
          .withMessage("Please choose billing state")
          .isNumeric()
          .withMessage("Please enter a valid state country id"),

        // check("bill_city")
        //   .optional()
        //   .withMessage("Please choose billing city")
        //   .isNumeric()
        //   .withMessage("Please enter a valid billing city id"),

        check("bill_pincode")
          .notEmpty()
          .withMessage("Please choose billing pincode")
          .isNumeric()
          .withMessage("Please enter a valid billing pincode"),

        check("ship_cont")
          .notEmpty()
          .withMessage("Please choose shipping country")
          .isNumeric()
          .withMessage("Please enter a valid shipping country id"),

        check("ship_state")
          .notEmpty()
          .withMessage("Please choose shipping state")
          .isNumeric()
          .withMessage("Please enter a valid shipping state id"),

        // check("ship_city")
        //   .optional()
        //   .withMessage("Please choose shipping city")
        //   .isNumeric()
        //   .withMessage("Please enter a valid shipping city"),

        check("ship_pincode")
          .notEmpty()
          .withMessage("Please choose shipping pincode")
          .isNumeric()
          .withMessage("Please enter a valid shipping pincode"),

        check("ship_pincode")
          .notEmpty()
          .withMessage("Please choose shipping pincode")
          .isNumeric()
          .withMessage("Please enter a valid shipping pincode"),

        check("grand_total")
          .notEmpty()
          .withMessage("Please choose Product for Quotation"),
      ];

    case "editQuotation":
      return [
        check("quat_mast_id")
          .notEmpty()
          .withMessage("Please send quotation id")
          .isNumeric()
          .withMessage("Please send a valid quotation id"),

        check("contact_no")
          .notEmpty()
          .withMessage("Please enter contact no")
          .isNumeric()
          .withMessage("Please enter a valid contact no"),

        check("email")
          .notEmpty()
          .withMessage("Please enter email")
          .isEmail()
          .withMessage("Please enter a valid email"),

        check("opp_id")
          .notEmpty()
          .withMessage("Please choose opportunity id")
          .isNumeric()
          .withMessage("Please choose a valid opportunity id"),

        check("assigned_to")
          .optional()
          .notEmpty()
          .withMessage("Please choose user to assign")
          .isNumeric()
          .withMessage("Please choose a valid user to assign"),

        check("quat_status")
          .notEmpty()
          .withMessage("Please choose quotation status")
          .isNumeric()
          .withMessage("Please choose a valid quotation status"),

        check("valid_till").notEmpty().withMessage("Please pick date"),

        check("quat_summery")
          .notEmpty()
          .withMessage("Please enter quatation summery"),

        check("bill_cont")
          .notEmpty()
          .withMessage("Please choose billing country")
          .isNumeric()
          .withMessage("Please enter a billing country id"),

        check("bill_state")
          .notEmpty()
          .withMessage("Please choose billing state")
          .isNumeric()
          .withMessage("Please enter a valid state country id"),

        // check("bill_city")
        //   .optional()
        //   .withMessage("Please choose billing city")
        //   .isNumeric()
        //   .withMessage("Please enter a valid billing city id"),

        check("bill_pincode")
          .notEmpty()
          .withMessage("Please choose billing pincode")
          .isNumeric()
          .withMessage("Please enter a valid billing pincode"),

        check("ship_cont")
          .notEmpty()
          .withMessage("Please choose shipping country")
          .isNumeric()
          .withMessage("Please enter a valid shipping country id"),

        check("ship_state")
          .notEmpty()
          .withMessage("Please choose shipping state")
          .isNumeric()
          .withMessage("Please enter a valid shipping state id"),

        // check("ship_city")
        //   .optional()
        //   .withMessage("Please choose shipping city")
        //   .isNumeric()
        //   .withMessage("Please enter a valid shipping city"),

        check("ship_pincode")
          .notEmpty()
          .withMessage("Please choose shipping pincode")
          .isNumeric()
          .withMessage("Please enter a valid shipping pincode"),

        check("ship_pincode")
          .notEmpty()
          .withMessage("Please choose shipping pincode")
          .isNumeric()
          .withMessage("Please enter a valid shipping pincode"),

        check("grand_total")
          .notEmpty()
          .withMessage("Please choose Product for Quotation"),
      ];

    case "editAdminProfile":
      return [
        check("user_id")
          .notEmpty()
          .withMessage("Please send user id")
          .isNumeric()
          .withMessage("Please send a valid user id"),
        check("email")
          .notEmpty()
          .withMessage("Please enter email")
          .isEmail()
          .withMessage("Please enter a valid email"),
        check("password")
          .optional()
          .isLength({ min: 5 })
          .withMessage("password length should be of minimum 5"),
        check("user").notEmpty().withMessage("user name cannot be empty"),
        check("contact_number")
          .notEmpty()
          .withMessage("Please enter contact no")
          .isNumeric()
          .withMessage("Please enter a valid contact number"),
      ];

    case "editAdminProfileIMG":
      return [
        check("user_id")
          .notEmpty()
          .withMessage("Please send user id")
          .isNumeric()
          .withMessage("Please send a valid user id"),
      ];

    case "addUserLeaveApp":
      return [
        check("head_leave_cnt_id")
          .notEmpty()
          .withMessage("Please choose leave type")
          .isNumeric()
          .withMessage("Please choose valid leave type"),
        check("reason").notEmpty().withMessage("Please enter reason"),
        check("from_date").notEmpty().withMessage("Please pick from date"),
        check("to_date").notEmpty().withMessage("Please pick to date"),
      ];

    case "editUserLeaveApp":
      return [
        check("leave_app_id")
          .notEmpty()
          .withMessage("Please send user id")
          .isNumeric()
          .withMessage("Please send a valid user id"),
        check("head_leave_cnt_id")
          .notEmpty()
          .withMessage("Please choose leave type")
          .isNumeric()
          .withMessage("Please choose valid leave type"),
        check("leave_app_status")
          .notEmpty()
          .withMessage("Please give leave status"),
        check("remarks")
          .notEmpty()
          .withMessage("Please give remarks to the user"),
      ];

    case "deleteUserLeaveApp":
      return [
        query("la_id")
          .notEmpty()
          .withMessage("Please send leave app id")
          .isNumeric()
          .withMessage("Please send a valid leave app id"),
      ];

    case "addUserExpence":
      return [
        check("from_date").notEmpty().withMessage("Please pick from date"),
        check("policy_id")
          .notEmpty()
          .withMessage("Please choose policy")
          .isNumeric()
          .withMessage("no valid policy selected"),
        check("policy_type_id")
          .optional()
          .notEmpty()
          .withMessage("Please choose policy")
          .isNumeric()
          .withMessage("no valid policy selected"),
        check("from_location")
          .notEmpty()
          .withMessage("Please enter a valid location")
          .matches(/^(?![\d\W]+$)[\w\W]+$/)
          .withMessage("Please enter a valid location"),
        check("to_location")
          .optional()
          .notEmpty()
          .withMessage("Please enter a valid location")
          .matches(/^(?![\d\W]+$)[\w\W]+$/)
          .withMessage("Please enter a valid location"),
        check("kms")
          .optional()
          .notEmpty()
          .withMessage("Please enter kilometers"),
        check("total_expence").notEmpty().withMessage("total expence is empty"),
      ];

    case "editUserExpence":
      return [
        check("expence_id")
          .notEmpty()
          .withMessage("Please send expense id")
          .isNumeric()
          .withMessage("Please send valid expense id"),
        check("status").notEmpty().withMessage("Please give leave status"),
        check("remark")
          .notEmpty()
          .withMessage("Please give remarks to the user"),
      ];

    case "deleteUserExpence":
      return [
        query("expn_id")
          .notEmpty()
          .withMessage("Please send leave app id")
          .isNumeric()
          .withMessage("Please send a valid leave app id"),
      ];

    case "martBrandMaster":
      return [
        check("user_id")
          .notEmpty()
          .withMessage("Please send user id")
          .isNumeric()
          .withMessage("Please send a valid user id"),
        check("name").notEmpty().withMessage("name not provided"),
      ];

    case "mart_quiz":
      return [
        check("questions").notEmpty().withMessage("Please enter question"),
        check("option1").notEmpty().withMessage("Please enter option1"),
        check("option2").notEmpty().withMessage("Please enter option2"),
        check("option3").notEmpty().withMessage("Please enter option3"),
        check("option4").notEmpty().withMessage("Please enter optopn4"),
        check("answer").notEmpty().withMessage("Please enter answer"),
        check("marks").notEmpty().withMessage("Please enter marks"),
      ];

    case "martStoreCategory":
      return [
        check("user_id")
          .notEmpty()
          .withMessage("Please send user id")
          .isNumeric()
          .withMessage("Please send a valid user id"),
        check("category_name")
          .notEmpty()
          .withMessage("category name not provided"),
      ];

    case "martScheme":
      return [
        check("user_id")
          .notEmpty()
          .withMessage("Please send user id")
          .isNumeric()
          .withMessage("Please send a valid user id"),
        check("name").notEmpty().withMessage("name not provided"),
        check("month")
          .notEmpty()
          .withMessage("Please enter month")
          .isNumeric()
          .withMessage("Please send a valid month"),
        check("year")
          .notEmpty()
          .withMessage("Please enter year")
          .isNumeric()
          .withMessage("Please send a valid year"),
        check("file").notEmpty().withMessage("file not provided"),
      ];

    case "brandCreate":
      return [
        body("brand_name").notEmpty().withMessage("Brand name is required"),
      ];
    case "brandUpdate":
      return [
        body("brand_name").notEmpty().withMessage("Brand name is required"),
      ];
    case "registerCP":
      return [
        check("name").notEmpty().withMessage("Please enter user name"),
        check("mobile").notEmpty().withMessage("Please enter user mobile"),
        // check("aadhar").notEmpty().withMessage("Please upload aadhar card"),
        // check("pan").notEmpty().withMessage("Please upload pan card"),
        // check("rera").notEmpty().withMessage("Please upload rera document"),
        check("token").notEmpty().withMessage("Please provide valid token"),
        check("id").notEmpty().withMessage("Please enter id"),
      ];
    case "registerCPTokenVerify":
      return [
        check("token").notEmpty().withMessage("Please provide valid token"),
      ];

    case "emailConfigValidations":
      return [
        check("host")
          .isString()
          .withMessage("Please send a valid host"),
        check("port")
          .isNumeric()
          .withMessage("Please send a valid port"),
        check("user")
          .isString()
          .withMessage("Please send a valid user"),
        check("password")
          .isString()
          .withMessage("Please send a valid password"),
        check("from")
          .isString()
          .withMessage("Please send a valid from address"),

      ];
    case "addChannelLead":
      return [
        check("lead_name").notEmpty().withMessage("Please enter lead name"),
        check("address").notEmpty().withMessage("Please enter address"),
        check("project_id").notEmpty().withMessage("Please choose project name"),
        check("email_id").notEmpty().withMessage("Please enter email_id").isEmail().withMessage('Please enter valid email'),

        check("p_contact_no").notEmpty().withMessage("Please enter contact no").isNumeric().withMessage('Please enter valid contact no').isLength({ min: 10, max: 10 }).withMessage('contact no must be of ten digit'),

        check("pincode").notEmpty().withMessage("Please enter pincode").isNumeric().withMessage('Please enter valid pincode').isLength({ min: 6, max: 6 }).withMessage('pincode must be of six digit'),

        check("zone")
          .optional()
          .notEmpty()
          .withMessage("Please enter zone"),

        check("zone_area")
          .optional()
          .notEmpty()
          .withMessage("Please enter zone area"),

        check("aadhar_card_number")
          .optional()
          .notEmpty()
          .withMessage("Please enter aadhar card number")
          .matches(/^\d{12}$/)
          .withMessage("Please enter a valid 12-digit aadhar card number"),
      ];

    case "editChannelLead":
      return [
        check("lead_id")
          .notEmpty()
          .withMessage("Please send lead id")
          .isNumeric()
          .withMessage("Please send a valid lead id"),
        check("lead_name").notEmpty().withMessage("Please enter lead name"),
        check("address").notEmpty().withMessage("Please enter address"),
        check("project_id").notEmpty().withMessage("Please choose project name"),
        check("email_id").notEmpty().withMessage("Please enter email_id").isEmail().withMessage('Please enter valid email'),
        // check("p_contact_no").notEmpty().withMessage("Please enter contact no").isNumeric().withMessage('Please enter valid contact no').isLength({ min: 10, max: 10 }).withMessage('phone must be of 10 digit'),
        check("pincode").notEmpty().withMessage("Please enter pincode").isNumeric().withMessage('Please enter valid pincode').isLength({ min: 6, max: 6 }).withMessage('pincode must be of six digit'),

        check("zone")
          .optional()
          .notEmpty()
          .withMessage("Please enter zone"),

        check("zone_area")
          .optional()
          .notEmpty()
          .withMessage("Please enter zone area"),

        check("aadhar_card_number")
          .optional()
          .notEmpty()
          .withMessage("Please enter aadhar card number")
          .matches(/^\d{12}$/)
          .withMessage("Please enter a valid 12-digit aadhar card number"),
      ];

    case "assetCostSheetUpdate":
      return [
        body('site_id').notEmpty().withMessage('Site ID is required.'),
        body('eab_id').notEmpty().withMessage('Estimate ID is required.'),
        body('campaign_id').notEmpty().withMessage('Campaign ID is required.'),
        body('quantity').isFloat({ min: 0 }).withMessage('Quantity must be a positive number.'),
        body('width').isFloat({ min: 0 }).withMessage('Width must be a positive number.'),
        body('height').isFloat({ min: 0 }).withMessage('Height must be a positive number.'),
        body('final_client_po_cost').isFloat({ min: 0 }).withMessage('Final Client PO Cost must be a positive number.'),
        body('mounting_cost_per_sq_ft').isFloat({ min: 0 }).withMessage('Mounting Cost per Sq. Ft. must be a positive number.'),
        body('printing_cost_per_sq_ft').isFloat({ min: 0 }).withMessage('Printing Cost per Sq. Ft. must be a positive number.'),
        body('campaign_start_date').optional().isISO8601().toDate().withMessage('Campaign Start Date must be a valid date.'),
        body('campaign_end_date').optional().isISO8601().toDate().withMessage('Campaign End Date must be a valid date.'),
        body('remarks').optional().notEmpty().withMessage('Remarks cannot be empty.')
      ];

    case "agencyCostSheetUpdate":
      return [
        body('site_id').notEmpty().withMessage('Site ID is required.'),
        body('estimate_id').notEmpty().withMessage('Estimate ID is required.'),
        body('campaign_id').notEmpty().withMessage('Campaign ID is required.'),
        body('quantity').isFloat({ min: 0 }).withMessage('Quantity must be a positive number.'),
        body('width').isFloat({ min: 0 }).withMessage('Width must be a positive number.'),
        body('height').isFloat({ min: 0 }).withMessage('Height must be a positive number.'),
        body('final_client_po_cost').isFloat({ min: 0 }).withMessage('Final Client PO Cost must be a positive number.'),
        body('mounting_cost_per_sq_ft').isFloat({ min: 0 }).withMessage('Mounting Cost per Sq. Ft. must be a positive number.'),
        body('printing_cost_per_sq_ft').isFloat({ min: 0 }).withMessage('Printing Cost per Sq. Ft. must be a positive number.'),
        body('campaign_start_date').optional().isISO8601().toDate().withMessage('Campaign Start Date must be a valid date.'),
        body('campaign_end_date').optional().isISO8601().toDate().withMessage('Campaign End Date must be a valid date.'),
        body('remarks').optional().notEmpty().withMessage('Remarks cannot be empty.')
      ];

    default:
      return [];
  }
  // username must be an email
};

const validate = async (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  const extractedErrors = [];
  errors.array().map((err) => extractedErrors.push({ [err.path]: err.msg }));
  // await req.config.sequelize.close();
  return res.status(400).json({
    status: 422,
    message: "Please fill the mandatory fields",
    data: extractedErrors,
  });
};

const superValidate = async (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  const extractedErrors = [];
  errors.array().map((err) => {
    console.log(err)
    extractedErrors.push({ [err.path]: err.msg })
  });
  return res.status(400).json({
    status: 422,
    message: "Please fill the mandatory fields",
    data: extractedErrors,
  });
};

module.exports = {
  userValidationRules,
  validate,
  superValidate,
};
