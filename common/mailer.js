let nodemailer = require("nodemailer");

const sendEmail = async (

    { email, subject, message, resetURL,
        host = 'smtp.office365.com',
        port = 587,
        user = 'srijanbandhan@srijanrealty.in',
        pass = 'wsnggzdwrglpjlmj',
        from = 'srijanbandhan@srijanrealty.in',
    }) => {

    // { email, subject, message, resetURL,
    //     host = 'gmail',
    //     service = 'gmail',
    //     port = 587,
    //     user = 'NK Realtors.info@gmail.com',
    //     pass = 'fkcc eqap eetc srdo',
    //     from = 'info@NK Realtors.com'
    // }) => {

    // {
    //     email, subject, message, resetURL,
    //     host = 'vps9004.vpsunit.com',
    //     port = 587,
    //     user = 'info@NK Realtors.com',
    //     pass = 'EmailInfo@321',
    //     from = 'info@NK Realtors.com'
    // }) => {


    // var transport = nodemailer.createTransport({
    //   service: 'gmail',
    //   auth: {
    //     user: "vishal.jais00@gmail.com",
    //     pass: "luznjvibycgowkgd"
    //   }
    // });

    // var transport = nodemailer.createTransport({
    //     service: service,
    //     auth: {
    //         user: user,
    //         pass: pass
    //     },
    //     from: from
    // });

    var transport = nodemailer.createTransport({
        host,
        port,
        secure: false,
        auth: {
            user: user,
            pass: pass
        },
        tls: {
            rejectUnauthorized: false,
        },
    });


    const mailOptions = {
        from: `Srijan Bandhan <${from}>`,
        to: email,
        subject: subject,
        html: message,
        url: resetURL,
        // html
    };

    await transport.sendMail(mailOptions, (error, Info) => {
        if (error) {
            console.log(error)
        }
    });
    return
};
module.exports = sendEmail;