module.exports = (sequelize, DataTypes) => {
    const Cp_lead = sequelize.define("db_channel_partner_leads", // database table name
        {
            cpl_id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },

            first_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            last_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            contact: {
                type: DataTypes.BIGINT,
                allowNull: true,
            },

            email: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            state: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            state_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'db_states',
                    key: 'state_id',
                }
            },

            city: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            city_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'db_cities',
                    key: 'city_id',
                }
            },

            query: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            asssigned_to: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'db_users',
                    key: 'user_id',
                }
            },

            follow_up_date: {
                type: DataTypes.DATE,
                default: null
            },

            remarks: {
                type: DataTypes.STRING,
                default: null
            },

            stage: {
                type: DataTypes.ENUM('OPEN', 'CONTACTED', 'LINK SENT', 'ONBOARDED', 'NOT INTERESTED', 'CALL', 'VISIT', 'FOLLOW UP'),
                default: 'OPEN',
                allowNull: false,
            },

            status: {
                type: DataTypes.BOOLEAN,
                default: true,
                allowNull: false,
            },

        },
        { paranoid: true, timestamps: true }
    );

    return Cp_lead;
};
