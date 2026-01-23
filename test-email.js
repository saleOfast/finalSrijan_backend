const sendEmail = require('./common/mailer');

// Test email configuration
async function testEmail() {
    console.log('🧪 Testing Email Configuration...\n');
    
    const testEmailOptions = {
        email: 'agautam@kloudrac.com', // Your test email
        subject: 'Test Email from Server',
        message: `
            <h2>Email Test</h2>
            <p>This is a test email to verify your email configuration.</p>
            <p>If you receive this email, your SMTP settings are working correctly!</p>
            <hr>
            <p><strong>Configuration:</strong></p>
            <ul>
                <li>Host: smtp.office365.com</li>
                <li>Port: 587</li>
                <li>From: srijanbandhan@srijanrealty.in</li>
            </ul>
        `
    };

    try {
        console.log('📧 Attempting to send test email...');
        console.log('To:', testEmailOptions.email);
        console.log('From: srijanbandhan@srijanrealty.in\n');
        
        const result = await sendEmail(testEmailOptions);
        
        console.log('\n✅ SUCCESS! Email sent successfully!');
        console.log('Message ID:', result.messageId);
        console.log('\n📬 Please check the inbox (and spam folder) of:', testEmailOptions.email);
        
    } catch (error) {
        console.error('\n❌ ERROR! Email sending failed!\n');
        console.error('Error Details:');
        console.error('Message:', error.message);
        console.error('Code:', error.code);
        console.error('Command:', error.command);
        
        console.log('\n🔍 Troubleshooting Steps:');
        console.log('1. Verify email credentials are correct');
        console.log('2. Check if Office365 account allows SMTP access');
        console.log('3. Verify password is correct (no extra spaces)');
        console.log('4. Check if 2FA is enabled (may need app password)');
        console.log('5. Verify SMTP is enabled in Office365 settings');
        console.log('6. Check firewall/network restrictions');
        console.log('7. Try testing from Outlook web to verify account works');
        
        if (error.code === 'EAUTH') {
            console.log('\n⚠️  Authentication Error:');
            console.log('   - Username or password is incorrect');
            console.log('   - If 2FA is enabled, use an App Password');
        } else if (error.code === 'ECONNECTION') {
            console.log('\n⚠️  Connection Error:');
            console.log('   - Cannot connect to SMTP server');
            console.log('   - Check network/firewall settings');
            console.log('   - Verify host and port are correct');
        }
    }
}

// Run the test
testEmail();
