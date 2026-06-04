const { Op } = require("sequelize");
const { CP_ACTIVITY_VALUES, normalizeActivity } = require("../../constants/cpActivity");

const parseOptionalDate = (raw) => {
  if (raw === undefined || raw === null || raw === "") return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseOptionalCplId = (raw) => {
  if (raw === undefined || raw === null || raw === "") return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const fetchCpUser = async (config, user_id) => {
  return config.users.findOne({
    where: {
      user_id,
      role_id: 1,
      deletedAt: null,
    },
    attributes: [
      "user_id",
      "user",
      "user_l_name",
      "email",
      "contact_number",
      "report_to",
      "doc_verification",
      "activity",
      "follow_up_date",
      "follow_up_remarks",
    ],
  });
};

const canManageCpFollowup = async (config, actor, cpUser) => {
  if (!actor || !cpUser) return false;
  if (actor.isDB) return true;

  const actorRole = Number(actor.role_id);
  const cpReportTo = Number(cpUser.report_to);

  if (actorRole === 2) {
    return cpReportTo === Number(actor.user_id);
  }

  if (actorRole === 3) {
    if (cpReportTo === Number(actor.user_id)) return true;
    const bstUsers = await config.users.findAll({
      where: {
        report_to: actor.user_id,
        role_id: 2,
        user_status: true,
        deletedAt: null,
      },
      attributes: ["user_id"],
    });
    const bstIds = new Set(bstUsers.map((u) => Number(u.user_id)));
    return bstIds.has(cpReportTo);
  }

  return false;
};

const recordCpFollowup = async (config, actor, payload) => {
  const user_id = Number(payload.user_id);
  const activity = normalizeActivity(payload.activity);

  if (!Number.isInteger(user_id) || user_id <= 0) {
    return { ok: false, message: "user_id is required and must be a valid number" };
  }
  if (!activity) {
    return {
      ok: false,
      message: `activity is required and must be one of: ${CP_ACTIVITY_VALUES.join(", ")}`,
    };
  }

  const cpUser = await fetchCpUser(config, user_id);
  if (!cpUser) {
    return { ok: false, message: "Channel Partner user not found" };
  }

  const allowed = await canManageCpFollowup(config, actor, cpUser);
  if (!allowed) {
    return { ok: false, message: "You are not allowed to add follow-up for this Channel Partner" };
  }

  const follow_up_date = parseOptionalDate(payload.follow_up_date);
  const follow_up_remarks =
    payload.follow_up_remarks !== undefined
      ? payload.follow_up_remarks
      : payload.remarks;
  const remarks =
    follow_up_remarks === undefined || follow_up_remarks === null
      ? null
      : String(follow_up_remarks).trim() || null;
  const cpl_id = parseOptionalCplId(payload.cpl_id);
  const status = payload.status !== undefined ? !!payload.status : true;
  const created_by = actor?.user_id ? Number(actor.user_id) : null;

  await cpUser.update({
    activity,
    follow_up_date,
    follow_up_remarks: remarks,
  });

  const historyRow = await config.cpFollowupHistory.create({
    user_id,
    activity,
    follow_up_date,
    remarks,
    created_by,
    cpl_id,
    status,
  });

  const createdByUser = created_by
    ? await config.users.findOne({
        where: { user_id: created_by },
        attributes: ["user_id", "user", "user_l_name"],
      })
    : null;

  return {
    ok: true,
    data: {
      user_id,
      activity,
      follow_up_date,
      follow_up_remarks: remarks,
      asssigned_to: cpUser.report_to,
      latest_followup: {
        cp_followup_id: historyRow.cp_followup_id,
        activity: historyRow.activity,
        follow_up_date: historyRow.follow_up_date,
        remarks: historyRow.remarks,
        created_by,
        created_by_name: createdByUser
          ? [createdByUser.user, createdByUser.user_l_name].filter(Boolean).join(" ").trim()
          : null,
        cpl_id: historyRow.cpl_id,
        createdAt: historyRow.createdAt,
      },
    },
  };
};

const getCpFollowupHistory = async (config, actor, user_id) => {
  const parsedUserId = Number(user_id);
  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    return { ok: false, message: "user_id is required and must be a valid number" };
  }

  const cpUser = await fetchCpUser(config, parsedUserId);
  if (!cpUser) {
    return { ok: false, message: "Channel Partner user not found" };
  }

  const allowed = await canManageCpFollowup(config, actor, cpUser);
  if (!allowed) {
    return { ok: false, message: "You are not allowed to view follow-up history for this Channel Partner" };
  }

  const history = await config.cpFollowupHistory.findAll({
    where: { user_id: parsedUserId },
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: config.users,
        as: "followupBy",
        attributes: ["user_id", "user", "user_l_name"],
        required: false,
      },
    ],
  });

  const rows = history.map((row) => {
    const plain = row.toJSON ? row.toJSON() : row;
    const by = plain.followupBy;
    return {
      cp_followup_id: plain.cp_followup_id,
      user_id: plain.user_id,
      activity: plain.activity,
      follow_up_date: plain.follow_up_date,
      remarks: plain.remarks,
      created_by: plain.created_by,
      created_by_name: by
        ? [by.user, by.user_l_name].filter(Boolean).join(" ").trim()
        : null,
      cpl_id: plain.cpl_id,
      status: plain.status,
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
    };
  });

  return {
    ok: true,
    data: {
      user_id: parsedUserId,
      cp_name: [cpUser.user, cpUser.user_l_name].filter(Boolean).join(" ").trim(),
      activity: cpUser.activity,
      follow_up_date: cpUser.follow_up_date,
      follow_up_remarks: cpUser.follow_up_remarks,
      history: rows,
    },
  };
};

module.exports = {
  CP_ACTIVITY_VALUES,
  recordCpFollowup,
  getCpFollowupHistory,
  canManageCpFollowup,
};
