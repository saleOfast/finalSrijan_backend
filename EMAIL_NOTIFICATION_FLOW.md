# Email Notification Flow - Channel Partner Platform

This document provides a comprehensive overview of all email notifications sent in the Channel Partner platform, including when they are triggered and how they work.

---

## 📧 Email Infrastructure

### Email Service Providers
The platform uses two email service implementations:

1. **Primary Mailer** (`common/mailer.js`)
   - Uses **nodemailer** library
   - Default SMTP: `smtp.office365.com:587`
   - Default From: `info@theprosperity.in`
   - Used for most platform notifications

2. **Cybermail** (`common/cybermail.js`)
   - Alternative mailer using Brevo (formerly Sendinblue)
   - SMTP: `smtp-relay.brevo.com:587`
   - Used for bulk email functionality

### Email Configuration
- **Storage**: Email configurations stored in `db_email_config` table
- **Templates**: Email templates stored in `db_email_templates` table
- **Template Management**: Controllers for managing templates and configurations
  - `controllers/emailConfigController.js` - Manage SMTP settings
  - `controllers/emailTemplatesController.js` - Manage email templates

---

## 🔔 Email Notification Triggers

### 1. **Channel Partner (CP) Onboarding Flow

#### 1.1 New CP Lead Registration
**Trigger**: When a new channel partner lead is created  
**Endpoint**: `POST /api/v1/db/channelPartnerLeads`  
**Controller**: `contactUsController.addChannelPartnerLead`  
**Template ID**: `9` (`newCPLead.html`)

**When Sent**:
- Immediately when a new CP lead submits registration form
- Email sent to **Admin** (database admin email)

**Email Content**:
- Subject: "New Channel Partner Lead"
- Recipient: Admin email
- Includes: Lead name, phone, email, company name

---

#### 1.2 CP User Creation (Registration Link)
**Trigger**: When admin creates a CP user account  
**Endpoint**: `POST /api/v1/db/users` (with `role_id = 1`)  
**Controller**: `userController.createUser`  
**Template ID**: `8` (`signup.html`)

**When Sent**:
- Immediately when admin creates CP user account
- Email sent to **CP User** (newly created user)

**Email Content**:
- Subject: "NK Realtors"
- Recipient: CP user email
- Includes: Registration link with JWT token
- Registration link format: `{client_url}/partner/Signup?token={registrationToken}`

**Additional Info**:
- Registration token expires based on `CP_SIGNUP_EXPIRES` env variable
- Token contains: `user_id`, `db_name`, expiration time

---

#### 1.3 CP Registration Completion - Password Reset
**Trigger**: When CP is approved (doc_verification = 2)  
**Endpoint**: `PUT /api/v1/db/users/{id}`  
**Controller**: `userController.updateUser` → `handleAcceptProcess` → `sendResetPasswordEmail`  
**Template**: `resetPassword.html`

**When Sent**:
- Immediately when admin/BST/Director approves CP documents
- Email sent to **CP User** (approved user)

**Email Content**:
- Subject: "NK Realtors"
- Recipient: CP user email
- Includes: Password reset link with token
- Reset link format: `{client_url}/partner/ResetViaMail?tkn=u$34{passwordResetToken}`
- Token expires in 1 day
- Includes BD (Business Development) contact details

---

#### 1.4 CP Registration Rejection
**Trigger**: When CP is rejected (doc_verification = 3)  
**Endpoint**: `PUT /api/v1/db/users/{id}`  
**Controller**: `userController.updateUser` → `handleRejectProcess` → `sendRejectionEmail`  
**Template**: `reject.html`

**When Sent**:
- Immediately when admin/BST/Director rejects CP documents
- Email sent to **CP User** (rejected user)

**Email Content**:
- Subject: "NK Realtors"
- Recipient: CP user email
- Includes: Rejection reason and company name

---

#### 1.5 Resend Registration Email
**Trigger**: Manual resend of registration email  
**Endpoint**: `POST /api/v1/db/users/resendEmailToPendingUser`  
**Controller**: `userController.resendEmailToPendingUser`  
**Template ID**: `8` (for CP) or `28` (for other users)

**When Sent**:
- When admin manually resends registration email to pending user
- Email sent to **Pending User**

---

### 2. **Lead Management**

#### 2.1 Lead Creation
**Trigger**: When a new lead is created  
**Endpoint**: `POST /api/v1/db/leads`  
**Controller**: `leadController.storeLead`  
**Template ID**: `15` (`leadCreation.html`)

**When Sent**:
- Immediately when lead is created
- Email sent to **Lead Owner** (user who created the lead)

**Email Content**:
- Subject: "New Lead Created"
- Recipient: Lead owner email
- Includes: Lead name, lead code, company name

---

#### 2.2 Lead Assignment
**Trigger**: When a lead is assigned to a user  
**Endpoint**: `PUT /api/v1/db/leads/{id}?as=true`  
**Controller**: `leadController.editLead`  
**Template ID**: `16` (`leadAssigned.html`)

**When Sent**:
- When lead is assigned to another user (via `as` query parameter)
- Email sent to **Assigned User**

**Email Content**:
- Subject: "Lead Assigned"
- Recipient: Assigned user email
- Includes: Lead name, lead code, company name

---

#### 2.3 Lead Update
**Trigger**: When a lead is updated  
**Endpoint**: `PUT /api/v1/db/leads/{id}`  
**Controller**: `leadController.editLead`  
**Template ID**: `17` (`leadUpdate.html`)

**When Sent**:
- Immediately when lead details are updated
- Email sent to **Lead Owner** (user who updated the lead)

**Email Content**:
- Subject: "Lead Updated"
- Recipient: Lead owner email
- Includes: Lead name, lead code, company name

---

#### 2.4 Pending Lead Notification (Cron Job)
**Trigger**: Automated cron job (runs every minute)  
**Cron Function**: `channelLeadController.sendMailToLeadOwners`  
**Template ID**: `2` (`pendingLeads.html`)

**When Sent**:
- **Automated**: Runs every 1 minute via cron job
- Finds leads that:
  - Are in stage 1 (initial stage)
  - Are older than 24 hours
  - Have not been assigned (`mailSent = false/null`)
- Email sent to **Lead Owner**

**Email Content**:
- Subject: "NK Realtors"
- Recipient: Lead owner email
- Includes: Lead name, phone, email, company name
- Marks lead as `mailSent = true` after sending

---

### 3. **Account Management**

#### 3.1 Account Creation
**Trigger**: When a new account is created  
**Endpoint**: `POST /api/v1/db/account`  
**Controller**: `AccountController.storeAccount`  
**Template ID**: `11` (`accountCreation.html`)

**When Sent**:
- Immediately when account is created
- Email sent to **Account Owner**

**Email Content**:
- Subject: "New Account Created"
- Recipient: Account owner email
- Includes: Account name, account code, company name

---

#### 3.2 Account Update
**Trigger**: When an account is updated  
**Endpoint**: `PUT /api/v1/db/account/{id}`  
**Controller**: `AccountController.updateAccount`  
**Template**: `accountUpdate.html`

**When Sent**:
- Immediately when account is updated
- Email sent to **Account Owner**

---

### 4. **Contact Management**

#### 4.1 Contact Creation
**Trigger**: When a new contact is created  
**Endpoint**: `POST /api/v1/db/contacts`  
**Controller**: `contactController.storeContact`  
**Template ID**: `13` (`contactCreation.html`)

**When Sent**:
- Immediately when contact is created (if associated with account)
- Email sent to **Contact Owner**

**Email Content**:
- Subject: "New Contact Created"
- Recipient: Contact owner email
- Includes: Contact name, account name, company name

---

#### 4.2 Contact Update
**Trigger**: When a contact is updated  
**Endpoint**: `PUT /api/v1/db/contacts/{id}`  
**Controller**: `contactController.updateContact`  
**Template**: `contactUpdate.html`

**When Sent**:
- Immediately when contact is updated
- Email sent to **Contact Owner**

---

### 5. **Opportunity Management**

#### 5.1 Opportunity Creation
**Trigger**: When a new opportunity is created  
**Endpoint**: `POST /api/v1/db/opportunity`  
**Controller**: `opportunityController.storeOpportunity`  
**Template**: `opportunityCreation.html`

**When Sent**:
- Immediately when opportunity is created
- Email sent to **Opportunity Owner**

**Email Content**:
- Subject: "New Opportunity Created"
- Recipient: Opportunity owner email
- Uses email configuration from database

---

### 6. **Brokerage Management**

#### 6.1 Brokerage Creation
**Trigger**: When a new brokerage is created  
**Endpoint**: `POST /api/v1/db/channel/brokerage`  
**Controller**: `brokerageController.storeBrokerage`  
**Template**: `brokerageCreation.html`

**When Sent**:
- Immediately when brokerage is created
- Email sent to **Brokerage Owner** (lead owner)

**Email Content**:
- Subject: "New Brokerage Created"
- Recipient: Lead owner email
- Uses email configuration from database

---

### 6.2 **Campaign Management**

#### 6.2.1 Campaign Upload Notification
**Trigger**: When a new campaign is uploaded  
**Endpoint**: `POST /api/v1/db/media/campaign/campaignManagement/addCampaign`  
**Controller**: `campaignManagementController.addCampaign`  
**Template ID**: `18` (`campaignCreation.html`)

**When Sent**:
- Immediately when campaign is created/uploaded
- Email sent to **All active CP users** (role_id = 1)
- Email sent to **All active BST users** (role_id = 2)

**Email Content**:
- Subject: "New Campaign Uploaded"
- Recipient: All CP and BST users with valid email addresses
- Includes: Campaign name, campaign code, company name
- Uses email configuration from database
- Email sending failures don't block campaign creation

**Key Features**:
- Sends notifications to all active Channel Partners (CP) and Business Sales Team (BST) members
- Uses template from database (template_id: 18) or falls back to file template
- Graceful error handling - continues even if some emails fail
- Only sends to users with valid email addresses

---

### 7. **User Management**

#### 7.1 Password Reset Request (OTP)
**Trigger**: When user requests password reset  
**Endpoint**: `POST /api/v1/db/users/sendOtp`  
**Controller**: `userController.sendOtp`  
**Template ID**: `7` (`sendotp.html`)

**When Sent**:
- Immediately when user requests password reset via OTP
- Email sent to **User** (requesting user)

**Email Content**:
- Subject: "OTP verification for password reset"
- Recipient: User email
- Includes: OTP code, company name

---

#### 7.2 Password Reset (Token-based)
**Trigger**: When user requests password reset  
**Endpoint**: `POST /api/v1/db/users/forgotpassword`  
**Controller**: `userController.forgotpassword`  
**Template ID**: `6` (`forgot.html`)

**When Sent**:
- Immediately when user requests password reset
- Email sent to **User** (requesting user)

**Email Content**:
- Subject: "Your passowrd reset token only 1 day"
- Recipient: User email
- Includes: Password reset link with token
- Reset link format: `{client_url}/ChangePassword?tkn=u$34{passwordResetToken}`
- Token expires in 1 day

---

#### 7.3 Database Creation (Admin Setup)
**Trigger**: When a new database/client is created  
**Endpoint**: `POST /api/v1/db/dbCreate`  
**Controller**: `dbCreateController.db_creater`

**When Sent**:
- Immediately when new database is created
- Email sent to **Admin User** (database admin)

**Email Content**:
- Subject: "NK Realtors"
- Recipient: Admin email
- Includes: Welcome message and password reset link

---

### 8. **Leave Management**

#### 8.1 Leave Application
**Trigger**: When user submits leave application  
**Endpoint**: `POST /api/v1/db/leaveapp`  
**Controller**: `userLeaveApplicationController.storeLeaveApp`

**When Sent**:
- Immediately when leave application is created
- Email sent to **Reporting Manager** (user's report_to)

**Email Content**:
- Subject: "Leave Application"
- Recipient: Reporting manager email
- Includes: Leave application reason

---

#### 8.2 Leave Approval/Rejection
**Trigger**: When leave is approved or rejected  
**Endpoint**: `PUT /api/v1/db/leaveapp/{id}`  
**Controller**: `userLeaveApplicationController.updateLeaveApp`

**When Sent**:
- When leave status is updated (approved/rejected)
- Email sent to **User** (leave applicant)

---

### 9. **Expense Management**

#### 9.1 Expense Application
**Trigger**: When user submits expense request  
**Endpoint**: `POST /api/v1/db/expence`  
**Controller**: `expenceController.storeExpence`

**When Sent**:
- Immediately when expense request is created
- Email sent to **Reporting Manager** (user's report_to)

**Email Content**:
- Subject: "Expennce Request"
- Recipient: Reporting manager email
- Includes: Expense amount, user name, date

---

#### 9.2 Expense Approval/Rejection
**Trigger**: When expense is approved or rejected  
**Endpoint**: `PUT /api/v1/db/expence/{id}`  
**Controller**: `expenceController.updateExpence`

**When Sent**:
- When expense status is updated (approved/rejected)
- Email sent to **User** (expense applicant)

---

### 10. **ERP Integration**

#### 10.1 ERP Lead Webhook Notification
**Trigger**: When ERP system sends lead via webhook  
**Endpoint**: `POST /api/v1/erp/webhook/lead`  
**Controller**: `erpController.webhookUpsertLead`

**When Sent**:
- After ERP lead is successfully processed (created/updated)
- Email sent to **Admin** (if admin email exists)

**Email Content**:
- Subject: "New Lead Created" or "Lead Updated"
- Recipient: Admin email
- Includes: Lead name, lead code, processing status
- Uses email configuration from database
- Email sending is optional (errors don't fail the webhook)

---

### 11. **Scheduled/Automated Emails (Cron Jobs)**

#### 11.1 Pending CP Request Notification (72 Hours)
**Trigger**: Automated cron job (runs every minute)  
**Cron Function**: `userController.sendMailToReportTos`  
**Template**: `pendingCPRequests.html`

**When Sent**:
- **Automated**: Runs every 1 minute via cron job
- Finds CP requests that:
  - Are pending verification (`doc_verification = 0 or 1`)
  - Are older than 72 hours
  - Have not been emailed (`mailSent = false/null`)
  - Role ID = 1 (Channel Partner)
- Email sent to:
  - **Admin** (database admin)
  - **Reporting Manager** (CP's report_to user)

**Email Content**:
- Subject: "NK Realtors"
- Recipient: Admin and reporting manager emails
- Includes: CP name, contact number, email, company name
- Marks request as `mailSent = true` after sending

---

#### 11.2 Pending Lead Notification (24 Hours)
**Trigger**: Automated cron job (runs every minute)  
**Cron Function**: `channelLeadController.sendMailToLeadOwners`  
**Template ID**: `2` (`pendingLeads.html`)

**When Sent**:
- **Automated**: Runs every 1 minute via cron job
- Finds leads that:
  - Are in stage 1 (initial stage)
  - Are older than 24 hours
  - Have not been assigned (`mailSent = false/null`)
- Email sent to **Lead Owner**

**Details**: See section 2.4 above

---

### 12. **Bulk Email**

#### 12.1 Bulk Email to All Users
**Trigger**: Manual bulk email send  
**Endpoint**: `POST /api/v1/db/email/SendEmail`  
**Controller**: `emailController.SendEmail`

**When Sent**:
- When admin manually sends bulk email
- Email sent to **All users** in email list

**Email Content**:
- Subject: Custom subject from request
- Recipient: All users in `db_email` table
- Includes: Custom message with user name

---

## 📋 Email Template System

### Template Storage
- Templates stored in `db_email_templates` table
- Each template has a `template_id` and `template` (HTML content)
- Templates can be managed via `emailTemplatesController`

### Template Variables
Common template variables used across emails:
- `{{CompanyName}}` - Organization name
- `{{UserName}}` - User name
- `{{UsersName}}` - User name (alternate)
- `{{EmailID}}` - Email address
- `{{PhoneNo}}` - Phone number
- `{{BDName}}` - Business Development person name
- `{{resetLink}}` - Password reset link
- `{{signupLink}}` - Registration/signup link
- `{{OTP}}` - OTP code
- `{{reject_reason}}` - Rejection reason
- `{{LeadName}}` - Lead name
- `{{LeadId}}` - Lead code
- `{{AccountName}}` - Account name
- `{{AccountId}}` - Account code
- `{{ContactName}}` - Contact name
- `{{CampaignName}}` - Campaign name
- `{{CampaignId}}` - Campaign code

### Template IDs Reference
| Template ID | Template Name | Usage |
|------------|---------------|-------|
| 2 | pendingLeads.html | Pending lead notifications (24 hrs) |
| 3 | pendingCPRequests.html | Pending CP requests (72 hrs) |
| 6 | forgot.html | Password reset |
| 7 | sendotp.html | OTP for password reset |
| 8 | signup.html | CP registration link |
| 9 | newCPLead.html | New CP lead notification |
| 11 | accountCreation.html | Account creation |
| 13 | contactCreation.html | Contact creation |
| 15 | leadCreation.html | Lead creation |
| 16 | leadAssigned.html | Lead assignment |
| 17 | leadUpdate.html | Lead update |
| 18 | campaignCreation.html | Campaign upload notification |
| 28 | resetPassword.html | Password reset (alternate) |
| 29 | - | Channel Partner Reg Link Template |

---

## 🔄 Email Flow Architecture

### Email Sending Flow
```
Controller Action
    ↓
Prepare Email Data
    ↓
Fetch Email Template (from db_email_templates)
    ↓
Replace Template Variables
    ↓
Fetch Email Config (from db_email_config) [Optional]
    ↓
Call sendEmail() function
    ↓
Configure SMTP Transport (nodemailer)
    ↓
Send Email
    ↓
Log Success/Error
```

### Email Configuration Priority
1. **Database Configuration** (if exists): Uses `db_email_config` table settings
2. **Default Configuration**: Uses hardcoded defaults in `mailer.js`
   - Host: `smtp.office365.com`
   - Port: `587`
   - User: `info@theprosperity.in`
   - From: `info@theprosperity.in`

---

## 📊 Email Notification Summary Table

| Category | Trigger | Recipient | Template | Frequency |
|----------|---------|-----------|----------|-----------|
| CP Lead Registration | New CP lead | Admin | Template 9 | Immediate |
| CP User Creation | Admin creates CP user | CP User | Template 8 | Immediate |
| CP Approval | Documents approved | CP User | resetPassword.html | Immediate |
| CP Rejection | Documents rejected | CP User | reject.html | Immediate |
| Lead Creation | New lead created | Lead Owner | Template 15 | Immediate |
| Lead Assignment | Lead assigned | Assigned User | Template 16 | Immediate |
| Lead Update | Lead updated | Lead Owner | Template 17 | Immediate |
| Pending Leads | Lead > 24 hrs old | Lead Owner | Template 2 | Cron (1 min) |
| Account Creation | New account | Account Owner | Template 11 | Immediate |
| Contact Creation | New contact | Contact Owner | Template 13 | Immediate |
| Opportunity Creation | New opportunity | Opportunity Owner | opportunityCreation.html | Immediate |
| Brokerage Creation | New brokerage | Lead Owner | brokerageCreation.html | Immediate |
| Campaign Upload | New campaign uploaded | All CP + BST Users | Template 18 | Immediate |
| Password Reset OTP | User requests reset | User | Template 7 | Immediate |
| Password Reset Token | User requests reset | User | Template 6 | Immediate |
| Leave Application | User submits leave | Reporting Manager | Plain text | Immediate |
| Expense Application | User submits expense | Reporting Manager | Plain text | Immediate |
| Pending CP Requests | CP > 72 hrs pending | Admin + Manager | Template 3 | Cron (1 min) |
| ERP Lead Webhook | ERP sends lead | Admin | Plain text | Immediate |
| Bulk Email | Admin sends bulk | All users | Custom | Manual |

---

## 🛠️ Cron Job Configuration

### Cron Jobs Setup
Cron jobs are configured in:
- `connectionResolver/resolver.js`
- `connectionResolver/OptimisedResolver.js`

### Scheduled Tasks
1. **Lead Assignment Round Robin** - Runs every 1 minute
2. **Pending Lead Notifications** - Runs every 1 minute
3. **Pending CP Request Notifications** - Runs every 1 minute

### Cron Schedule Format
- Current: `'* * * * *'` (every minute)
- Can be customized as per requirements

---

## 🔍 Key Files Reference

### Email Service Files
- `common/mailer.js` - Primary email service (nodemailer)
- `common/cybermail.js` - Alternative email service (Brevo)

### Email Controllers
- `controllers/emailController.js` - Bulk email functionality
- `controllers/emailConfigController.js` - Email configuration management
- `controllers/emailTemplatesController.js` - Email template management

### Email Templates Location
- `mail/cp/` - Channel Partner email templates
- Templates are also stored in database (`db_email_templates`)

### Controllers with Email Functionality
- `controllers/userController.js` - User management, CP onboarding
- `controllers/leadController.js` - Lead management
- `controllers/channel/channelLeadController.js` - Channel lead management
- `controllers/contactUsController.js` - CP lead registration
- `controllers/AccountController.js` - Account management
- `controllers/contactController.js` - Contact management
- `controllers/opportunityController.js` - Opportunity management
- `controllers/channel/brokerageController.js` - Brokerage management
- `controllers/media/Campaign/campaignManagementController.js` - Campaign management
- `controllers/erpController.js` - ERP integration
- `controllers/userLeaveApplicationController.js` - Leave management
- `controllers/expenceController.js` - Expense management

---

## 📝 Notes

1. **Email Configuration**: Most emails use database-stored email configuration if available, otherwise fall back to defaults
2. **Error Handling**: Email sending errors are logged but don't always fail the main operation
3. **Template System**: Templates can be customized via database or file system
4. **Cron Jobs**: Automated email notifications run every minute for pending items
5. **Token Expiration**: 
   - Registration tokens: Based on `CP_SIGNUP_EXPIRES` env variable
   - Password reset tokens: 1 day expiration
6. **Multi-tenant Support**: Email system supports multiple databases/clients

---

*Last Updated: Based on current codebase analysis*

