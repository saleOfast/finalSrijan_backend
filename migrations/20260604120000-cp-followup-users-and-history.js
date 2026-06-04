"use strict";

const CP_ACTIVITY_ENUM = [
  "OPEN",
  "CONTACTED",
  "LINK SENT",
  "ONBOARDED",
  "NOT INTERESTED",
  "CALL",
  "VISIT",
  "FOLLOW UP",
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("db_users", "activity", {
      type: Sequelize.ENUM(...CP_ACTIVITY_ENUM),
      allowNull: true,
    });

    await queryInterface.addColumn("db_users", "follow_up_date", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("db_users", "follow_up_remarks", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.createTable("db_cp_followup_history", {
      cp_followup_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "db_users",
          key: "user_id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      activity: {
        type: Sequelize.ENUM(...CP_ACTIVITY_ENUM),
        allowNull: false,
      },
      follow_up_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      remarks: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "db_users",
          key: "user_id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      cpl_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "db_channel_partner_leads",
          key: "cpl_id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      status: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    await queryInterface.addIndex("db_cp_followup_history", ["user_id"], {
      name: "idx_cp_followup_history_user_id",
    });
    await queryInterface.addIndex("db_cp_followup_history", ["created_by"], {
      name: "idx_cp_followup_history_created_by",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("db_cp_followup_history");
    await queryInterface.removeColumn("db_users", "follow_up_remarks");
    await queryInterface.removeColumn("db_users", "follow_up_date");
    await queryInterface.removeColumn("db_users", "activity");
  },
};
