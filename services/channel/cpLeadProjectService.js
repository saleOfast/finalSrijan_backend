const { QueryTypes } = require("sequelize");

const parseBstIds = (raw) => {
  if (raw === undefined || raw === null || raw === "") return [];
  let values = raw;
  if (typeof values === "string") {
    const trimmed = values.trim();
    if (!trimmed) return [];
    try {
      values = JSON.parse(trimmed);
    } catch (_e) {
      values = trimmed.split(",");
    }
  }
  if (!Array.isArray(values)) values = [values];
  return [...new Set(
    values
      .map((v) => Number(String(v).trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
  )];
};

const normalizeBstId = (raw) => {
  if (raw === undefined || raw === null || raw === "") return null;
  const id = Number(String(raw).trim());
  return Number.isInteger(id) && id > 0 ? id : null;
};

const normalizeProjectIds = (project_ids) => {
  let values = project_ids;
  if (typeof values === "string") {
    const trimmed = values.trim();
    if (!trimmed) return [];
    try {
      values = JSON.parse(trimmed);
    } catch (_e) {
      values = trimmed.split(",");
    }
  }
  if (!Array.isArray(values)) values = [values];
  return [...new Set(
    values
      .map((v) => Number(String(v).trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
  )];
};

const normalizeDbName = (db_name) => {
  if (!db_name) return "";
  const safe = String(db_name).trim();
  if (!/^[A-Za-z0-9_]+$/.test(safe)) {
    throw new Error("Invalid db_name");
  }
  return `${safe}.`;
};

const assertLeadExists = async (sequelize, dbNamePrefix, cpl_id) => {
  const lead = await sequelize.query(
    `
      SELECT cpl_id
      FROM ${dbNamePrefix}db_channel_partner_leads
      WHERE cpl_id = :cpl_id AND deletedAt IS NULL
      LIMIT 1
    `,
    {
      replacements: { cpl_id },
      type: QueryTypes.SELECT,
    }
  );
  return !!lead[0];
};

const fetchValidProjectIds = async (sequelize, dbNamePrefix, project_ids) => {
  if (!project_ids.length) return [];
  const rows = await sequelize.query(
    `
      SELECT project_id
      FROM ${dbNamePrefix}db_channel_projects
      WHERE project_id IN (:project_ids) AND deletedAt IS NULL
    `,
    {
      replacements: { project_ids },
      type: QueryTypes.SELECT,
    }
  );
  return rows.map((r) => Number(r.project_id));
};

const fetchProjectsWithBst = async (sequelize, dbNamePrefix, project_ids) => {
  if (!project_ids.length) return [];
  return sequelize.query(
    `
      SELECT project_id, project, bst
      FROM ${dbNamePrefix}db_channel_projects
      WHERE project_id IN (:project_ids) AND deletedAt IS NULL
    `,
    {
      replacements: { project_ids },
      type: QueryTypes.SELECT,
    }
  );
};

const fetchBstUser = async (sequelize, dbNamePrefix, bst_id) => {
  const rows = await sequelize.query(
    `
      SELECT user_id, user, user_l_name, state_id, city_id, zone
      FROM ${dbNamePrefix}db_users
      WHERE user_id = :bst_id
        AND role_id = 2
        AND user_status = true
        AND deletedAt IS NULL
      LIMIT 1
    `,
    {
      replacements: { bst_id },
      type: QueryTypes.SELECT,
    }
  );
  if (!rows[0]) return null;
  const user = rows[0];
  return {
    user_id: Number(user.user_id),
    name: [user.user, user.user_l_name].filter(Boolean).join(" ").trim() || null,
    state_id: user.state_id ?? null,
    city_id: user.city_id ?? null,
    zone: user.zone || null,
  };
};

const assertBstAllowedForProjects = (bst_id, projects) => {
  const projectsWithBst = projects.filter((p) => parseBstIds(p.bst).length > 0);
  if (!projectsWithBst.length) return { ok: true };
  const allowed = new Set(
    projectsWithBst.flatMap((p) => parseBstIds(p.bst))
  );
  if (allowed.has(bst_id)) return { ok: true };
  return {
    ok: false,
    message: "Selected BST is not assigned to any of the chosen projects",
  };
};

const assignBstToCpLead = async (sequelize, dbNamePrefix, cpl_id, bst_id) => {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  await sequelize.query(
    `
      UPDATE ${dbNamePrefix}db_channel_partner_leads
      SET asssigned_to = :bst_id, updatedAt = :now
      WHERE cpl_id = :cpl_id AND deletedAt IS NULL
    `,
    {
      replacements: { bst_id, cpl_id, now },
      type: QueryTypes.UPDATE,
    }
  );
};

const getLeadBstAssignment = async (sequelize, dbNamePrefix, cpl_id) => {
  const rows = await sequelize.query(
    `
      SELECT l.asssigned_to AS bst_id, u.user, u.user_l_name
      FROM ${dbNamePrefix}db_channel_partner_leads l
      LEFT JOIN ${dbNamePrefix}db_users u
        ON u.user_id = l.asssigned_to AND u.deletedAt IS NULL
      WHERE l.cpl_id = :cpl_id AND l.deletedAt IS NULL
      LIMIT 1
    `,
    {
      replacements: { cpl_id },
      type: QueryTypes.SELECT,
    }
  );
  const row = rows[0];
  if (!row || !row.bst_id) {
    return { asssigned_to: null, assigned_bst: null };
  }
  const bstId = Number(row.bst_id);
  const assigned_bst = await fetchBstUser(sequelize, dbNamePrefix, bstId);
  return {
    asssigned_to: bstId,
    assigned_bst: assigned_bst || {
      user_id: bstId,
      name: [row.user, row.user_l_name].filter(Boolean).join(" ").trim() || null,
    },
  };
};

const replaceLeadProjects = async (sequelize, dbNamePrefix, cpl_id, project_ids) => {
  await sequelize.query(
    `
      DELETE FROM ${dbNamePrefix}cp_lead_projects
      WHERE cpl_id = :cpl_id
    `,
    {
      replacements: { cpl_id },
      type: QueryTypes.DELETE,
    }
  );

  if (!project_ids.length) return;

  const now = new Date();
  const valuesSql = project_ids
    .map((project_id) => `(${Number(cpl_id)}, ${Number(project_id)}, '${now.toISOString().slice(0, 19).replace("T", " ")}', '${now.toISOString().slice(0, 19).replace("T", " ")}')`)
    .join(", ");

  await sequelize.query(
    `
      INSERT INTO ${dbNamePrefix}cp_lead_projects (cpl_id, project_id, createdAt, updatedAt)
      VALUES ${valuesSql}
    `,
    { type: QueryTypes.INSERT }
  );
};

const getLeadProjects = async (sequelize, cpl_id, dbNamePrefix = "") => {
  return sequelize.query(
    `
      SELECT p.project_id, p.project, p.state_id, p.city_id, p.zone
      FROM ${dbNamePrefix}cp_lead_projects clp
      INNER JOIN ${dbNamePrefix}db_channel_projects p
        ON p.project_id = clp.project_id AND p.deletedAt IS NULL
      WHERE clp.cpl_id = :cpl_id
      ORDER BY p.project ASC
    `,
    {
      replacements: { cpl_id },
      type: QueryTypes.SELECT,
    }
  );
};

const assignProjectsToCpLead = async (sequelize, payload) => {
  const dbNamePrefix = normalizeDbName(payload.db_name);
  const cpl_id = Number(payload.cpl_id);
  const projectIdsProvided = payload.project_ids !== undefined;
  const project_ids = projectIdsProvided ? normalizeProjectIds(payload.project_ids) : [];
  const bst_id = normalizeBstId(
    payload.bst_id !== undefined ? payload.bst_id : payload.asssigned_to
  );

  if (!Number.isInteger(cpl_id) || cpl_id <= 0) {
    return { ok: false, message: "cpl_id is required and must be a valid number" };
  }

  if (!projectIdsProvided && !bst_id) {
    return { ok: false, message: "Provide project_ids and/or bst_id to assign to the CP lead" };
  }

  const leadExists = await assertLeadExists(sequelize, dbNamePrefix, cpl_id);
  if (!leadExists) {
    return { ok: false, message: "CP lead not found for provided cpl_id" };
  }

  let validProjectIds = [];
  if (projectIdsProvided) {
    validProjectIds = await fetchValidProjectIds(sequelize, dbNamePrefix, project_ids);
    if (validProjectIds.length !== project_ids.length) {
      const found = new Set(validProjectIds);
      const invalid = project_ids.filter((id) => !found.has(id));
      return { ok: false, message: `Invalid project_ids: ${invalid.join(", ")}` };
    }

    if (validProjectIds.length > 0 && !bst_id) {
      return { ok: false, message: "bst_id is required when assigning projects to a CP lead" };
    }
  }

  if (bst_id) {
    const bstUser = await fetchBstUser(sequelize, dbNamePrefix, bst_id);
    if (!bstUser) {
      return { ok: false, message: "Invalid or inactive BST user for provided bst_id" };
    }

    const projectIdsForBstCheck = validProjectIds.length
      ? validProjectIds
      : (await getLeadProjects(sequelize, cpl_id, dbNamePrefix)).map((p) => Number(p.project_id));

    if (projectIdsForBstCheck.length) {
      const projects = await fetchProjectsWithBst(sequelize, dbNamePrefix, projectIdsForBstCheck);
      const bstCheck = assertBstAllowedForProjects(bst_id, projects);
      if (!bstCheck.ok) {
        return { ok: false, message: bstCheck.message };
      }
    }
  }

  if (projectIdsProvided) {
    await replaceLeadProjects(sequelize, dbNamePrefix, cpl_id, validProjectIds);
  } else {
    validProjectIds = (await getLeadProjects(sequelize, cpl_id, dbNamePrefix)).map(
      (p) => Number(p.project_id)
    );
  }

  let assigned_bst = null;
  let asssigned_to = null;
  if (bst_id) {
    await assignBstToCpLead(sequelize, dbNamePrefix, cpl_id, bst_id);
    assigned_bst = await fetchBstUser(sequelize, dbNamePrefix, bst_id);
    asssigned_to = bst_id;
  } else {
    const current = await getLeadBstAssignment(sequelize, dbNamePrefix, cpl_id);
    asssigned_to = current.asssigned_to;
    assigned_bst = current.assigned_bst;
  }

  const assigned_projects = await getLeadProjects(sequelize, cpl_id, dbNamePrefix);
  return {
    ok: true,
    data: {
      cpl_id,
      assigned_projects,
      project_ids: validProjectIds,
      asssigned_to,
      assigned_bst,
    },
  };
};

const getCpAssignedProjectsView = async (sequelize, user) => {
  const cpLead = await sequelize.query(
    `
      SELECT cpl_id, first_name, last_name
      FROM db_channel_partner_leads
      WHERE deletedAt IS NULL
        AND (email = :email OR contact = :contact)
      ORDER BY cpl_id DESC
      LIMIT 1
    `,
    {
      replacements: {
        email: user.email || "",
        contact: user.contact_number || null,
      },
      type: QueryTypes.SELECT,
    }
  );

  const lead = cpLead[0];
  const assigned_projects = lead ? await getLeadProjects(sequelize, lead.cpl_id) : [];
  return {
    user_id: user.user_id,
    name: [user.user, user.user_l_name].filter(Boolean).join(" ").trim(),
    cpl_id: lead?.cpl_id || null,
    assigned_projects,
  };
};

const getBstAssignedCpLeadsView = async (sequelize, user) => {
  const rows = await sequelize.query(
    `
      SELECT
        l.cpl_id,
        l.first_name,
        l.last_name,
        l.email,
        l.contact,
        p.project_id,
        p.project,
        p.state_id,
        p.city_id,
        p.zone
      FROM db_channel_partner_leads l
      LEFT JOIN cp_lead_projects clp
        ON clp.cpl_id = l.cpl_id
      LEFT JOIN db_channel_projects p
        ON p.project_id = clp.project_id
        AND p.deletedAt IS NULL
      WHERE l.asssigned_to = :bst_user_id
        AND l.deletedAt IS NULL
      ORDER BY l.cpl_id DESC, p.project ASC
    `,
    {
      replacements: { bst_user_id: user.user_id },
      type: QueryTypes.SELECT,
    }
  );

  const leadMap = new Map();
  for (const row of rows) {
    if (!leadMap.has(row.cpl_id)) {
      leadMap.set(row.cpl_id, {
        cpl_id: row.cpl_id,
        cp_name: [row.first_name, row.last_name].filter(Boolean).join(" ").trim(),
        email: row.email || null,
        contact: row.contact || null,
        projects: [],
      });
    }
    if (row.project_id) {
      leadMap.get(row.cpl_id).projects.push({
        project_id: row.project_id,
        project: row.project,
        state_id: row.state_id,
        city_id: row.city_id,
        zone: row.zone,
      });
    }
  }

  return {
    user_id: user.user_id,
    name: [user.user, user.user_l_name].filter(Boolean).join(" ").trim(),
    assigned_cp_leads: Array.from(leadMap.values()),
  };
};

module.exports = {
  assignProjectsToCpLead,
  getLeadProjects,
  getLeadBstAssignment,
  getCpAssignedProjectsView,
  getBstAssignedCpLeadsView,
};
