# Email Setup Guide - Resend Integration

## What I Added

I've integrated **Resend** email service into your project to send booking confirmation emails.

## Setup Steps

### 1. Get a Resend API Key

1. Go to [resend.com](https://resend.com)
2. Sign up for a free account
3. Copy your API key from the dashboard
4. Update your `.env` file:

```env
RESEND_API_KEY=re_your_api_key_here
```

Replace `re_your_api_key_here` with your actual Resend API key.

### 2. Test Email Sending

Once you have your API key set:

1. **Start your server:**
   ```bash
   npm run dev
   ```

2. **Send a test email using this curl command:**
   ```bash
   curl -X POST http://localhost:5000/api/test-email \
     -H "Content-Type: application/json" \
     -d '{
       "email": "your-email@gmail.com",
       "subject": "Test Email",
       "message": "This is a test email from my Parish website!"
     }'
   ```

   Replace `your-email@gmail.com` with your email address.

3. **Check your inbox** - You should receive the test email within seconds!

## How It Works in Your App

### Service Request Booking
When someone submits a service request (baptism, marriage, etc.):
1. Their booking is saved to the database
2. A confirmation email is sent with:
   - Booking details (service type, date, time)
   - A verification link they click to confirm
3. Email includes a personalized message with their name

### Email Features
- ✅ Automatic confirmation emails on booking
- ✅ Verification links to confirm bookings
- ✅ Professional HTML formatting
- ✅ Personalized with parishioner's name
- ✅ Test endpoint for development

## Troubleshooting

**"Email send failed"**
- Check your API key is correct in `.env`
- Make sure server is restarted after updating `.env`
- Check that `npm install resend` ran successfully

**"Test email not received"**
- Check spam/junk folder
- Verify the email address is correct
- Try a different email address

**"RESEND_API_KEY not configured"**
- Make sure you added `RESEND_API_KEY=...` to `.env`
- Restart the server after updating `.env`

## File Changes

- `server.js` - Added Resend integration and email sending function
- `.env` - Added RESEND_API_KEY variable
- `package.json` - Added resend dependency

## Next Steps

Once you confirm emails are working:
- Email notifications will automatically send when parishioners book services
- You can customize email templates in `server.js` (lines with `emailHtml`)
- Consider adding emails for other events (prayer approvals, event confirmations, etc.)
