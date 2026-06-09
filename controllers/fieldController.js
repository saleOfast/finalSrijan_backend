const { Op } = require("sequelize");
const { responseSuccess, responseError } = require("../helper/responce");
const {
  NAVIGATE_TYPES,
  getStandardFieldLabels,
  getStandardFields,
} = require("../constants/objectFields");

exports.storeField = async (req, res) => {
  try {
    const FiledBody = req.body;

    if (!FiledBody || FiledBody.length == 0) {
      return await responseSuccess(req, res, "lead extra data submitted successfully");
    }

    const fields = FiledBody.map((entry) => ({
      field_lable: entry.field_lable.trim(),
      navigate_type: entry.navigate_type,
    }));

    const customDuplicateEntries = fields.filter((field) => {
      const standardLabels = getStandardFieldLabels(field.navigate_type);
      return standardLabels.includes(field.field_lable);
    });

    if (customDuplicateEntries.length > 0) {
      return await responseError(
        req,
        res,
        `${customDuplicateEntries.length} fields are duplicates default fields.`
      );
    }

    const duplicateEntries = await req.config.Field.findAll({
      where: {
        [Op.and]: fields.map((field) => ({
          field_lable: field.field_lable.trim(),
          navigate_type: field.navigate_type,
        })),
      },
      attributes: ["field_lable", "navigate_type"],
    });

    if (duplicateEntries.length > 0) {
      return await responseError(req, res, `${duplicateEntries.length} fields are duplicate.`);
    }

    const FieldData = await req.config.Field.bulkCreate(FiledBody, {
      updateOnDuplicate: [
        "field_id",
        "field_lable",
        "navigate_type",
        "field_name",
        "field_order",
        "option",
        "input_value",
        "input_type",
        "field_type",
        "field_size",
      ],
    });

    await responseSuccess(req, res, "lead extra data submitted successfully", FieldData);
  } catch (error) {
    logErrorToFile(error);
    console.log(error);
    await responseError(req, res, "Something Went Wrong");
  }
};

exports.getField = async (req, res) => {
  try {
    let FieldData;
    const id = req.query.id;
    if (id) {
      FieldData = await req.config.Field.findByPk(id);
    } else {
      FieldData = await req.config.Field.findAll({
        where: {
          navigate_type: req.query.nav_type,
        },
        order: [["field_order", "ASC"]],
      });
    }

    await responseSuccess(req, res, "Field Data", FieldData);
  } catch (error) {
    logErrorToFile(error);
    console.log(error);
    await responseError(req, res, "Something Went Wrong");
  }
};

exports.getAllObjectFields = async (req, res) => {
  try {
    const navType = req.query.nav_type || req.query.navigate_type;

    if (!navType) {
      return await responseError(
        req,
        res,
        `nav_type is required. Valid values: ${NAVIGATE_TYPES.join(", ")}`
      );
    }

    if (!NAVIGATE_TYPES.includes(navType)) {
      return await responseError(
        req,
        res,
        `Invalid nav_type '${navType}'. Valid values: ${NAVIGATE_TYPES.join(", ")}`
      );
    }

    const standardFields = getStandardFields(navType);

    const customFieldRows = await req.config.Field.findAll({
      where: { navigate_type: navType },
      order: [["field_order", "ASC"]],
    });

    const customFields = customFieldRows.map((row) => {
      const plain = row.toJSON ? row.toJSON() : row;
      return {
        ...plain,
        is_standard: false,
        field_type: plain.field_type || "custom",
      };
    });

    const allFields = [
      ...standardFields,
      ...customFields.map((field) => ({
        field_id: field.field_id,
        navigate_type: field.navigate_type,
        field_lable: field.field_lable,
        field_name: field.field_name,
        field_order: field.field_order,
        option: field.option,
        input_value: field.input_value,
        input_type: field.input_type,
        field_type: field.field_type,
        field_size: field.field_size,
        is_standard: false,
        createdAt: field.createdAt,
        updatedAt: field.updatedAt,
      })),
    ];

    await responseSuccess(req, res, "All object fields fetched successfully", {
      navigate_type: navType,
      standard_count: standardFields.length,
      custom_count: customFields.length,
      total_count: allFields.length,
      standard_fields: standardFields,
      custom_fields: customFields,
      all_fields: allFields,
    });
  } catch (error) {
    logErrorToFile(error);
    console.log(error);
    await responseError(req, res, "Something Went Wrong");
  }
};

exports.deleteField = async (req, res) => {
  try {
    const FieldData = await req.config.Field.findByPk(req.query.id);
    if (!FieldData) responseError(req, res, "field not found");
    await FieldData.destroy();
    await responseSuccess(req, res, "Field Data deleted");
  } catch (error) {
    logErrorToFile(error);
    console.log(error);
    await responseError(req, res, "Something Went Wrong");
  }
};
