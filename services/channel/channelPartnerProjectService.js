const { QueryTypes } = require("sequelize");

const normalizeProjectIds = (project_ids) => {
  let values = project_ids;
  if (values === undefined || values === null || values === "") return [];

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

const getCpUserByCode = async (config, user_code) => {
  return config.users.findOne({
    where: {
      user_code,
      role_id: 1,
      deletedAt: null,
    },
    attributes: ["user_id", "user", "user_l_name", "email", "contact_number", "user_code", "report_to"],
  });
};

const fetchProjectsByIds = async (sequelize, project_ids) => {
  if (!project_ids.length) return [];
  return sequelize.query(
    `
      SELECT
        project_id, project, location, property_size, unit_area, price,
        contact_no, cover_image, logo_image, html_file
      FROM db_channel_projects
      WHERE project_id IN (:project_ids) AND deletedAt IS NULL
    `,
    {
      replacements: { project_ids },
      type: QueryTypes.SELECT,
    }
  );
};

const replaceCpProjects = async (config, cpUserId, projects) => {
  await config.userProjectModel.destroy({
    where: { created_by: cpUserId },
  });

  if (!projects.length) return;

  await config.userProjectModel.bulkCreate(
    projects.map((p) => ({
      created_by: cpUserId,
      project_id: p.project_id,
      project: p.project,
      location: p.location,
      property_size: p.property_size,
      unit_area: p.unit_area,
      price: p.price,
      contact_no: p.contact_no,
      cover_image: p.cover_image,
      logo_image: p.logo_image,
      html_file: p.html_file,
      status: true,
    }))
  );
};

const getCpAssignedProjectsView = async (config, user) => {
  const directAssignedProjects = await config.sequelize.query(
    `
      SELECT p.project_id, p.project, p.state_id, p.city_id, p.zone
      FROM db_user_channel_projects ucp
      INNER JOIN db_channel_projects p
        ON p.project_id = ucp.project_id
       AND p.deletedAt IS NULL
      WHERE ucp.created_by = :user_id
        AND ucp.deletedAt IS NULL
      ORDER BY p.project ASC
    `,
    {
      replacements: { user_id: user.user_id },
      type: QueryTypes.SELECT,
    }
  );

  // Also include projects assigned through CP Lead mapping (cp_lead_projects),
  // matched by CP email/contact to their lead records.
  const leadBasedProjects = await config.sequelize.query(
    `
      SELECT p.project_id, p.project, p.state_id, p.city_id, p.zone
      FROM db_channel_partner_leads l
      INNER JOIN cp_lead_projects clp
        ON clp.cpl_id = l.cpl_id
       AND clp.deletedAt IS NULL
      INNER JOIN db_channel_projects p
        ON p.project_id = clp.project_id
       AND p.deletedAt IS NULL
      WHERE l.deletedAt IS NULL
        AND (
          (:email <> '' AND l.email = :email)
          OR (
            :contact IS NOT NULL
            AND l.contact IS NOT NULL
            AND RIGHT(CAST(l.contact AS CHAR), 10) = RIGHT(CAST(:contact AS CHAR), 10)
          )
        )
      ORDER BY p.project ASC
    `,
    {
      replacements: {
        email: user.email || "",
        contact: user.contact_number || null,
      },
      type: QueryTypes.SELECT,
    }
  );

  // Merge direct + lead-based assignments without duplicates.
  const projectMap = new Map();
  [...directAssignedProjects, ...leadBasedProjects].forEach((p) => {
    projectMap.set(Number(p.project_id), p);
  });
  const assigned_projects = Array.from(projectMap.values()).sort((a, b) =>
    String(a.project || "").localeCompare(String(b.project || ""))
  );

  return {
    user_id: user.user_id,
    name: [user.user, user.user_l_name].filter(Boolean).join(" ").trim(),
    assigned_projects,
  };
};

const getBstAssignedChannelPartnersView = async (config, user) => {
  const directRows = await config.sequelize.query(
    `
      SELECT
        cp.user_id AS cp_user_id,
        cp.user AS cp_first_name,
        cp.user_l_name AS cp_last_name,
        cp.user_code AS cp_user_code,
        p.project_id,
        p.project,
        p.state_id,
        p.city_id,
        p.zone
      FROM db_users cp
      INNER JOIN db_user_channel_projects ucp
        ON ucp.created_by = cp.user_id
       AND ucp.deletedAt IS NULL
      INNER JOIN db_channel_projects p
        ON p.project_id = ucp.project_id
       AND p.deletedAt IS NULL
      WHERE cp.role_id = 1
        AND cp.deletedAt IS NULL
        AND JSON_CONTAINS(
          COALESCE(NULLIF(p.bst, ''), '[]'),
          CAST(:bst_user_id AS JSON),
          '$'
        )
      ORDER BY cp.user_id DESC, p.project ASC
    `,
    {
      replacements: { bst_user_id: user.user_id },
      type: QueryTypes.SELECT,
    }
  );

  const leadBasedRows = await config.sequelize.query(
    `
      SELECT
        cp.user_id AS cp_user_id,
        cp.user AS cp_first_name,
        cp.user_l_name AS cp_last_name,
        cp.user_code AS cp_user_code,
        p.project_id,
        p.project,
        p.state_id,
        p.city_id,
        p.zone
      FROM db_users cp
      INNER JOIN db_channel_partner_leads l
        ON l.deletedAt IS NULL
       AND (
         (cp.email IS NOT NULL AND cp.email <> '' AND l.email = cp.email)
         OR (
           cp.contact_number IS NOT NULL
           AND l.contact IS NOT NULL
           AND RIGHT(CAST(l.contact AS CHAR), 10) = RIGHT(CAST(cp.contact_number AS CHAR), 10)
         )
       )
      INNER JOIN cp_lead_projects clp
        ON clp.cpl_id = l.cpl_id
       AND clp.deletedAt IS NULL
      INNER JOIN db_channel_projects p
        ON p.project_id = clp.project_id
       AND p.deletedAt IS NULL
      WHERE cp.role_id = 1
        AND cp.deletedAt IS NULL
        AND JSON_CONTAINS(
          COALESCE(NULLIF(p.bst, ''), '[]'),
          CAST(:bst_user_id AS JSON),
          '$'
        )
      ORDER BY cp.user_id DESC, p.project ASC
    `,
    {
      replacements: { bst_user_id: user.user_id },
      type: QueryTypes.SELECT,
    }
  );

  const cpMap = new Map();
  for (const row of [...directRows, ...leadBasedRows]) {
    if (!cpMap.has(row.cp_user_id)) {
      cpMap.set(row.cp_user_id, {
        user_id: row.cp_user_id,
        cp_name: [row.cp_first_name, row.cp_last_name].filter(Boolean).join(" ").trim(),
        user_code: row.cp_user_code,
        projects: [],
      });
    }
    if (row.project_id) {
      const cpEntry = cpMap.get(row.cp_user_id);
      if (!cpEntry.projects.some((p) => Number(p.project_id) === Number(row.project_id))) {
        cpEntry.projects.push({
          project_id: row.project_id,
          project: row.project,
          state_id: row.state_id,
          city_id: row.city_id,
          zone: row.zone,
        });
      }
    }
  }

  return {
    user_id: user.user_id,
    name: [user.user, user.user_l_name].filter(Boolean).join(" ").trim(),
    assigned_channel_partners: Array.from(cpMap.values()),
  };
};

const getBstCpProjectMap = async (config, bst_user_id, cp_user_ids) => {
  if (!cp_user_ids || !cp_user_ids.length) return new Map();

  const directRows = await config.sequelize.query(
    `
      SELECT
        cp.user_id AS cp_user_id,
        p.project_id,
        p.project,
        p.state_id,
        p.city_id,
        p.zone
      FROM db_users cp
      INNER JOIN db_user_channel_projects ucp
        ON ucp.created_by = cp.user_id
       AND ucp.deletedAt IS NULL
      INNER JOIN db_channel_projects p
        ON p.project_id = ucp.project_id
       AND p.deletedAt IS NULL
      WHERE cp.user_id IN (:cp_user_ids)
        AND JSON_CONTAINS(
          COALESCE(NULLIF(p.bst, ''), '[]'),
          CAST(:bst_user_id AS JSON),
          '$'
        )
      ORDER BY cp.user_id DESC, p.project ASC
    `,
    {
      replacements: { cp_user_ids, bst_user_id },
      type: QueryTypes.SELECT,
    }
  );

  const leadRows = await config.sequelize.query(
    `
      SELECT
        cp.user_id AS cp_user_id,
        p.project_id,
        p.project,
        p.state_id,
        p.city_id,
        p.zone
      FROM db_users cp
      INNER JOIN db_channel_partner_leads l
        ON l.deletedAt IS NULL
       AND (
         (cp.email IS NOT NULL AND cp.email <> '' AND l.email = cp.email)
         OR (
           cp.contact_number IS NOT NULL
           AND l.contact IS NOT NULL
           AND RIGHT(CAST(l.contact AS CHAR), 10) = RIGHT(CAST(cp.contact_number AS CHAR), 10)
         )
       )
      INNER JOIN cp_lead_projects clp
        ON clp.cpl_id = l.cpl_id
       AND clp.deletedAt IS NULL
      INNER JOIN db_channel_projects p
        ON p.project_id = clp.project_id
       AND p.deletedAt IS NULL
      WHERE cp.user_id IN (:cp_user_ids)
        AND JSON_CONTAINS(
          COALESCE(NULLIF(p.bst, ''), '[]'),
          CAST(:bst_user_id AS JSON),
          '$'
        )
      ORDER BY cp.user_id DESC, p.project ASC
    `,
    {
      replacements: { cp_user_ids, bst_user_id },
      type: QueryTypes.SELECT,
    }
  );

  const map = new Map();
  [...directRows, ...leadRows].forEach((row) => {
    const key = Number(row.cp_user_id);
    if (!map.has(key)) map.set(key, []);
    const list = map.get(key);
    if (!list.some((p) => Number(p.project_id) === Number(row.project_id))) {
      list.push({
        project_id: row.project_id,
        project: row.project,
        state_id: row.state_id,
        city_id: row.city_id,
        zone: row.zone,
      });
    }
  });

  return map;
};

const assignProjectsToChannelPartner = async (config, payload) => {
  const user_code = payload.user_code;
  const project_ids = normalizeProjectIds(payload.project_ids);

  if (!user_code) {
    return { ok: false, message: "user_code is required" };
  }

  const cpUser = await getCpUserByCode(config, user_code);
  if (!cpUser) {
    return { ok: false, message: "Channel Partner not found for provided user_code" };
  }

  const projects = await fetchProjectsByIds(config.sequelize, project_ids);
  if (projects.length !== project_ids.length) {
    const found = new Set(projects.map((p) => Number(p.project_id)));
    const invalid = project_ids.filter((id) => !found.has(id));
    return { ok: false, message: `Invalid project_ids: ${invalid.join(", ")}` };
  }

  await replaceCpProjects(config, cpUser.user_id, projects);

  const assigned_projects = await config.sequelize.query(
    `
      SELECT p.project_id, p.project, p.state_id, p.city_id, p.zone
      FROM db_user_channel_projects ucp
      INNER JOIN db_channel_projects p
        ON p.project_id = ucp.project_id
       AND p.deletedAt IS NULL
      WHERE ucp.created_by = :user_id
        AND ucp.deletedAt IS NULL
      ORDER BY p.project ASC
    `,
    {
      replacements: { user_id: cpUser.user_id },
      type: QueryTypes.SELECT,
    }
  );

  return {
    ok: true,
    data: {
      user_id: cpUser.user_id,
      user_code: cpUser.user_code,
      cp_name: [cpUser.user, cpUser.user_l_name].filter(Boolean).join(" ").trim(),
      assigned_projects,
    },
  };
};

module.exports = {
  assignProjectsToChannelPartner,
  getCpAssignedProjectsView,
  getBstAssignedChannelPartnersView,
  getBstCpProjectMap,
};
