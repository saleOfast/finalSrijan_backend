module.exports = (sequelize, DataTypes) => {
  const cpFollowupHistory = sequelize.define(
    "db_cp_followup_history",
    {
      cp_followup_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "db_users",
          key: "user_id",
        },
      },
      activity: {
        type: DataTypes.ENUM(
          "OPEN",
          "CONTACTED",
          "LINK SENT",
          "ONBOARDED",
          "NOT INTERESTED",
          "CALL",
          "VISIT",
          "FOLLOW UP"
        ),
        allowNull: false,
      },
      follow_up_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "db_users",
          key: "user_id",
        },
      },
      cpl_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "db_channel_partner_leads",
          key: "cpl_id",
        },
      },
      status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
    },
    { paranoid: true, timestamps: true }
  );

  return cpFollowupHistory;
};
