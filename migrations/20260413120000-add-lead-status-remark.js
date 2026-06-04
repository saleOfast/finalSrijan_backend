"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = "db_lead";
    const tables = await queryInterface.showAllTables();
    const tableExists = tables.map((t) => (typeof t === "string" ? t : t.tableName)).includes(table);
    if (!tableExists) return;

    const columns = await queryInterface.describeTable(table);
    if (!columns.status) {
      await queryInterface.addColumn(table, "status", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!columns.remark) {
      await queryInterface.addColumn(table, "remark", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = "db_lead";
    const tables = await queryInterface.showAllTables();
    const tableExists = tables.map((t) => (typeof t === "string" ? t : t.tableName)).includes(table);
    if (!tableExists) return;

    const columns = await queryInterface.describeTable(table);
    if (columns.status) {
      await queryInterface.removeColumn(table, "status");
    }
    if (columns.remark) {
      await queryInterface.removeColumn(table, "remark");
    }
  },
};
