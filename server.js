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

app.post('/api/verify-payment', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

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

  return res.json({ success: true, razorpay_order_id, razorpay_payment_id });
});

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
