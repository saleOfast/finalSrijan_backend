	module.exports = (sequelize, DataTypes) => {
	const leads = sequelize.define("db_lead", // database table name
	{
		lead_id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},

		lead_name: {
			type: DataTypes.STRING,
			allowNull: true,
		},

		lead_code: {
			type: DataTypes.STRING,
			allowNull: true,
		},

		lead_status_id: {
			type: DataTypes.INTEGER,
			allowNull: true,
			references: {
				model: 'db_lead_statuses', 
				key: 'lead_status_id', 
			}
		},

		lead_type_id: {
			type: DataTypes.INTEGER,
			allowNull: true,
			references: {
				model: 'db_lead_types', 
				key: 'lead_type_id', 
			}
		},

		lead_src_id: {
			type: DataTypes.INTEGER,
			allowNull: true,
			references: {
				model: 'db_lead_sources', 
				key: 'lead_src_id', 
			}
		},

		lead_stg_id: {
			type: DataTypes.INTEGER,
			allowNull: true,
			references: {
				model: 'db_lead_stages', 
				key: 'lead_stg_id', 
			}
		},

		lead_owner: {
			type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'db_users', 
                key: 'user_id', 
            }
		},

		dep_id: {
			type: DataTypes.INTEGER,
			allowNull: true,
			references: {
				model: 'db_departments', 
				key: 'dep_id', 
			}
		},

		amount: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},

		company_name: {
			type: DataTypes.STRING,
			allowNull: true,
		},

		lead_detail: {
			type: DataTypes.TEXT,
			allowNull: true,
		},

		email_id: {
			type: DataTypes.STRING,
			allowNull: true,
		},

		contact_name: {
			type: DataTypes.STRING,
			allowNull: true,
		},

		p_contact_no: {
			type: DataTypes.BIGINT,
			allowNull: true,
		},

		whatsapp_no: {
			type: DataTypes.BIGINT,
			allowNull: true,
		},

		official_no: {
			type: DataTypes.BIGINT,
			allowNull: true,
		},

		created_on: {
			type: DataTypes.DATE,
			allowNull: true,
		},

		updated_on: {
			type: DataTypes.DATE,
			allowNull: true,
		},

		loss_reason: {
			type: DataTypes.STRING,
			allowNull: true,
		},

		country_id:{
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'db_countries', 
                key: 'country_id', 
            }
        },

		state_id:{
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'db_states', 
                key: 'state_id', 
            }
        },

		city_id:{
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'db_cities', 
                key: 'city_id', 
            }
        },

		pincode: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},

		address: {
			type: DataTypes.STRING,
			allowNull: true,
		},

		assigned_lead: {
			type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'db_users', 
                key: 'user_id', 
            }
		},
		acc_id:{
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'db_accounts', 
                key: 'acc_id', 
            }
        },

		contact_id:{
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'db_contacts', 
                key: 'contact_id', 
            }
        },

		opp_id:{
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'db_opportunities', 
                key: 'opp_id', 
            }
        },

		assigned_by: {
			type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'db_users', 
                key: 'user_id', 
            }
		},

		p_visit_date: {
			type: DataTypes.DATEONLY,
            allowNull: true,
		},

		p_visit_time: {
			type: DataTypes.TIME,
            allowNull: true,
		},

		project_id: {
			type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'db_channel_projects', 
                key: 'project_id', 
            }
		},

		sales_project_id: {
			type: DataTypes.STRING,
			allowNull: true,
		},

		sales_lead_id: {
			type: DataTypes.STRING,
			allowNull: true,
		},

		sales_project_name: {
			type: DataTypes.STRING,
			allowNull: true,
		},

		mailSent: {
			type: DataTypes.BOOLEAN,
			allowNull: true,
		},

		zone: {
			type: DataTypes.STRING,
			allowNull: true,
		},

		zone_area: {
			type: DataTypes.STRING,
			allowNull: true,
		},

		aadhar_card_number: {
			type: DataTypes.STRING,
			allowNull: true,
		},
	},
	{ paranoid: true, timestamps: true },   
	);

	return leads;
};
