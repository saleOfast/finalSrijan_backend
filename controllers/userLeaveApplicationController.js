const { Sequelize, DataTypes, QueryTypes, where, Op } = require("sequelize");
const {responseError, responseSuccess} = require('../helper/responce')
const sendEmail = require("../common/mailer")
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

exports.storeuserLeaveApps = async(req, res) =>{
    try {
        let body = req.body;
        body.submitted_by = req.user.user_id
        body.report_to = req.user.report_to
        if(req.user.report_to == null) return await responseError(req, res, "User doesn't reporting to anyone")
        let reportToUser  = await req.config.users.findOne({
            where:{
                user_id: req.user.report_to
            },
            paranoid: false
        })
        let userLeaveAppsData =  await req.config.userLeaveApps.create(body)

        // sending email to user
        let option = {
            email: reportToUser.email,
            subject: "Leave Application",
            message: body.reason,
        }
        await sendEmail(option);
        return await responseSuccess(req, res, "leave application created Succesfully", userLeaveAppsData)

    } catch (error) {
    logErrorToFile(error)
        console.log(error);
        return await responseError(req, res, "Something Went Wrong")
    }
}

const dateChange = (date) => {
    const dueDate = new Date(date);
    const formattedDueDate = dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return formattedDueDate
}


exports.downloadExcelData = async(req,res)=>{
    try {

        whereClause ={};
        if(!req.user.isDB){
                whereClause = {
                    report_to:  req.user.user_id,
                }
        }

        let  userLeaveAppsData = await req.config.userLeaveApps.findAll({
            where: whereClause,
            include: [
                {model: req.config.users, as:"submittedTo", attributes: ['user_id', 'user'], paranoid: false,},
                {model: req.config.users, as:"submittedBy", attributes: ['user_id', 'user'], paranoid: false,},
                {model: req.config.leaveHeads, as:"leaveType", paranoid: false,},
                {model: req.config.leaveHeadCounts, paranoid: false,},
        ],order: [['leave_app_status', 'ASC'], ['leave_app_id','DESC']]
        })
             //console.log("lead", lead[0].dataValues.db_department.dataValues.department)
       // console.log('lead', lead);
            let excelClientData = []
            userLeaveAppsData?.forEach(element => {
                let item = {
                    "Applicant Name": element.dataValues?.submittedBy?.dataValues.user,
                    "submitted To": element?.dataValues.submittedTo?.dataValues.user,
                    "Leave Type": element?.dataValues.leaveType?.dataValues.head_leave_name,
                    "No of Days":  element?.dataValues.no_of_days,
                    "From Date":  element?.dataValues.from_date,
                    "To Date":  element?.dataValues.to_date,
                    "Reason":  element?.dataValues.reason,
                    "Status":  element?.dataValues.leave_app_status,
                    "Remarks":  element?.dataValues.remarks,
                }
              excelClientData.push(item)
            });
        // let excelClientData = lead?.map((item)=> item.dataValues)
            const workbook = xlsx.utils.book_new();
            const worksheet = xlsx.utils.json_to_sheet(excelClientData);
            // Add the worksheet to the workbook
            xlsx.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

            // Generate a temporary file path to save the Excel workbook
            const tempFilePath = path.join(__dirname, `../uploads/temp`, 'temp.xlsx');

            // Write the workbook to a file
            xlsx.writeFile(workbook, tempFilePath);

            // Set the response headers
            res.setHeader('Content-Type', 'application/vnd.ms-excel');
            res.setHeader('Content-Disposition', 'attachment; filename=example.xlsx');

            // Stream the file to the response
            const stream = fs.createReadStream(tempFilePath);
            stream.pipe(res);

            // Delete the temporary file after sending the response
            stream.on('end', () => {
                fs.unlinkSync(tempFilePath);
            }); 
         
            return 
    } catch (error) {
    logErrorToFile(error)
        console.log(error)
        return res.status(400).json({status:400, message:"Something Went Wrong"})
    }
}


exports.getuserLeaveApps = async(req, res) =>{
    try {
        whereClause ={};
        if(!req.user.isDB){
            if(req.query.mode == 'rpt'){
                whereClause = {
                    report_to:  req.user.user_id,
                    leave_app_status: 'pending'
                }
            }else{
                whereClause = {
                    submitted_by: req.user.user_id
                }
            }
        }

        // query for from & to date
        if(req.query.f_date && req.query.t_date && req.query.f_date != null && req.query.f_date != undefined && req.query.t_date != null && req.query.t_date != undefined ) {
            whereClause.from_date =  {
                [Op.between]: [req.query.f_date, req.query.t_date],
              };
              whereClause.to_date =  {
                [Op.between]: [req.query.f_date, req.query.t_date],
              };
        }

        // query for application status
        if(req.query.status && req.query.status != null && req.query.status != undefined ){
            whereClause.leave_app_status = req.query.status;
        }

        // query for application leave head eg . CL , PL, SL
        if(req.query.lh_id && req.query.lh_id != null && req.query.lh_id != undefined){
            whereClause.head_leave_id = req.query.lh_id;  
        }

        
        // query for application user id eg . mukesh , heera
        if(req.query.sm_id && req.query.sm_id != null && req.query.sm_id != undefined){
            whereClause.submitted_by = req.query.sm_id;  
        }

        let userLeaveAppsData;
        if(req.query.la_id) {
            userLeaveAppsData = await req.config.userLeaveApps.findOne({
                where:{
                    leave_app_id: req.query.la_id
                },
                include: [
                    {model: req.config.users, as:"submittedTo", attributes: ['user_id', 'user'], paranoid: false,},
                    {model: req.config.users, as:"submittedBy", attributes: ['user_id', 'user'], paranoid: false,},
                    {model: req.config.leaveHeads, as:"leaveType", paranoid: false,},
                    {model: req.config.leaveHeadCounts, paranoid: false,},
            ],  order: [['leave_app_status', 'ASC'], ['leave_app_id','DESC']]
            })
        }else {
            userLeaveAppsData = await req.config.userLeaveApps.findAll({
                where: whereClause,
                include: [
                    {model: req.config.users, as:"submittedTo", attributes: ['user_id', 'user'], paranoid: false,},
                    {model: req.config.users, as:"submittedBy", attributes: ['user_id', 'user'], paranoid: false,},
                    {model: req.config.leaveHeads, as:"leaveType", paranoid: false,},
                    {model: req.config.leaveHeadCounts, paranoid: false,},
            ],order: [['leave_app_status', 'ASC'], ['leave_app_id','DESC']]
            })
        }

        return await responseSuccess(req, res, "leave application list", userLeaveAppsData)
       
    } catch (error) {
    logErrorToFile(error)
        console.log(error);
        return await responseError(req, res, "Something Went Wrong")
    }
}


exports.edituserLeaveApps = async(req, res) =>{
    try {
        let {leave_app_id} = req.body
        let body = req.body;
            await req.config.userLeaveApps.update(body, {
                where:{
                    leave_app_id: leave_app_id
                }
            })
            return await responseSuccess(req, res, "application updated")
    } catch (error) {
    logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.deleteuserLeaveApps = async(req, res) =>{
    try {

        let {la_id} = req.query
        let userLeaveAppsBody = await req.config.userLeaveApps.findOne({
            where:{
                leave_app_id: la_id,
            }
        })

        if(!userLeaveAppsBody) return await responseError(req, res, "leave appliaction does not existed") 
        await userLeaveAppsBody.destroy()
        return await responseSuccess(req, res, "leave appliaction deleted")

    } catch (error) {
    logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.getUserPendingLeavesCount = async(req, res) =>{
    try {

        let {cnt_id , t_cnt} = req.query

        let userPendinLeave = await req.config.userLeaves.findOne({
            where:{
                head_leave_cnt_id: cnt_id,
                user_id : req.user.user_id
            }
        })

        if(!userPendinLeave) return await responseSuccess(req, res, "Pending Leaves",t_cnt) 
        return await responseSuccess(req, res, "Pending Leaves",userPendinLeave.left_leave)

    } catch (error) {
    logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

// exports.updateStatusOfLeaveApps = async(req, res) => {
//     try {
//         let {leave_app_id , leave_app_status , head_leave_id , head_leave_cnt_id, submitted_by , no_of_days, remarks} = req.body
//         let body = req.body;
          
//         await req.config.userLeaveApps.update(body, {
//             where:{
//                 leave_app_id: leave_app_id
//             }
//         })

//         // find user whom to reply
//         let repliedToUser  = await req.config.users.findOne({
//             where:{
//                 user_id: submitted_by
//             }
//         })

//         // check status of the application
//         if(leave_app_status == "approved") {

//             // if approved create or update user leave table
//             let userLeaveData = await req.config.userLeaves.findOne({
//                 where:{
//                     head_leave_cnt_id: head_leave_cnt_id,
//                     user_id: submitted_by
//                 }
//             })

//             // if user leave table not exist create one 
//             if(!userLeaveData){

//                 // let headLeaveData = await req.config.leaveHeads.findOne({
//                 //     where:{
//                 //         head_leave_id: head_leave_id,
//                 //     }
//                 // })

//                 let headLeaveCountData = await req.config.leaveHeadCounts.findOne({
//                     where:{
//                         head_leave_cnt_id: head_leave_cnt_id,
//                     }
//                 })

//                 await req.config.userLeaves.create({
//                     user_id: submitted_by,
//                     head_leave_id:head_leave_id,
//                     head_leave_cnt_id: head_leave_cnt_id,
//                     left_leave: headLeaveCountData.total_head_leave - no_of_days,
//                     remarks: remarks
//                 })
//             } else {
//                 // if user leave table exist update table leaves
//                  await req.config.userLeaves.update({
//                     left_leave: userLeaveData.left_leave - no_of_days
//                 }, {
//                     where: {
//                         user_leave_id: userLeaveData.user_leave_id,
//                     }
//                 })
//             }

//             // sending email to the user
//             let option = {
//                 from: "LeadShyne <vishal.jais00@gmail.com>",
//                 email: repliedToUser.email,
//                 subject: `Leave Application - ${leave_app_status} `,
//                 message: `You application has been approved`,
//             }
//             await sendEmail(option);
//             return await responseSuccess(req, res, "user leave application aprooved Succesfully")

//         } else {
//             let option = {
//                 from: "LeadShyne <vishal.jais00@gmail.com>",
//                 email: repliedToUser.email,
//                 subject: `Leave Application - ${leave_app_status} `,
//                 message: `You application has been rejected`,
//             }
//             await sendEmail(option);
//             return await responseSuccess(req, res, "leave application rejected Succesfully")
//         }

//     } catch (error) {
//    logErrorToFile(error)
//         console.log(error)
//         return await responseError(req, res, "Something Went Wrong")
//     }
// }

exports.updateStatusOfLeaveApps = async (req, res) => {
    try {
      const { leave_app_id, leave_app_status, head_leave_id, head_leave_cnt_id, submitted_by, no_of_days, remarks } = req.body;
  
      // Find the user to whom to reply
      const repliedToUser = await req.config.users.findByPk(submitted_by);
  
      let message;
      switch (leave_app_status) {
        case "approved":
          // Find the user leave count for deducting the leaves
          const userLeaveData = await req.config.userLeaves.findOne({
            where: {
              head_leave_cnt_id,
              user_id: submitted_by,
            },
          });
  
          // If user leave table does not exist, create one
          if (!userLeaveData) {
            const headLeaveCountData = await req.config.leaveHeadCounts.findByPk(head_leave_cnt_id);
            await req.config.userLeaves.create({
              user_id: submitted_by,
              head_leave_id,
              head_leave_cnt_id,
              left_leave: headLeaveCountData.total_head_leave - no_of_days,
              remarks,
            });
          } else {
            // If user leave table exists, update the table leaves
            await userLeaveData.update({
              left_leave: userLeaveData.left_leave - no_of_days,
            });
          }
  
          message = "Your application has been approved";
          break;
  
        case "rejected":
          // Code for rejecting the leave application
          message = "Your application has been rejected";
          break;
  
        default:
          // Handle the invalid leave_app_status value
          return await responseError(req, res, "Invalid leave application status");
      }
  
      // Update the leave application
      await req.config.userLeaveApps.update(req.body, {
        where: {
          leave_app_id,
        },
      });
  
      // Send email to the user
      const option = {
        from: "Srijan Bandhan <vishal.jais00@gmail.com>",
        email: repliedToUser.email,
        subject: `Leave Application - ${leave_app_status} `,
        message,
      };
      await sendEmail(option);
      return await responseSuccess(req, res, `User leave application ${leave_app_status} successfully`);
    } catch (error) {
    logErrorToFile(error)
      console.log(error);
      return await responseError(req, res, "Something Went Wrong");
    }
  };