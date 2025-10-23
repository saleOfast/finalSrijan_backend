const { responseError, responseSuccess } = require("../helper/responce");
const { sendEmail } = require("../common/mailer");

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
      // Default values for required fields
      lead_stg_id: 1,
      lead_src_id: null,
      lead_type_id: null,
      lead_status_id: null,
    };

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

    // Try upsert by email or phone
    const whereClause = leadBody.email_id
      ? { email_id: leadBody.email_id }
      : leadBody.p_contact_no
        ? { p_contact_no: leadBody.p_contact_no }
        : null;

    console.log(`[${requestId}] ERP Lead Webhook - Upsert Search:`, { whereClause });

    let lead;
    if (whereClause) {
      lead = await req.config.leads.findOne({ where: whereClause, transaction: t, paranoid: false });
      console.log(`[${requestId}] ERP Lead Webhook - Existing Lead Found:`, lead ? { lead_id: lead.lead_id, lead_code: lead.lead_code } : 'None');
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
      console.log(`[${requestId}] ERP Lead Webhook - Lead Created Successfully:`, { lead_id: lead.lead_id, lead_code: lead.lead_code });
    } else {
      console.log(`[${requestId}] ERP Lead Webhook - Updating Existing Lead:`, { lead_id: lead.lead_id });
      console.log(`[${requestId}] ERP Lead Webhook - Update Data:`, leadBody);
      await lead.update(leadBody, { transaction: t });
      console.log(`[${requestId}] ERP Lead Webhook - Lead Updated Successfully`);
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

// Upsert a booking from ERP webhook
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

    // Require at least a unique external id or lead linkage
    if (!payload.sales_booking_id && !payload.lead_id) {
      console.log(`[${requestId}] ERP Booking Webhook - Validation Failed: Missing sales_booking_id or lead_id`);
      return responseError(req, res, "sales_booking_id or lead_id is required");
    }

    const bookingBody = {
      booking_name: payload.booking_name || null,
      email: payload.email || null,
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
    };

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

    // Upsert by sales_booking_id if present, else create new
    let booking;
    if (bookingBody.sales_booking_id) {
      console.log(`[${requestId}] ERP Booking Webhook - Searching for existing booking by sales_booking_id:`, bookingBody.sales_booking_id);
      booking = await req.config.leadBooking.findOne({ where: { sales_booking_id: bookingBody.sales_booking_id }, transaction: t, paranoid: false });
      console.log(`[${requestId}] ERP Booking Webhook - Existing Booking Found:`, booking ? { booking_id: booking.booking_id, sales_booking_id: booking.sales_booking_id } : 'None');
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
    const { sales_booking_id, booking_id, status } = payload;
    
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
    if (!sales_booking_id && !booking_id) {
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
      : { booking_id };

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
      booking_id: booking.booking_id, 
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
      booking_id: booking.booking_id, 
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


