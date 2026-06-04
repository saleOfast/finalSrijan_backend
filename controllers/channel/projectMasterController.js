const { Op } = require("sequelize");
const { responseError, responseSuccess } = require("../../helper/responce");

/** Uses existing channel project model associations (same table as projectController). */
const projectInclude = (config) => [
  {
    model: config.states,
    as: "projectState",
    attributes: ["state_id", "state_name", "country_id"],
  },
  {
    model: config.city,
    as: "projectCity",
    attributes: ["city_id", "city_name", "state_id"],
  },
];

const trimNullable = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

const toNullableInt = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function validateProjectStateCity(req, stateRaw, cityRaw) {
  const state_id = toNullableInt(stateRaw);
  const city_id = toNullableInt(cityRaw);
  if (!state_id && !city_id) return { ok: true, state_id, city_id };
  if (city_id && !state_id) {
    return { ok: false, msg: "state_id is required when city_id is provided" };
  }
  const state = await req.config.states.findByPk(state_id);
  if (!state) return { ok: false, msg: "Invalid state_id" };
  if (!city_id) return { ok: true, state_id, city_id: null };
  const city = await req.config.city.findByPk(city_id);
  if (!city) return { ok: false, msg: "Invalid city_id" };
  if (Number(city.state_id) !== Number(state_id)) {
    return { ok: false, msg: "Selected city does not belong to the selected state" };
  }
  return { ok: true, state_id, city_id };
}

function parseBstIds(raw) {
  if (raw === undefined) return { provided: false, ids: [] };
  if (raw === null || raw === "") return { provided: true, ids: [] };

  let values = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") return { provided: true, ids: [] };
    try {
      values = JSON.parse(trimmed);
    } catch (_e) {
      values = trimmed.split(",");
    }
  }

  if (!Array.isArray(values)) values = [values];
  const ids = [...new Set(
    values
      .map((v) => Number(String(v).trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
  )];
  return { provided: true, ids };
}

async function validateBstIds(req, ids) {
  if (!ids || ids.length === 0) return { ok: true, ids: [] };

  const bstUsers = await req.config.users.findAll({
    where: {
      user_id: { [Op.in]: ids },
      role_id: 2,
      user_status: true,
      doc_verification: 2,
      deletedAt: null,
    },
    attributes: ["user_id"],
  });

  if (bstUsers.length !== ids.length) {
    const found = new Set(bstUsers.map((u) => Number(u.user_id)));
    const missing = ids.filter((id) => !found.has(Number(id)));
    return { ok: false, msg: `Invalid BST user ids: ${missing.join(", ")}` };
  }

  return { ok: true, ids };
}

const BST_USER_ATTRIBUTES = ["user_id", "user", "user_l_name", "state_id", "city_id", "zone"];

const toProjectPlain = (row) => (row && typeof row.toJSON === "function" ? row.toJSON() : row);

async function enrichProjectWithBstUsers(req, rows) {
  const isList = Array.isArray(rows);
  const plainRows = (isList ? rows : [rows]).filter(Boolean).map(toProjectPlain);
  if (!plainRows.length) return isList ? [] : null;

  const bstIds = [...new Set(
    plainRows.flatMap((row) => parseBstIds(row.bst).ids)
  )];

  const bstMap = new Map();
  if (bstIds.length) {
    const bstUsers = await req.config.users.findAll({
      where: {
        user_id: { [Op.in]: bstIds },
        role_id: 2,
        deletedAt: null,
      },
      attributes: BST_USER_ATTRIBUTES,
    });

    const bstUserPlain = bstUsers.map((u) => (u.toJSON ? u.toJSON() : u));
    const stateIds = [...new Set(
      bstUserPlain
        .map((u) => Number(u.state_id))
        .filter((n) => Number.isInteger(n) && n > 0)
    )];
    const cityIds = [...new Set(
      bstUserPlain
        .map((u) => Number(u.city_id))
        .filter((n) => Number.isInteger(n) && n > 0)
    )];

    const [states, cities] = await Promise.all([
      stateIds.length
        ? req.config.states.findAll({
            where: { state_id: { [Op.in]: stateIds } },
            attributes: ["state_id", "state_name"],
          })
        : [],
      cityIds.length
        ? req.config.city.findAll({
            where: { city_id: { [Op.in]: cityIds } },
            attributes: ["city_id", "city_name"],
          })
        : [],
    ]);

    const stateMap = new Map(states.map((s) => [Number(s.state_id), s.state_name]));
    const cityMap = new Map(cities.map((c) => [Number(c.city_id), c.city_name]));

    bstUserPlain.forEach((u) => {
      bstMap.set(Number(u.user_id), {
        name: [u.user, u.user_l_name].filter(Boolean).join(" ").trim(),
        state: stateMap.get(Number(u.state_id)) || null,
        city: cityMap.get(Number(u.city_id)) || null,
        zone: u.zone || null,
      });
    });
  }

  const enriched = plainRows.map((row) => {
    const ids = parseBstIds(row.bst).ids;
    const bst_users = ids
      .map((id) => bstMap.get(Number(id)))
      .filter(Boolean);
    const { bst: _bstOmit, ...projectData } = row;

    return {
      ...projectData,
      bst_ids: ids,
      bst_users,
    };
  });

  return isList ? enriched : enriched[0];
}

exports.getStatePicklist = async (req, res) => {
  try {
    const country_id = toNullableInt(req.query.country_id);
    const where = {};
    if (country_id) where.country_id = country_id;
    const stateData = await req.config.states.findAll({
      where,
      attributes: ["state_id", "state_name", "country_id", "is_available"],
      order: [["state_name", "ASC"]],
    });
    return await responseSuccess(req, res, "State master list", stateData);
  } catch (error) {
    logErrorToFile(error);
    return await responseError(req, res, "Something Went Wrong");
  }
};

exports.getCityPicklist = async (req, res) => {
  try {
    const state_id = toNullableInt(req.query.state_id);
    if (!state_id) {
      return await responseError(req, res, "state_id is required to load cities");
    }
    const cityData = await req.config.city.findAll({
      where: { state_id },
      attributes: ["city_id", "city_name", "state_id"],
      order: [["city_name", "ASC"]],
    });
    return await responseSuccess(req, res, "City master list", cityData);
  } catch (error) {
    logErrorToFile(error);
    return await responseError(req, res, "Something Went Wrong");
  }
};

exports.createProjectMaster = async (req, res) => {
  try {
    const body = { ...req.body };
    const { project } = body;
    if (project == null || String(project).trim() === "") {
      return await responseError(req, res, "project is required");
    }

    const dup = await req.config.channelProject.findOne({
      where: { project: String(project).trim() },
    });
    if (dup) return await responseError(req, res, "project name already exists");

    const locCheck = await validateProjectStateCity(req, body.state_id, body.city_id);
    if (!locCheck.ok) return await responseError(req, res, locCheck.msg);
    const parsedBst = parseBstIds(body.bst);
    if (parsedBst.provided) {
      const bstCheck = await validateBstIds(req, parsedBst.ids);
      if (!bstCheck.ok) return await responseError(req, res, bstCheck.msg);
      body.bst = bstCheck.ids;
    }

    const payload = {
      project: String(project).trim(),
      state_id: locCheck.state_id,
      city_id: locCheck.city_id,
      state_religion: trimNullable(body.state_religion),
      zone: trimNullable(body.zone),
      bst: body.bst,
      status: true,
      created_by: req.user?.user_id,
    };

    const row = await req.config.channelProject.create(payload);
    const withRel = await req.config.channelProject.findByPk(row.project_id, {
      include: projectInclude(req.config),
    });
    const enriched = await enrichProjectWithBstUsers(req, withRel);
    return await responseSuccess(req, res, "Project master created successfully", enriched);
  } catch (error) {
    logErrorToFile(error);
    console.log(error);
    return await responseError(req, res, "Something Went Wrong");
  }
};

exports.getProjectMaster = async (req, res) => {
  try {
    const locInc = projectInclude(req.config);
    if (req.query.project_id) {
      const row = await req.config.channelProject.findByPk(req.query.project_id, {
        include: locInc,
      });
      if (!row) return await responseError(req, res, "Project not found");
      const enriched = await enrichProjectWithBstUsers(req, row);
      return await responseSuccess(req, res, "Project master data", enriched);
    }
    const list = await req.config.channelProject.findAll({
      include: locInc,
      order: [["project_id", "DESC"]],
    });
    const enrichedList = await enrichProjectWithBstUsers(req, list);
    return await responseSuccess(req, res, "Project master list", enrichedList);
  } catch (error) {
    logErrorToFile(error);
    console.log(error);
    return await responseError(req, res, "Something Went Wrong");
  }
};

exports.updateProjectMaster = async (req, res) => {
  try {
    const { project_id } = req.body;
    if (!project_id) return await responseError(req, res, "project_id is required");

    const body = { ...req.body };
    const current = await req.config.channelProject.findByPk(project_id);
    if (!current) return await responseError(req, res, "Project not found");

    const mergedStateId = Object.prototype.hasOwnProperty.call(req.body, "state_id")
      ? body.state_id
      : current.state_id;
    const mergedCityId = Object.prototype.hasOwnProperty.call(req.body, "city_id")
      ? body.city_id
      : current.city_id;
    const locCheck = await validateProjectStateCity(req, mergedStateId, mergedCityId);
    if (!locCheck.ok) return await responseError(req, res, locCheck.msg);

    const patch = {};
    if (Object.prototype.hasOwnProperty.call(req.body, "project")) {
      if (body.project == null || String(body.project).trim() === "") {
        return await responseError(req, res, "project cannot be empty");
      }
      patch.project = String(body.project).trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "state_id")) {
      patch.state_id = locCheck.state_id;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "city_id")) {
      patch.city_id = locCheck.city_id;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "state_religion")) {
      patch.state_religion = trimNullable(body.state_religion);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "zone")) {
      patch.zone = trimNullable(body.zone);
    }
    const parsedBst = parseBstIds(req.body.bst);
    if (parsedBst.provided) {
      const bstCheck = await validateBstIds(req, parsedBst.ids);
      if (!bstCheck.ok) return await responseError(req, res, bstCheck.msg);
      patch.bst = bstCheck.ids;
    }

    if (patch.project != null) {
      const dup = await req.config.channelProject.findOne({
        where: {
          project_id: { [Op.ne]: project_id },
          project: patch.project,
        },
      });
      if (dup) return await responseError(req, res, "project name already exists");
    }

    await current.update(patch);
    const updated = await req.config.channelProject.findByPk(project_id, {
      include: projectInclude(req.config),
    });
    const enriched = await enrichProjectWithBstUsers(req, updated);
    return await responseSuccess(req, res, "Project master updated", enriched);
  } catch (error) {
    logErrorToFile(error);
    console.log(error);
    return await responseError(req, res, "Something Went Wrong");
  }
};

exports.deleteProjectMaster = async (req, res) => {
  try {
    const { project_id } = req.query;
    if (!project_id) return await responseError(req, res, "project_id is required");

    const row = await req.config.channelProject.findOne({
      where: { project_id },
    });
    if (!row) return await responseError(req, res, "Project not found");
    await row.destroy();
    return await responseSuccess(req, res, "Project master deleted");
  } catch (error) {
    logErrorToFile(error);
    console.log(error);
    return await responseError(req, res, "Something Went Wrong");
  }
};
