let nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  //   var transport = nodemailer.createTransport({
  //     service: 'gmail',
  //     auth: {
  //       user: "vishal.jais00@gmail.com",
  //       pass: "uqfibzmeumvrpdpr"
  //     }
  //   });


  var transport = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: {
      user: "srijanbandhan@srijanrealty.in",
      pass: "wsnggzdwrglpjlmj"
    },
    tls: {
      rejectUnauthorized: false,
    },
  });


  const mailOptions = {
    //from: "Curekiind <vishal.jais00@gmail.com>",
    from: `Srijan Bandhan  <srijanbandhan@srijanrealty.in>`,
    to: options.email,
    subject: options.subject,
    html: options.message,
    url: options.resetURL,
    // html
  };

  await transport.sendMail(mailOptions, (error, Info) => {
    if (error) {
      console.log(error)
    }
    console.log(Info)

  });
  return
};
module.exports = sendEmail;
