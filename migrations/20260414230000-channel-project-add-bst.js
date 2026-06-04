"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = "db_channel_projects";
    const tables = await queryInterface.showAllTables();
    const tableExists = tables.map((t) => (typeof t === "string" ? t : t.tableName)).includes(table);
    if (!tableExists) return;

    const columns = await queryInterface.describeTable(table);
    if (!columns.bst) {
      await queryInterface.addColumn(table, "bst", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = "db_channel_projects";
    const tables = await queryInterface.showAllTables();
    const tableExists = tables.map((t) => (typeof t === "string" ? t : t.tableName)).includes(table);
    if (!tableExists) return;

    const columns = await queryInterface.describeTable(table);
    if (columns.bst) {
      await queryInterface.removeColumn(table, "bst");
    }
  },
};
