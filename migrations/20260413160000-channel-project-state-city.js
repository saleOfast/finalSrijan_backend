"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = "db_channel_projects";
    const tables = await queryInterface.showAllTables();
    const tableExists = tables.map((t) => (typeof t === "string" ? t : t.tableName)).includes(table);
    if (!tableExists) return;

    const columns = await queryInterface.describeTable(table);
    if (!columns.state_id) {
      await queryInterface.addColumn(table, "state_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "db_states",
          key: "state_id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }
    if (!columns.city_id) {
      await queryInterface.addColumn(table, "city_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "db_cities",
          key: "city_id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }
  },

  async down(queryInterface) {
    const table = "db_channel_projects";
    const tables = await queryInterface.showAllTables();
    const tableExists = tables.map((t) => (typeof t === "string" ? t : t.tableName)).includes(table);
    if (!tableExists) return;

    const columns = await queryInterface.describeTable(table);
    if (columns.city_id) {
      await queryInterface.removeColumn(table, "city_id");
    }
    if (columns.state_id) {
      await queryInterface.removeColumn(table, "state_id");
    }
  },
};
