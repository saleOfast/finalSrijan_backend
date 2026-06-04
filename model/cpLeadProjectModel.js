module.exports = (sequelize, DataTypes) => {
  const cpLeadProjects = sequelize.define(
    "cp_lead_projects",
    {
      cp_lead_project_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      cpl_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "db_channel_partner_leads",
          key: "cpl_id",
        },
      },
      project_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "db_channel_projects",
          key: "project_id",
        },
      },
    },
    {
      timestamps: true,
      paranoid: true,
      indexes: [
        {
          unique: true,
          fields: ["cpl_id", "project_id"],
        },
      ],
    }
  );

  return cpLeadProjects;
};
