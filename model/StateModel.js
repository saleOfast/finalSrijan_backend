module.exports = (sequelize, DataTypes) => {
    const State = sequelize.define(
    "db_state", // database table name
    {
        state_id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
  
        state_name: {
            type: DataTypes.STRING(200),
            allowNull: false,
        },
        
        country_id:{
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'db_countries', 
                key: 'country_id', 
            }
        },
        
        is_available: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: true,
        },
    },
      { paranoid: true, timestamps: true }
    );
  
    return State;
  };
  