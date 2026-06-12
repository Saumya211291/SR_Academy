const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');

dotenv.config();

const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.error('Error: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET
});

const nodemailer = require('nodemailer');

function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
}

const smtpTransporter = createTransporter();

async function verifySmtpTransporter() {
  if (!smtpTransporter) {
    console.warn('SMTP transporter is not configured. Email sending will fail.');
    return;
  }

  try {
    await smtpTransporter.verify();
    console.log('SMTP transporter verified successfully.');
  } catch (error) {
    console.error('SMTP transporter verification failed:', error && error.message ? error.message : error);
  }
}

async function sendEnrollmentEmail({ to, name, orderId, paymentId }) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'SR Academy <no-reply@sr-academy.example>';
  const driveLink = process.env.COURSE_DRIVE_LINK || 'https://your-drive-link.example.com';

  const html = `
    <p>Hi ${name || 'Student'},</p>
    <p>Thanks for your payment. Your order <strong>${orderId}</strong> was successful (payment id: <code>${paymentId}</code>).</p>
    <p>Access the course here: <a href="${driveLink}">${driveLink}</a></p>
    <p>Regards,<br/>SR Academy</p>
  `;

  const text = `Hi ${name || 'Student'},\n\nThanks for your payment. Your order ${orderId} was successful (payment id: ${paymentId}).\n\nAccess the course here: ${driveLink}\n\nRegards,\nSR Academy`;

  // If SENDGRID_API_KEY is configured, prefer the SendGrid Web API (works from hosts blocking SMTP)
  if (process.env.SENDGRID_API_KEY) {
    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      const msg = {
        to,
        from,
        subject: 'Your SR Academy course access',
        text,
        html
      };
      console.log(`Sending enrollment email via SendGrid to ${to}`);
      const response = await sgMail.send(msg);
      console.log('SendGrid response status:', response && response[0] && response[0].statusCode);
      return response;
    } catch (err) {
      console.error('SendGrid send failed:', err && err.message ? err.message : err);
      throw err;
    }
  }

  // Fallback to SMTP transporter if SendGrid not configured
  if (!smtpTransporter) {
    throw new Error('SMTP credentials are missing or invalid. Email cannot be sent. Consider setting SENDGRID_API_KEY to use SendGrid API.');
  }

  try {
    console.log(`Sending enrollment email to ${to} from ${from} via SMTP`);
    const info = await smtpTransporter.sendMail({
      from,
      to,
      subject: 'Your SR Academy course access',
      text,
      html
    });
    console.log('Enrollment email send info:', {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response
    });
    return info;
  } catch (err) {
    console.error('Error sending enrollment email:', err);
    throw err;
  }
}

app.get('/api/razorpay-key', (req, res) => {
  return res.json({ keyId: RAZORPAY_KEY_ID });
});

app.post('/api/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt } = req.body;
    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount < 100) {
      return res.status(400).json({ error: 'Amount must be at least 100 paise.' });
    }

    const order = await razorpay.orders.create({
      amount: numericAmount,
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
      payment_capture: 1
    });

    return res.json({ order_id: order.id, amount: order.amount, currency: order.currency });
  } catch (error) {
    if (error.statusCode === 401) {
      return res.status(401).json({ error: 'Razorpay authentication failed. Check your key and secret.' });
    }
    return res.status(500).json({ error: 'Unable to create order.', details: error.message });
  }
});

app.post('/api/verify-payment', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, name, email, phone } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing required payment fields.' });
  }

  const generatedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (generatedSignature !== razorpay_signature) {
    return res.status(400).json({ error: 'Signature verification failed.' });
  }

  console.log('Verify payment request payload:', {
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    name,
    email,
    phone
  });

  try {
    if (email) {
      await sendEnrollmentEmail({ to: email, name, orderId: razorpay_order_id, paymentId: razorpay_payment_id });
    } else {
      console.warn('No email provided; skipping sending enrollment email');
    }
  } catch (err) {
    console.error('Error sending enrollment email:', err);
    return res.status(500).json({ error: 'Payment verified but email delivery failed.' });
  }

  return res.json({ success: true, razorpay_order_id, razorpay_payment_id });
});

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Test endpoint to trigger a confirmation email (helpful for debugging SMTP in production)
app.post('/api/send-test-email', async (req, res) => {
  const to = (req.body && req.body.to) || req.query.to;
  if (!to) {
    return res.status(400).json({ error: 'Missing `to` address. Provide JSON {"to":"you@domain.com"} or ?to=you@domain.com' });
  }

  try {
    console.log(`Attempting test email to ${to}`);
    await sendEnrollmentEmail({ to, name: 'Test Student', orderId: 'test_order', paymentId: 'test_payment' });
    console.log(`Test email sent to ${to}`);
    return res.json({ success: true, message: `Test email sent to ${to}` });
  } catch (err) {
    console.error('Test email failed:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Test email failed', details: err && err.message ? err.message : String(err) });
  }
});

const port = process.env.PORT || 3000;
verifySmtpTransporter().then(() => {
  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}).catch((error) => {
  console.error('Failed to verify SMTP transporter at startup:', error);
  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
});
