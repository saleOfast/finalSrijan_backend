"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = "db_users";
    const tables = await queryInterface.showAllTables();
    const tableExists = tables
      .map((t) => (typeof t === "string" ? t : t.tableName))
      .includes(table);
    if (!tableExists) return;

    const columns = await queryInterface.describeTable(table);
    if (!columns.zone) {
      await queryInterface.addColumn(table, "zone", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = "db_users";
    const tables = await queryInterface.showAllTables();
    const tableExists = tables
      .map((t) => (typeof t === "string" ? t : t.tableName))
      .includes(table);
    if (!tableExists) return;

    const columns = await queryInterface.describeTable(table);
    if (columns.zone) {
      await queryInterface.removeColumn(table, "zone");
    }
  },
};
