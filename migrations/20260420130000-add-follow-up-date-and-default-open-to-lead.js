"use strict";

async function resolveLeadTableName(queryInterface) {
  const tables = await queryInterface.showAllTables();
  const normalized = (tables || []).map((entry) => {
    if (typeof entry === "string") return entry;
    if (entry && typeof entry === "object") {
      return entry.tableName || entry.table_name || Object.values(entry)[0];
    }
    return null;
  }).filter(Boolean);

  if (normalized.includes("db_lead")) return "db_lead";
  if (normalized.includes("db_leads")) return "db_leads";
  return null;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await resolveLeadTableName(queryInterface);
    if (!table) {
      console.log("Skipping migration: lead table not found (db_lead/db_leads).");
      return;
    }

    await queryInterface.addColumn(table, "follow_up_date", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.changeColumn(table, "status", {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: "OPEN",
    });
  },

  async down(queryInterface, Sequelize) {
    const table = await resolveLeadTableName(queryInterface);
    if (!table) return;

    await queryInterface.removeColumn(table, "follow_up_date");

    await queryInterface.changeColumn(table, "status", {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });
  },
};
