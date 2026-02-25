# Giaom Marketplace Server

Express.js backend server for Giaom Marketplace.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment Variables
```bash
cp .env.example .env
```
Then edit `.env` with your configuration.

### 3. Run Development Server
```bash
npm run dev
```

Server will run on `http://localhost:5000`

## 📝 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## 🔧 Environment Variables

See `.env.example` for required environment variables.

### Email Configuration

The email service supports multiple configurations:

**Option 1: SMTP (Gmail, Outlook, Brevo, etc.)**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME=Giaom Marketplace
```

**For Brevo (Sendinblue):**
```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-brevo-email@domain.com
SMTP_PASS=your-brevo-smtp-key
EMAIL_FROM=any-email@domain.com  # Just the "From" field in email (can be any email)
EMAIL_FROM_NAME=Giaom Marketplace
```
**Note:** Get your SMTP credentials from Brevo dashboard → SMTP & API → SMTP. The `EMAIL_FROM` is just the sender name shown in emails and doesn't affect authentication.

**Option 2: SendGrid (via SMTP)**
```env
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Giaom Marketplace
```

**Note:** SendGrid uses SMTP with `smtp.sendgrid.net` as the host. The username must be `apikey` and the password is your SendGrid API key.

**Option 3: Development Mode (No Configuration)**
If no email configuration is provided, emails will be logged to the console in development mode.

**Required for all modes:**
```env
CLIENT_URL=http://localhost:3000  # Frontend URL for email links
```

**Troubleshooting Email Issues:**

1. **Gmail Authentication:**
   - Enable 2-Factor Authentication on your Google account
   - Generate an [App Password](https://support.google.com/accounts/answer/185833)
   - Use the App Password (16 characters) as `SMTP_PASS`, NOT your regular password
   - Make sure `SMTP_USER` is your full Gmail address

2. **SendGrid Authentication:**
   - Verify your API key has "Mail Send" permissions
   - The API key should start with `SG.`
   - Check that the API key is not expired or revoked

3. **Common SMTP Issues:**
   - Port 587 = TLS (use `SMTP_SECURE=false`)
   - Port 465 = SSL (use `SMTP_SECURE=true`)
   - Some providers require specific ports (Gmail: 587, Outlook: 587)

4. **Brevo/Sendinblue Specific:**
   - Get SMTP credentials from Brevo → SMTP & API → SMTP
   - Use your Brevo account email as `SMTP_USER`
   - Use the SMTP key (not API key) as `SMTP_PASS`
   - Make sure there are no extra spaces in your .env values
   - The `EMAIL_FROM` is just informational and doesn't affect SMTP authentication

5. **Testing:**
   - The server will verify the email connection on startup
   - Check console logs for connection status
   - If verification fails, check the error messages for specific guidance
   - Look for detailed error codes and server responses in the logs

## 📁 Project Structure

```
src/
├── server.ts          # Main server entry point
├── config/         # Configuration files
├── models/            # Mongoose models
├── routes/           # API routes
├── controllers/      # Route controllers
├── middleware/       # Custom middleware
└── utils/            # Utility functions
```
