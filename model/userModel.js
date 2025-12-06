module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define(
        "db_user", // database table name
        {
            user_id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            user: {
                type: DataTypes.STRING,
                allowNull: false,
            },

            user_l_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            email: {
                type: DataTypes.STRING,
                allowNull: false,
            },

            contact_number: {
                type: DataTypes.BIGINT,
                allowNull: true,
            },

            password: {
                type: DataTypes.STRING,
                allowNull: true,
                defaultValue: "",
            },

            organisation: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            db_name: {
                type: DataTypes.STRING,
                allowNull: false,
            },

            isDB: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },

            user_status: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,

            },

            bst_approval: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
            
            bst_response: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },

            director_approval: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },

            director_response: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },

            doc_verification: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                comment:
                    "0->link_send|1->pending_for_verification|2->completed_verification|3->rejected",
            },

            reject_reason: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            user_code: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            role_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: "db_roles",
                    key: "role_id",
                },
            },

            user_verify_otp: {
                type: DataTypes.INTEGER,
                default: null,
            },

            password_reset_token: {
                type: DataTypes.STRING,
                default: null,
            },

            password_reset_expires: {
                type: DataTypes.DATE,
                default: null,
            },

            country_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: "db_countries",
                    key: "country_id",
                },
            },
            state_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: "db_states",
                    key: "state_id",
                },
            },

            city_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: "db_cities",
                    key: "city_id",
                },
            },

            district_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: "db_districts",
                    key: "district_id",
                },
            },

            address: {
                type: DataTypes.STRING(255),
                allowNull: true,
            },

            pincode: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            report_to: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: "db_users",
                    key: "user_id",
                },
            },

            no_of_months: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },

            domain: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            no_of_license: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },

            no_of_channel_license: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },

            no_of_dms_license: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },

            no_of_sales_license: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },

            sidebar_color: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            button_color: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            text_color: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            top_nav_color: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            gst: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            nda: {
                type: DataTypes.BOOLEAN,
                allowNull: true,
                defaultValue: false,
            },

            remarks: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            logo: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            client_url: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            client_image_1: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            client_image_2: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            client_image_3: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            client_image_4: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            host_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            cpt_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: "db_channel_partner_types", // 'db_channel_partner_type' refers to table name
                    key: "cpt_id", // 'cpt_id' refers to column name in db_channel_partner_type table
                },
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE',
            },

            cp_category: {
                type: DataTypes.ENUM('Category A', 'Category B', 'Category C', 'Category D'),
                allowNull: true,
            },

            salesforce_url: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            grant_type: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            salesforce_client_id: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            salesforce_client_pwd: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            onboarding_date: {
                type: DataTypes.DATE,
                allowNull: true,
            },

            mailSent: {
                type: DataTypes.BOOLEAN,
                allowNull: true,
            },
        },
        { paranoid: true, timestamps: true }
    );

    return User;
};
