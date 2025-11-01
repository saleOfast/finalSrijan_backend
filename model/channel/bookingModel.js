module.exports = (sequelize, DataTypes) => {
    const LeadBooking = sequelize.define("db_lead_booking", // database table name
        {
            booking_id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },

            booking_code: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            booking_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            email: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            Location: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            pincode: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            contact_no: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            visit_done_date: {
                type: DataTypes.DATEONLY,
                allowNull: true,
            },

            visit_done_time: {
                type: DataTypes.TIME,
                allowNull: true,
            },

            visit_remarks: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            revisit_done_date: {
                type: DataTypes.DATEONLY,
                allowNull: true,
            },

            revisit_done_time: {
                type: DataTypes.TIME,
                allowNull: true,
            },

            revisit_remarks: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            lead_id: {
                type: DataTypes.INTEGER,
                allowNull: false,  // ✅ MANDATORY: Lead is required for all bookings
                references: {
                    model: 'db_leads', 
                    key: 'lead_id', 
                }
            },

            project_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'db_channel_projects', 
                    key: 'project_id', 
                }
            },

            status: {
                type: DataTypes.ENUM('Payment Initiated', 'Payment Received', 'Payment Rejected', 'Booking Done', 'Eligible for brokerage bill', 'Bill Received', 'Bill sent', 'VISIT DONE NOT BOOKED'),
                defaultValue: 'Eligible for brokerage bill',
                allowNull: true
            },

            sales_booking_id: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            recieved_date: {
                type: DataTypes.DATEONLY,
                allowNull: true,
            },

            recieved_time: {
                type: DataTypes.TIME,
                allowNull: true,
            },

            flat_number: {
                type: DataTypes.STRING(100),
                allowNull: true,
            },

            block_number: {
                type: DataTypes.STRING(100),
                allowNull: true,
            },

            buyer_id: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            // Additional required fields for ERP integration
            CP_Name: {
                type: DataTypes.STRING,
                allowNull: true,
            },

            created_by: {
                type: DataTypes.STRING,
                allowNull: true,
   
            },

            created_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        { paranoid: true, timestamps: true },
    );


    return LeadBooking;
};
