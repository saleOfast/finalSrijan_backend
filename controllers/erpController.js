const { responseError, responseSuccess } = require("../helper/responce");
const { sendEmail } = require("../common/mailer");
const { Op } = require("sequelize");

/**
 * Helper function to find CP (Channel Partner) user by matching CP_Name from ERP
 * Tries multiple matching strategies:
 * 1. Match by user_code if ERP sends it
 * 2. Match CP_Name with user.organisation
 * 3. Match CP_Name with (user.user + user.user_l_name)
 * 4. Match by email if available
 * 
 * @param {Object} req - Request object with req.config
 * @param {String} cpName - CP name from ERP (CP_Name field)
 * @param {String} cpCode - CP code from ERP (optional, user_code)
 * @param {String} email - Email from ERP (optional, for fallback matching)
 * @returns {Object|null} - CP user object or null if not found
 */
const findCPUser = async (req, cpName, cpCode = null, email = null) => {
  try {
    if (!cpName && !cpCode && !email) {
      return null;
    }

    // Strategy 1: Match by user_code (most reliable - this is what we send to ERP)
    if (cpCode) {
      const cpByCode = await req.config.users.findOne({
        where: {
          user_code: cpCode,
          role_id: 1, // Channel Partner role
          user_status: true
        }
      });
      if (cpByCode) {
        console.log(`✅ Found CP by user_code: ${cpCode} -> user_id: ${cpByCode.user_id}`);
        return cpByCode;
      }
    }

    // Strategy 2: Match CP_Name with organisation field
    if (cpName) {
      const cpByOrg = await req.config.users.findOne({
        where: {
          organisation: cpName,
          role_id: 1,
          user_status: true
        }
      });
      if (cpByOrg) {
        console.log(`✅ Found CP by organisation: ${cpName} -> user_id: ${cpByOrg.user_id}`);
        return cpByOrg;
      }

      // Strategy 3: Match CP_Name with (user + user_l_name)
      const nameParts = cpName.trim().split(/\s+/);
      if (nameParts.length >= 1) {
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

        let nameWhere = {
          user: firstName,
          role_id: 1,
          user_status: true
        };

        if (lastName) {
          nameWhere.user_l_name = lastName;
        }

        const cpByName = await req.config.users.findOne({
          where: nameWhere
        });
        if (cpByName) {
          console.log(`✅ Found CP by name: ${cpName} -> user_id: ${cpByName.user_id}`);
          return cpByName;
        }
      }
    }

    // Strategy 4: Match by email (fallback)
    if (email) {
      const cpByEmail = await req.config.users.findOne({
        where: {
          email: email,
          role_id: 1,
          user_status: true
        }
      });
      if (cpByEmail) {
        console.log(`✅ Found CP by email: ${email} -> user_id: ${cpByEmail.user_id}`);
        return cpByEmail;
      }
    }

    console.log(`⚠️ CP not found for: CP_Name=${cpName}, CP_Code=${cpCode}, Email=${email}`);
    return null;
  } catch (error) {
    console.error('Error in findCPUser:', error.message);
    return null;
  }
};

// Upsert a lead from ERP webhook
exports.webhookUpsertLead = async (req, res) => {
  const t = await req.config.sequelize.transaction();
  const requestId = `LEAD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const payload = req.body || {};
    
    // Log incoming request
    console.log(`[${requestId}] ERP Lead Webhook - Incoming Request:`, {
      headers: {
        'x-client-code': req.headers['x-client-code'],
        'x-api-key': req.headers['x-api-key'] ? '***masked***' : 'missing',
        'content-type': req.headers['content-type']
      },
      body: payload,
      timestamp: new Date().toISOString()
    });

    // Basic required validation to avoid DB constraint issues
    if (!payload.email && !payload.email_id && !payload.phone && !payload.p_contact_no) {
      console.log(`[${requestId}] ERP Lead Webhook - Validation Failed: Missing email/phone`);
      return responseError(req, res, "email or phone is required");
    }

    // Map ERP payload to lead fields
    const leadBody = {
      lead_name: payload.lead_name || null,
      email_id: payload.email_id || null,
      p_contact_no: payload.p_contact_no || null,
      address: payload.address || null,
      pincode: payload.pincode || null,
      p_visit_date: payload.p_visit_date || null,
      p_visit_time: payload.p_visit_time || null,
      project_id: payload.project_id || null,
      sales_project_name: payload.project_name || null,
      created_on: payload.created_on || new Date(),
      updated_on: payload.updated_on || new Date(),
      zone: payload.zone || null,
      zone_area: payload.zone_area || null,
      aadhar_card_number: payload.aadhar_card_number || null,
      LOI_Number: payload.LOI_Number || payload.loi_number || null,
      erp_lead_id: payload.erp_lead_id !== undefined && payload.erp_lead_id !== null && payload.erp_lead_id !== '' ? payload.erp_lead_id : null,
      CP_Name: payload.cp_name || payload.CP_Name || null,
      created_by: payload.created_by || null,
      budget_range: payload.budget_range || null,
      size: payload.size || null,
      type_of_bhk: payload.type_of_bhk || null,
      lead_valid_upto: payload.lead_valid_upto || null,
      stage: payload.stage || payload.stages || payload.lead_stage || null,
      // Default values for required fields
      lead_stg_id: payload.lead_stg_id || 1,
      lead_src_id: null,
      lead_type_id: null,
      lead_status_id: null,
    };

    // Log erp_lead_id mapping for debugging
    console.log(`[${requestId}] ERP Lead Webhook - erp_lead_id Mapping:`, {
      payload_erp_lead_id: payload.erp_lead_id,
      mapped_erp_lead_id: leadBody.erp_lead_id,
      type: typeof payload.erp_lead_id
    });

    // Validate FK references; if not exists in tenant, set null/defaults
    console.log(`[${requestId}] ERP Lead Webhook - Validating Foreign Keys:`, {
      lead_type_id: leadBody.lead_type_id,
      lead_src_id: leadBody.lead_src_id,
      lead_status_id: leadBody.lead_status_id,
      lead_stg_id: leadBody.lead_stg_id,
      project_id: leadBody.project_id
    });

    const [typeValid, srcValid, statusValid, stageValid, projectValid] = await Promise.all([
      leadBody.lead_type_id ? req.config.leadTypes.findByPk(leadBody.lead_type_id) : null,
      leadBody.lead_src_id ? req.config.leadSources.findByPk(leadBody.lead_src_id) : null,
      leadBody.lead_status_id ? req.config.leadStatuses.findByPk(leadBody.lead_status_id) : null,
      leadBody.lead_stg_id ? req.config.leadStages.findByPk(leadBody.lead_stg_id) : null,
      leadBody.project_id ? req.config.channelProject.findByPk(leadBody.project_id) : null,
    ]);

    const fkValidationResults = {
      lead_type_id: { provided: leadBody.lead_type_id, valid: !!typeValid },
      lead_src_id: { provided: leadBody.lead_src_id, valid: !!srcValid },
      lead_status_id: { provided: leadBody.lead_status_id, valid: !!statusValid },
      lead_stg_id: { provided: leadBody.lead_stg_id, valid: !!stageValid },
      project_id: { provided: leadBody.project_id, valid: !!projectValid }
    };

    if (leadBody.lead_type_id && !typeValid) leadBody.lead_type_id = null;
    if (leadBody.lead_src_id && !srcValid) leadBody.lead_src_id = null;
    if (leadBody.lead_status_id && !statusValid) leadBody.lead_status_id = null;
    if (leadBody.lead_stg_id && !stageValid) leadBody.lead_stg_id = 1;
    if (leadBody.project_id && !projectValid) leadBody.project_id = null;

    console.log(`[${requestId}] ERP Lead Webhook - FK Validation Results:`, fkValidationResults);

    // When CP_Name is provided, require CP code as well (code/cp_code/user_code/CP_Code)
    const cpCodeFromPayload =
      payload.cp_code || payload.CP_Code || payload.user_code || payload.code || null;

    if (leadBody.CP_Name && !cpCodeFromPayload) {
      const msg =
        "Channel Partner code is required when CP_Name is provided. Please send 'code' or 'cp_code' along with CP_Name.";
      console.log(`[${requestId}] ERP Lead Webhook - Validation Failed: ${msg}`, {
        CP_Name: leadBody.CP_Name,
      });
      return responseError(req, res, msg);
    }

    // MANDATORY: Find and link CP (Channel Partner) user if CP_Name is provided
    // If CP_Name is provided, CP MUST exist in the system - otherwise reject the lead
    if (leadBody.CP_Name) {
      console.log(
        `[${requestId}] ERP Lead Webhook - Attempting to find CP by name: ${leadBody.CP_Name} and code: ${cpCodeFromPayload}`
      );
      try {
        // Try to find CP by CP_Name, CP code (if ERP sends it), or email
        const cpUser = await findCPUser(
          req,
          leadBody.CP_Name,
          cpCodeFromPayload,
          leadBody.email_id
        );

        if (cpUser) {
          leadBody.cp_user_id = cpUser.user_id;
          console.log(
            `[${requestId}] ERP Lead Webhook - ✅ Linked CP: ${leadBody.CP_Name} -> cp_user_id: ${cpUser.user_id} (user_code: ${cpUser.user_code})`
          );
        } else {
          // CP_Name provided but CP not found - REJECT the lead
          console.error(
            `[${requestId}] ERP Lead Webhook - ❌ CP not found for: ${leadBody.CP_Name} (code: ${cpCodeFromPayload}). Lead rejected.`
          );
          const errorMsg = `Channel Partner not found: '${leadBody.CP_Name}'. Please ensure the CP is created and onboarded in the system before creating leads.`;
          return responseError(req, res, errorMsg);
        }
      } catch (cpError) {
        console.error(
          `[${requestId}] ERP Lead Webhook - Error finding CP:`,
          cpError.message
        );
        const errorMsg = `Error finding Channel Partner '${leadBody.CP_Name}': ${cpError.message}`;
        return responseError(req, res, errorMsg);
      }
    }

    // Try upsert by erp_lead_id (primary), then email or phone (fallback)
    // Priority: 1. erp_lead_id (most reliable - ERP's unique identifier)
    //           2. email_id (fallback)
    //           3. p_contact_no (fallback)
    let whereClause = null;
    let searchMethod = null;
    
    if (leadBody.erp_lead_id) {
      whereClause = { erp_lead_id: leadBody.erp_lead_id };
      searchMethod = 'erp_lead_id';
    } else if (leadBody.email_id) {
      whereClause = { email_id: leadBody.email_id };
      searchMethod = 'email_id';
    } else if (leadBody.p_contact_no) {
      whereClause = { p_contact_no: leadBody.p_contact_no };
      searchMethod = 'p_contact_no';
    }

    console.log(`[${requestId}] ERP Lead Webhook - Upsert Search:`, { whereClause, searchMethod });

    let lead;
    if (whereClause) {
      lead = await req.config.leads.findOne({ where: whereClause, transaction: t, paranoid: false });
      console.log(`[${requestId}] ERP Lead Webhook - Existing Lead Found:`, lead ? { 
        lead_id: lead.lead_id, 
        lead_code: lead.lead_code,
        erp_lead_id: lead.erp_lead_id,
        found_by: searchMethod
      } : 'None');
    }

    // If new, generate code
    if (!lead) {
      console.log(`[${requestId}] ERP Lead Webhook - Creating New Lead`);
      const leadCount = await req.config.leads.count({ paranoid: false });
      const first = (req.admin?.user || "E").charAt(0).toUpperCase();
      const last = (req.admin?.user_l_name || "").charAt(0).toUpperCase();
      const code = `${first}${last}L_${String(leadCount + 1).padStart(5, '0')}`;

      leadBody.assigned_by = req.user?.user_id || null;
      leadBody.lead_owner = req.user?.user_id || null;
      leadBody.assigned_lead = req.user?.user_id || null;
      leadBody.lead_code = code;

      console.log(`[${requestId}] ERP Lead Webhook - Lead Data to Create:`, leadBody);
      lead = await req.config.leads.create(leadBody, { transaction: t });
      console.log(`[${requestId}] ERP Lead Webhook - Lead Created Successfully:`, { 
        lead_id: lead.lead_id, 
        lead_code: lead.lead_code,
        erp_lead_id: lead.erp_lead_id 
      });
    } else {
      console.log(`[${requestId}] ERP Lead Webhook - Updating Existing Lead:`, { 
        lead_id: lead.lead_id,
        current_erp_lead_id: lead.erp_lead_id 
      });
      console.log(`[${requestId}] ERP Lead Webhook - Update Data:`, leadBody);
      
      // Explicitly ensure erp_lead_id is included in update
      // Only update erp_lead_id if it's provided in payload (not null/undefined/empty)
      if (payload.erp_lead_id !== undefined && payload.erp_lead_id !== null && payload.erp_lead_id !== '') {
        leadBody.erp_lead_id = payload.erp_lead_id;
        console.log(`[${requestId}] ERP Lead Webhook - Setting erp_lead_id to:`, payload.erp_lead_id);
      }
      
      await lead.update(leadBody, { transaction: t });
      
      // Reload lead to get updated values
      await lead.reload({ transaction: t });
      
      console.log(`[${requestId}] ERP Lead Webhook - Lead Updated Successfully:`, { 
        lead_id: lead.lead_id,
        erp_lead_id: lead.erp_lead_id,
        erp_lead_id_in_body: leadBody.erp_lead_id
      });
    }

    await t.commit();
    console.log(`[${requestId}] ERP Lead Webhook - Transaction Committed`);

    // Optional: notify owner
    try {
      console.log(`[${requestId}] ERP Lead Webhook - Attempting Email Notification`);
      const config = await req.config.emailConfig.findAll();
      const option = {
        subject: lead?._previousDataValues ? "Lead Updated" : "New Lead Created",
        message: `Lead ${lead.lead_name || ''} (${lead.lead_code || ''}) processed via ERP webhook`,
        email: req.admin?.email || null,
        ...(config?.[0] ? {
          host: config[0].host,
          port: config[0].port,
          user: config[0].user,
          pass: config[0].password,
          from: config[0].from,
        } : {}),
      };
      if (option.email) {
        await sendEmail(option);
        console.log(`[${requestId}] ERP Lead Webhook - Email Notification Sent`);
      } else {
        console.log(`[${requestId}] ERP Lead Webhook - No Email Notification (no admin email)`);
      }
    } catch (emailError) {
      console.log(`[${requestId}] ERP Lead Webhook - Email Notification Failed:`, emailError.message);
    }

    console.log(`[${requestId}] ERP Lead Webhook - Success Response:`, { 
      lead_id: lead.lead_id, 
      lead_code: lead.lead_code,
      erp_lead_id: lead.erp_lead_id,
      action: lead?._previousDataValues ? 'updated' : 'created'
    });
    return responseSuccess(req, res, "ERP lead processed", lead);
  } catch (error) {
    console.log(`[${requestId}] ERP Lead Webhook - Error Occurred:`, {
      message: error.message,
      stack: error.stack,
      sqlMessage: error?.original?.sqlMessage
    });
    if (t) await t.rollback();
    logErrorToFile(error);
    const msg = error?.original?.sqlMessage || error?.message || "Failed to process ERP webhook";
    console.log(`[${requestId}] ERP Lead Webhook - Error Response:`, { message: msg });
    return responseError(req, res, msg);
  }
};

/**
 * Upsert a booking from ERP webhook
 * 
 * ⚠️ CRITICAL: Lead is MANDATORY - booking will be rejected without lead
 * 
 * MANDATORY fields (will reject if not provided):
 * ● ERP Lead ID (erp_lead_id) - REQUIRED: Automatically links booking to existing lead by erp_lead_id
 *   OR
 * ● Lead ID (lead_id) - REQUIRED: Direct link to lead (alternative to erp_lead_id)
 * 
 * Required booking fields from client payload:
 * ● ERP Booking ID (erp_booking_id, booking_id, bookingId) - ERP team's booking ID
 * ● Booking Name (booking_name, bookingName)
 * ● Email (email, email_id)
 * ● Contact No. (contact_no, contactNo)
 * ● Project (project, project_name, projectName)
 * ● CP Name (CP_Name, cp_name, cpName)
 * ● Location (location, Location)
 * ● Pincode (pincode, pinCode)
 * ● Created At (created_at, createdAt, created_on)
 * ● Received Date (received_date, recieved_date)
 * ● Flat No. (flat_number, flatNumber, flat_no)
 * ● Buyer ID (buyer_id, buyerId)
 * ● Visit Done Date (visit_done_date, visitDoneDate)
 * ● Visit Done Time (visit_done_time, visitDoneTime)
 * ● Visit Remarks (visit_remarks, visitRemarks)
 * ● Created By (created_by, createdBy)
 * ● Received Time (received_time, recieved_time)
 * ● Block No. (block_number, blockNumber, block_no)
 * ● Booking Status (status, booking_status)
 * 
 * Auto-linking features:
 * ● If erp_lead_id provided: automatically finds lead and sets lead_id
 * ● If project_name/project provided: automatically finds project and sets project_id
 * ● If lead not found: booking will be REJECTED with error message
 */
exports.webhookUpsertBooking = async (req, res) => {
  const t = await req.config.sequelize.transaction();
  const requestId = `BOOKING_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const payload = req.body || {};
    
    // Log incoming request
    console.log(`[${requestId}] ERP Booking Webhook - Incoming Request:`, {
      headers: {
        'x-client-code': req.headers['x-client-code'],
        'x-api-key': req.headers['x-api-key'] ? '***masked***' : 'missing',
        'content-type': req.headers['content-type']
      },
      body: payload,
      timestamp: new Date().toISOString()
    });

    // Comprehensive validation for all required booking fields
    const requiredBookingFields = [
      'erp_booking_id', 'booking_name', 'email', 'contact_no', 'project', 
      'CP_Name', 'location', 'pincode', 'created_at', 'received_date', 
      'flat_number', 'buyer_id', 'visit_done_date', 'visit_done_time', 
      'visit_remarks', 'created_by', 'received_time', 'block_number', 'status'
    ];
    
    const missingBookingFields = [];
    const bookingFieldMappings = {
      'erp_booking_id': ['erp_booking_id', 'bookingId'],
      'booking_name': ['booking_name', 'bookingName'],
      'email': ['email', 'email_id'],
      'contact_no': ['contact_no', 'contactNo'],
      'project': ['project', 'project_name', 'projectName'],
      'CP_Name': ['CP_Name', 'cp_name', 'cpName'],
      'location': ['location', 'Location'],
      'pincode': ['pincode', 'pinCode'],
      'created_at': ['created_at', 'createdAt', 'created_on'],
      'received_date': ['received_date', 'recieved_date'],
      'flat_number': ['flat_number', 'flatNumber', 'flat_no'],
      'buyer_id': ['buyer_id', 'buyerId'],
      'visit_done_date': ['visit_done_date', 'visitDoneDate'],
      'visit_done_time': ['visit_done_time', 'visitDoneTime'],
      'visit_remarks': ['visit_remarks', 'visitRemarks'],
      'created_by': ['created_by', 'createdBy'],
      'received_time': ['received_time', 'recieved_time'],
      'block_number': ['block_number', 'blockNumber', 'block_no'],
      'status': ['status', 'booking_status']
    };

    // Check for missing required fields
    for (const field of requiredBookingFields) {
      const possibleKeys = bookingFieldMappings[field];
      const hasField = possibleKeys.some(key => payload[key] !== undefined && payload[key] !== null && payload[key] !== '');
      if (!hasField) {
        missingBookingFields.push(field);
      }
    }

    const bookingBody = {
      // Required fields mapping
      erp_booking_id: payload.erp_booking_id || payload.bookingId || null,

      booking_name: payload.booking_name || payload.bookingName || null,
      email: payload.email || payload.email_id || null,
      Location: payload.Location || payload.location || null,
      pincode: payload.pincode || null,
      contact_no: payload.contact_no || null,
      visit_done_date: payload.visit_done_date || null,
      visit_done_time: payload.visit_done_time || null,
      visit_remarks: payload.visit_remarks || null,
      revisit_done_date: payload.revisit_done_date || null,
      revisit_done_time: payload.revisit_done_time || null,
      revisit_remarks: payload.revisit_remarks || null,
      lead_id: payload.lead_id || null,
      project_id: payload.project_id || null,
      status: payload.status || undefined,
      sales_booking_id: payload.sales_booking_id || null,
      recieved_date: payload.recieved_date || null,
      recieved_time: payload.recieved_time || null,
      flat_number: payload.flat_number || null,
      block_number: payload.block_number || null,
      buyer_id: payload.buyer_id || null,
      CP_Name: payload.CP_Name || payload.cp_name || payload.cpName || null,
      created_by: payload.created_by || payload.createdBy || null,
      created_at: payload.created_at || payload.createdAt || payload.created_on || null,
    };

    // AUTO-LINK: If erp_lead_id is provided in payload, find and link to existing lead
    let linkedLead = null;
    if (payload.erp_lead_id && !bookingBody.lead_id) {
      console.log(`[${requestId}] ERP Booking Webhook - Attempting to find lead by erp_lead_id: ${payload.erp_lead_id}`);
      try {
        linkedLead = await req.config.leads.findOne({ 
          where: { erp_lead_id: payload.erp_lead_id }, 
          transaction: t 
        });
        if (linkedLead) {
          bookingBody.lead_id = linkedLead.lead_id;
          console.log(`[${requestId}] ERP Booking Webhook - Found and linked lead: lead_id=${linkedLead.lead_id}`);
        } else {
          console.log(`[${requestId}] ERP Booking Webhook - No lead found for erp_lead_id: ${payload.erp_lead_id}`);
        }
      } catch (erpLeadIdError) {
        // If erp_lead_id column doesn't exist, fallback to email/contact lookup
        console.log(`[${requestId}] ERP Booking Webhook - erp_lead_id lookup failed, trying fallback by email/contact:`, erpLeadIdError.message);
        const fallbackWhere = {};
        if (bookingBody.email) {
          fallbackWhere.email_id = bookingBody.email;
        } else if (bookingBody.contact_no) {
          fallbackWhere.p_contact_no = bookingBody.contact_no;
        }
        
        if (Object.keys(fallbackWhere).length > 0) {
          linkedLead = await req.config.leads.findOne({ 
            where: fallbackWhere, 
            transaction: t 
          });
          if (linkedLead) {
            bookingBody.lead_id = linkedLead.lead_id;
            console.log(`[${requestId}] ERP Booking Webhook - Found and linked lead via fallback: lead_id=${linkedLead.lead_id}`);
          } else {
            console.log(`[${requestId}] ERP Booking Webhook - No lead found via fallback method`);
          }
        }
      }
    } else if (bookingBody.lead_id) {
      // If lead_id is directly provided, fetch the lead to get cp_user_id
      linkedLead = await req.config.leads.findByPk(bookingBody.lead_id, { transaction: t });
    }

    // When CP_Name is provided, require CP code as well (code/cp_code/user_code/CP_Code),
    // unless CP is already inherited from the linked lead
    const bookingCPName = payload.CP_Name || payload.cp_name || payload.cpName || null;
    const bookingCpCodeFromPayload =
      payload.cp_code || payload.CP_Code || payload.user_code || payload.code || null;

    if (bookingCPName && !bookingCpCodeFromPayload && !(linkedLead && linkedLead.cp_user_id)) {
      const msg =
        "Channel Partner code is required when CP_Name is provided for booking. Please send 'code' or 'cp_code' along with CP_Name.";
      console.log(
        `[${requestId}] ERP Booking Webhook - Validation Failed (CP code missing): ${msg}`,
        {
          CP_Name: bookingCPName,
        }
      );
      return responseError(req, res, msg);
    }

    // MANDATORY: Find and link CP (Channel Partner) user for booking
    // Priority: 1. Inherit from linked lead's cp_user_id, 2. Find by CP_Name in booking payload
    // If CP_Name is provided but CP not found, REJECT the booking
    if (linkedLead && linkedLead.cp_user_id) {
      bookingBody.cp_user_id = linkedLead.cp_user_id;
      console.log(`[${requestId}] ERP Booking Webhook - ✅ Inherited CP from lead: cp_user_id=${linkedLead.cp_user_id}`);
    } else {
      // Try to find CP by CP_Name in booking payload
      if (bookingCPName) {
        console.log(
          `[${requestId}] ERP Booking Webhook - Attempting to find CP by name: ${bookingCPName} and code: ${bookingCpCodeFromPayload}`
        );
        try {
          // Check for: cp_code, CP_Code, user_code, or code (the field we send to ERP)
          const cpUser = await findCPUser(
            req,
            bookingCPName,
            bookingCpCodeFromPayload,
            bookingBody.email
          );
          
          if (cpUser) {
            bookingBody.cp_user_id = cpUser.user_id;
            console.log(
              `[${requestId}] ERP Booking Webhook - ✅ Linked CP: ${bookingCPName} -> cp_user_id: ${cpUser.user_id} (user_code: ${cpUser.user_code})`
            );
          } else {
            // CP_Name provided but CP not found - REJECT the booking
            console.error(
              `[${requestId}] ERP Booking Webhook - ❌ CP not found for: ${bookingCPName} (code: ${bookingCpCodeFromPayload}). Booking rejected.`
            );
            const errorMsg = `Channel Partner not found: '${bookingCPName}'. Please ensure the CP is created and onboarded in the system before creating bookings.`;
            return responseError(req, res, errorMsg);
          }
        } catch (cpError) {
          console.error(
            `[${requestId}] ERP Booking Webhook - Error finding CP:`,
            cpError.message
          );
          const errorMsg = `Error finding Channel Partner '${bookingCPName}': ${cpError.message}`;
          return responseError(req, res, errorMsg);
        }
      } else {
        // No CP_Name in booking payload and no linked lead with cp_user_id
        // Check if this is acceptable (maybe some bookings don't belong to CPs?)
        // For now, we'll allow it but log a warning
        console.log(`[${requestId}] ERP Booking Webhook - ⚠️ No CP_Name provided in booking payload and no CP inherited from lead. Booking will be created without cp_user_id.`);
      }
    }

    // AUTO-LINK: If project_name is provided in payload, find and link to existing project
    if ((payload.project_name || payload.project || payload.projectName) && !bookingBody.project_id) {
      const projectName = payload.project_name || payload.project || payload.projectName;
      console.log(`[${requestId}] ERP Booking Webhook - Attempting to find project by name: ${projectName}`);
      const existingProject = await req.config.channelProject.findOne({ 
        where: { project: projectName }, 
        transaction: t 
      });
      if (existingProject) {
        bookingBody.project_id = existingProject.project_id;
        console.log(`[${requestId}] ERP Booking Webhook - Found and linked project: project_id=${existingProject.project_id}`);
      } else {
        console.log(`[${requestId}] ERP Booking Webhook - No project found for name: ${projectName}`);
      }
    }

    // Validate FK: lead_id and project_id
    console.log(`[${requestId}] ERP Booking Webhook - Validating Foreign Keys:`, {
      lead_id: bookingBody.lead_id,
      project_id: bookingBody.project_id
    });

    const [leadValid, projectValid] = await Promise.all([
      bookingBody.lead_id ? req.config.leads.findByPk(bookingBody.lead_id) : null,
      bookingBody.project_id ? req.config.channelProject.findByPk(bookingBody.project_id) : null,
    ]);

    const fkValidationResults = {
      lead_id: { provided: bookingBody.lead_id, valid: !!leadValid },
      project_id: { provided: bookingBody.project_id, valid: !!projectValid }
    };

    if (bookingBody.lead_id && !leadValid) bookingBody.lead_id = null;
    if (bookingBody.project_id && !projectValid) bookingBody.project_id = null;

    console.log(`[${requestId}] ERP Booking Webhook - FK Validation Results:`, fkValidationResults);

    // ❌ MANDATORY: Lead is REQUIRED for booking creation
    if (!bookingBody.lead_id) {
      console.log(`[${requestId}] ERP Booking Webhook - Validation Failed: Lead is required`);
      console.log(`[${requestId}] ERP Booking Webhook - Provided: erp_lead_id='${payload.erp_lead_id}', lead_id='${payload.lead_id}'`);
      return responseError(req, res, "Lead is required. Please provide 'erp_lead_id' or 'lead_id' in the payload.");
    }

    // Upsert by erp_booking_id (primary) or sales_booking_id (fallback)
    // Priority: 1. erp_booking_id (most reliable - ERP's unique identifier)
    //           2. sales_booking_id (fallback)
    let booking;
    let whereClause = null;
    let searchMethod = null;
    
    if (bookingBody.erp_booking_id) {
      whereClause = { erp_booking_id: bookingBody.erp_booking_id };
      searchMethod = 'erp_booking_id';
    } else if (bookingBody.sales_booking_id) {
      whereClause = { sales_booking_id: bookingBody.sales_booking_id };
      searchMethod = 'sales_booking_id';
    }
    
    if (whereClause) {
      console.log(`[${requestId}] ERP Booking Webhook - Searching for existing booking by ${searchMethod}:`, whereClause);
      booking = await req.config.leadBooking.findOne({ where: whereClause, transaction: t, paranoid: false });
      console.log(`[${requestId}] ERP Booking Webhook - Existing Booking Found:`, booking ? { 
        booking_id: booking.booking_id, 
        erp_booking_id: booking.erp_booking_id,
        sales_booking_id: booking.sales_booking_id,
        found_by: searchMethod
      } : 'None');
    }

    if (!booking) {
      console.log(`[${requestId}] ERP Booking Webhook - Creating New Booking`);
      console.log(`[${requestId}] ERP Booking Webhook - Booking Data to Create:`, bookingBody);
      booking = await req.config.leadBooking.create(bookingBody, { transaction: t });
      console.log(`[${requestId}] ERP Booking Webhook - Booking Created Successfully:`, { booking_id: booking.booking_id, sales_booking_id: booking.sales_booking_id });
    } else {
      console.log(`[${requestId}] ERP Booking Webhook - Updating Existing Booking:`, { booking_id: booking.booking_id });
      console.log(`[${requestId}] ERP Booking Webhook - Update Data:`, bookingBody);
      await booking.update(bookingBody, { transaction: t });
      console.log(`[${requestId}] ERP Booking Webhook - Booking Updated Successfully`);
    }

    await t.commit();
    console.log(`[${requestId}] ERP Booking Webhook - Transaction Committed`);

    console.log(`[${requestId}] ERP Booking Webhook - Success Response:`, { 
      booking_id: booking.booking_id, 
      sales_booking_id: booking.sales_booking_id,
      action: booking?._previousDataValues ? 'updated' : 'created'
    });
    return responseSuccess(req, res, "ERP booking processed", booking);
  } catch (error) {
    console.log(`[${requestId}] ERP Booking Webhook - Error Occurred:`, {
      message: error.message,
      stack: error.stack,
      sqlMessage: error?.original?.sqlMessage
    });
    if (t) await t.rollback();
    logErrorToFile(error);
    const msg = error?.original?.sqlMessage || error?.message || "Failed to process ERP booking";
    console.log(`[${requestId}] ERP Booking Webhook - Error Response:`, { message: msg });
    return responseError(req, res, msg);
  }
}

// Update booking status from ERP webhook
exports.webhookUpdateBookingStatus = async (req, res) => {
  const t = await req.config.sequelize.transaction();
  const requestId = `STATUS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const payload = req.body || {};
    const { sales_booking_id, erp_booking_id, status } = payload;
    
    // Log incoming request
    console.log(`[${requestId}] ERP Booking Status Webhook - Incoming Request:`, {
      headers: {
        'x-client-code': req.headers['x-client-code'],
        'x-api-key': req.headers['x-api-key'] ? '***masked***' : 'missing',
        'content-type': req.headers['content-type']
      },
      body: payload,
      timestamp: new Date().toISOString()
    });

    // Require at least one identifier and status
    if (!sales_booking_id && !erp_booking_id) {
      console.log(`[${requestId}] ERP Booking Status Webhook - Validation Failed: Missing sales_booking_id or booking_id`);
      return responseError(req, res, "sales_booking_id or booking_id is required");
    }
    if (!status) {
      console.log(`[${requestId}] ERP Booking Status Webhook - Validation Failed: Missing status`);
      return responseError(req, res, "status is required");
    }

    // Valid status values from the model enum
    const validStatuses = ['Payment Initiated', 'Payment Received', 'Payment Rejected', 'Booking Done', 'Eligible for brokerage bill', 'Bill Received', 'Bill sent', 'VISIT DONE NOT BOOKED'];
    if (!validStatuses.includes(status)) {
      console.log(`[${requestId}] ERP Booking Status Webhook - Validation Failed: Invalid status '${status}'. Valid statuses:`, validStatuses);
      return responseError(req, res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Find booking by sales_booking_id or booking_id
    const whereClause = sales_booking_id 
      ? { sales_booking_id } 
      : { erp_booking_id };

    console.log(`[${requestId}] ERP Booking Status Webhook - Searching for booking:`, whereClause);

    const booking = await req.config.leadBooking.findOne({ 
      where: whereClause, 
      transaction: t, 
      paranoid: false 
    });

    if (!booking) {
      console.log(`[${requestId}] ERP Booking Status Webhook - Booking Not Found:`, whereClause);
      return responseError(req, res, "Booking not found");
    }

    console.log(`[${requestId}] ERP Booking Status Webhook - Booking Found:`, { 
      erp_booking_id: booking.erp_booking_id, 
      sales_booking_id: booking.sales_booking_id,
      current_status: booking.status,
      new_status: status
    });

    // Update status
    console.log(`[${requestId}] ERP Booking Status Webhook - Updating Status from '${booking.status}' to '${status}'`);
    await booking.update({ status }, { transaction: t });
    await t.commit();
    console.log(`[${requestId}] ERP Booking Status Webhook - Transaction Committed`);

    console.log(`[${requestId}] ERP Booking Status Webhook - Success Response:`, { 
      erp_booking_id: booking.erp_booking_id, 
      sales_booking_id: booking.sales_booking_id,
      old_status: booking._previousDataValues?.status,
      new_status: status
    });
    return responseSuccess(req, res, "Booking status updated", booking);
  } catch (error) {
    console.log(`[${requestId}] ERP Booking Status Webhook - Error Occurred:`, {
      message: error.message,
      stack: error.stack,
      sqlMessage: error?.original?.sqlMessage
    });
    if (t) await t.rollback();
    logErrorToFile(error);
    const msg = error?.original?.sqlMessage || error?.message || "Failed to update booking status";
    console.log(`[${requestId}] ERP Booking Status Webhook - Error Response:`, { message: msg });
    return responseError(req, res, msg);
  }
}


