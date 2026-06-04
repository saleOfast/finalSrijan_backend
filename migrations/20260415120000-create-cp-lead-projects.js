"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("cp_lead_projects", {
      cp_lead_project_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      cpl_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "db_channel_partner_leads",
          key: "cpl_id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "db_channel_projects",
          key: "project_id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addConstraint("cp_lead_projects", {
      fields: ["cpl_id", "project_id"],
      type: "unique",
      name: "uniq_cp_lead_projects_cpl_project",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("cp_lead_projects");
  },
};
