const { Op } = require("sequelize");
const {responseError, responseSuccess} = require('../helper/responce')
const sendEmail = require("../common/mailer")
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

exports.storeuserExpences = async(req, res) =>{

    try {

        let body = req.body;
        body.submitted_by = req.user.user_id
        body.report_to = req.user.report_to
        if(req.user.report_to == null) return await responseError(req, res, "User doesn't reports to anyone")
        let reportToUser  = await req.config.users.findOne({
            where:{
                user_id: req.user.report_to
            },
            paranoid: false
        })
        let userExpencesData =  await req.config.userExpences.create(body)

  

        // sending email to user
        let option = {
            email: reportToUser.email,
            subject: "Expennce Request",
            message: `expence of  ${body.total_expence} by ${req.user.user} on date ${body.from_date}`,
        }
        await sendEmail(option);
        return await responseSuccess(req, res, "Expence application created Succesfully", userExpencesData)

    } catch (error) {
    logErrorToFile(error)
        console.log(error);
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.uploadExpenceFile = async(req, res) =>{
    try {

          //    post multi expence doc

          const file = req.files?.file;
          let newfile = []
          if (file && file.length === undefined) {
              newfile.push(file)
          }else{
              if(file){
                  newfile = file
              }
          }
          if (newfile.length > 0) {
            for (let i = 0; i < newfile.length; i++) {
                  const extName = path.extname(newfile[i].name);
                  const imgList = [".png", ".jpg", ".jpeg", ".pdf", ".PDF"];
                  if (!imgList.includes(extName)) {
                      return res.status(400).json({ msg: "Invalid image fromat." });
                  }
                  const image_name = Date.now() + extName;
                  var uploadPath = path.resolve(
                  __dirname,
                  "../../uploads/supportDoc/images"+i + image_name
                  );
                  newfile[i].mv(uploadPath, function (err, result) {
                  if (err) {
                      return res.status(400).json({ msg: err });
                  }
                  });
                  let data = { 
                      expence_fl: i+image_name, 
                      expence_by: req.body.exp_id,
                  };
                  await req.config.expenceFl.create(data);
        };
    }

      return await responseSuccess(req, res, "File uploaded")
       
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

        let userExpencesData = await req.config.userExpences.findAll({
            where: whereClause,
            include: [
                {model: req.config.users, as:"ExpenceSubmittedTo", attributes: ['user_id', 'user'], paranoid: false,},
                {model: req.config.users, as:"ExpenceSubmittedBy", attributes: ['user_id', 'user'], paranoid: false,},
                {model: req.config.policyHead , paranoid: false,},
                {model: req.config.policyTypeHead, paranoid: false,},
        ],order: [['status', 'ASC'],['from_date', 'DESC']]
        })
             //console.log("lead", lead[0].dataValues.db_department.dataValues.department)
       // console.log('lead', lead);
            let excelClientData = []
            userExpencesData?.forEach(element => {
                let item = {
                    "Applicant Name": element?.dataValues?.ExpenceSubmittedBy?.dataValues.user,
                    "submitted To": element?.dataValues.ExpenceSubmittedTo?.dataValues.user,
                    "Claim Type": element?.dataValues.claim_type,
                    "Policy Head":  element?.dataValues.db_policy_head?.dataValues.policy_name,
                    "From Date":  dateChange(element?.dataValues.from_date),
                    "To Date":  dateChange(element?.dataValues.to_date),
                    "From Location":  element?.dataValues.from_location,
                    "To Location":  element?.dataValues.to_location, 
                    "Kilometer":  element?.dataValues.kms, 
                    "Total Expence":  element?.dataValues.total_expence,
                    "Status":  element?.dataValues.status,
                    "Remarks":  element?.dataValues.remark,
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


exports.getuserExpences = async(req, res) =>{
    try {
        whereClause ={};
        if(!req.user.isDB) {
            if(req.query.mode == 'rpt'){
                whereClause = {
                    report_to:  req.user.user_id,
                    status: 'pending'
                }
            }else{
                whereClause = {
                    submitted_by: req.user.user_id
                }
            }
        }

        // query for from & to date
        if(req.query.f_date && req.query.t_date && req.query.f_date != "null" && req.query.f_date != "undefined" && req.query.t_date != "null" && req.query.t_date != "undefined" ) {
            whereClause.from_date =  {
                [Op.between]: [req.query.f_date, req.query.t_date],
              };
        }

        // query for application status
        if(req.query.status && req.query.status != null  && req.query.status != "null" && req.query.status != undefined  && req.query.status != 'undefined' ){
            whereClause.status = req.query.status;
        }
        
        // query for application user id eg . mukesh , heera
        if(req.query.u_id && req.query.u_id != null && req.query.u_id != "null" && req.query.u_id != undefined && req.query.u_id != "undefined"){
            whereClause.submitted_by = req.query.u_id;  
        }

        // query for application claim type TA
        if(req.query.claim_type && req.query.claim_type != null && req.query.claim_type != "null" && req.query.claim_type != undefined && req.query.claim_type != "undefined"){
            whereClause.claim_type = req.query.claim_type;  
        }

        let userExpencesData;
        if(req.query.expn_id) {
            userExpencesData = await req.config.userExpences.findOne({
                where:{
                    expence_id: req.query.expn_id
                },
                include: [
                    {model: req.config.users, as:"ExpenceSubmittedTo", attributes: ['user_id', 'user'], paranoid: false,},
                    {model: req.config.users, as:"ExpenceSubmittedBy", attributes: ['user_id', 'user'], paranoid: false,},
                    {model: req.config.policyHead , paranoid: false,},
                    {model: req.config.policyTypeHead, paranoid: false,},
                    {model: req.config.expenceFl, paranoid: false,},
            ],  order: [['status', 'ASC'],['from_date', 'DESC']]
            })
        }else {
            userExpencesData = await req.config.userExpences.findAll({
                where: whereClause,
                include: [
                    {model: req.config.users, as:"ExpenceSubmittedTo", attributes: ['user_id', 'user'], paranoid: false,},
                    {model: req.config.users, as:"ExpenceSubmittedBy", attributes: ['user_id', 'user'], paranoid: false,},
                    {model: req.config.policyHead , paranoid: false,},
                    {model: req.config.policyTypeHead, paranoid: false,},
                    {model: req.config.expenceFl, paranoid: false,},
            ],order: [['status', 'ASC'],['from_date', 'DESC']]
            })
        }

        return await responseSuccess(req, res, "User Expence application list", userExpencesData)
       
    } catch (error) {
    logErrorToFile(error)
        console.log(error);
        return await responseError(req, res, "Something Went Wrong")
    }
}


exports.edituserExpences = async(req, res) =>{
    try {
        let {expence_id} = req.body
        let body = req.body;
            await req.config.userExpences.update(body, {
                where:{
                    expence_id: expence_id
                }
            })
            return await responseSuccess(req, res, "application updated")
    } catch (error) {
    logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.deleteuserExpences = async(req, res) =>{
    try {

        let {expn_id} = req.query
        let userExpencesBody = await req.config.userExpences.findOne({
            where:{
                expence_id: expn_id,
            }
        })

        if(!userExpencesBody) return await responseError(req, res, "user expence appliaction does not existed") 
        await userExpencesBody.destroy()
        return await responseSuccess(req, res, "user expence appliaction deleted")

    } catch (error) {
    logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}

exports.updateStatusOfUserExpence = async(req, res) => {
    try {

        let body = req.body;
          
        await req.config.userExpences.update(body, {
            where:{
                expence_id: body.expence_id
            }
        })

        // find user whom to reply
        let repliedToUser  = await req.config.users.findOne({
            where:{
                user_id: body.submitted_by
            }
        })

        // check status of the application
        if(body.status == "approved") {

            // sending email to the user
            let option = {
                from: "Srijan Bandhan <vishal.jais00@gmail.com>",
                email: repliedToUser.email,
                subject: `Expence Application - ${body.status} `,
                message: body.remark,
            }
            await sendEmail(option);
            return await responseSuccess(req, res, "user Expence Application aprooved Succesfully")

        } else {
            let option = {
                from: "Srijan Bandhan <vishal.jais00@gmail.com>",
                email: repliedToUser.email,
                subject: `Expence Application - ${body.status} `,
                message: body.remark,
            }
            await sendEmail(option);
            return await responseSuccess(req, res, "Expence Application rejected Succesfully")
        }

    } catch (error) {
    logErrorToFile(error)
        console.log(error)
        return await responseError(req, res, "Something Went Wrong")
    }
}