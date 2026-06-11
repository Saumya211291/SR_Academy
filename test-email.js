const crypto = require('crypto');
const http = require('http');

const KEY_SECRET = '7YA90pqYo3gx2KokJ0l34ojG'; // Razorpay KEY_SECRET, not Gmail app password
const orderId = 'order_T0G0ASv1VNKI7X';
const paymentId = 'pay_test_12345';
const signature = crypto.createHmac('sha256', KEY_SECRET).update(orderId + '|' + paymentId).digest('hex');

const payload = {
  razorpay_order_id: orderId,
  razorpay_payment_id: paymentId,
  razorpay_signature: signature,
  name: 'Test Student',
  email: 'sr.academyaa@gmail.com',
  phone: '9876543210'
};

const data = JSON.stringify(payload);

const opts = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/verify-payment',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

console.log('Testing payment verification with email...');
console.log('Payload:', payload);

const req = http.request(opts, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    console.log('\nResponse Status:', res.statusCode);
    console.log('Response Body:', body);
    console.log('\n✓ Check your email sr.academyaa@gmail.com for the course enrollment confirmation.');
  });
});

req.on('error', e => {
  console.error('Error:', e.message);
});

req.write(data);
req.end();
