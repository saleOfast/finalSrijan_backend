module.exports = (sequelize, DataTypes) => {
    const project = sequelize.define("db_channel_project", // database table name
      {
        project_id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },

        project: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        state_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "db_states",
                key: "state_id",
            },
        },

        state_religion: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        city_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "db_cities",
                key: "city_id",
            },
        },

        zone: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        bst: {
            type: DataTypes.TEXT,
            allowNull: true,
            get() {
                const raw = this.getDataValue("bst");
                if (!raw) return [];
                if (Array.isArray(raw)) return raw;
                try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) return parsed;
                } catch (_e) {}
                return String(raw)
                    .split(",")
                    .map((v) => Number(v))
                    .filter((n) => Number.isFinite(n));
            },
            set(value) {
                if (value === undefined || value === null || value === "") {
                    this.setDataValue("bst", null);
                    return;
                }
                const list = Array.isArray(value) ? value : [value];
                const ids = [...new Set(
                    list
                        .flatMap((v) => String(v).split(","))
                        .map((v) => Number(String(v).trim()))
                        .filter((n) => Number.isFinite(n))
                )];
                this.setDataValue("bst", ids.length ? JSON.stringify(ids) : null);
            },
        },

        location: {
          type: DataTypes.STRING,
          allowNull: true,
        },

        property_size: {
          type: DataTypes.STRING,
          allowNull: true,
        },

        unit_area: {
          type: DataTypes.STRING,
          allowNull: true,
        },

        price: {
          type: DataTypes.STRING,
          allowNull: true,
        },

        contact_no: {
          type: DataTypes.BIGINT,
          allowNull: true,
        },

        cover_image: {
          type: DataTypes.STRING,
          allowNull: true,
        },

        logo_image: {
          type: DataTypes.STRING,
          allowNull: true,
        },

        html_file: {
          type: DataTypes.STRING,
          allowNull: true,
        },

        status: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
        },

        created_by: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
              model: 'db_users', 
              key: 'user_id', 
          }
        },
      },
      { paranoid: true, timestamps: true },   
    );
    
  
    return project;
  };
  