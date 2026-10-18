const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const Razorpay = require('razorpay');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Validate Razorpay Environment
const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!KEY_ID || !KEY_SECRET) {
  console.warn("⚠️ Warning: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET missing in .env file.");
}

const razorpay = new Razorpay({
  key_id: KEY_ID,
  key_secret: KEY_SECRET
});

// GET /api/config - Public Key ID for Frontend
app.get('/api/config', (req, res) => {
  res.json({
    keyId: KEY_ID
  });
});

// STEP 1: POST /api/create-order
app.post('/api/create-order', async (req, res) => {
  try {
    let { amount, currency, receipt } = req.body;

    if (!amount) {
      return res.status(400).json({ error: "Amount is required." });
    }

    // Ensure amount is in paise (minimum 100 paise = ₹1)
    let amountInPaise = Math.round(Number(amount));
    if (amountInPaise < 100) {
      return res.status(400).json({ error: "Amount must be at least 100 paise (₹1)." });
    }

    const options = {
      amount: amountInPaise,
      currency: currency || "INR",
      receipt: receipt || `rcpt_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: KEY_ID
    });
  } catch (err) {
    console.error("Razorpay order creation error:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to create Razorpay order."
    });
  }
});

// STEP 2: POST /api/verify-payment
app.post('/api/verify-payment', (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: "Missing required payment verification fields."
      });
    }

    // Generate expected HMAC-SHA256 signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', KEY_SECRET)
      .update(text)
      .digest('hex');

    // Safe timing-safe comparison
    const isAuthentic = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(razorpay_signature)
    );

    if (isAuthentic) {
      console.log(`✅ Payment verified successfully for Order ${razorpay_order_id}`);
      return res.status(200).json({
        success: true,
        message: "Payment verified successfully."
      });
    } else {
      console.warn(`❌ Signature mismatch for Order ${razorpay_order_id}`);
      return res.status(400).json({
        success: false,
        error: "Invalid payment signature. Payment verification failed."
      });
    }
  } catch (err) {
    console.error("Payment verification error:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error during payment verification."
    });
  }
});

// Fallback to index.html for Single Page / routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`🌿 Green Garden server running at http://localhost:${PORT}`);
  console.log(`💳 Razorpay endpoints active: /api/create-order and /api/verify-payment`);
});
