/**
 * Simple API Server for OTP and License Activation
 * This server handles the OTP endpoints that the frontend is trying to call
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = 3001;

// Store OTPs in memory (in production, use Redis or database)
const otpStore = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Helper functions
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateVerificationId() {
  return crypto.randomBytes(16).toString('hex');
}

// Routes
app.post('/api/auth/send-otp', (req, res) => {
  try {
    const { mobile } = req.body;
    
    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is required'
      });
    }

    // Generate OTP and verification ID
    const otp = generateOTP();
    const verificationId = generateVerificationId();
    
    // Store OTP with expiry (5 minutes)
    otpStore.set(verificationId, {
      mobile,
      otp,
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      attempts: 0
    });

    console.log(`🔐 OTP Generated for ${mobile}: ${otp} (Verification ID: ${verificationId})`);

    // In a real implementation, send OTP via SMS service
    // For now, we'll log it to console for testing
    console.log(`📱 OTP for ${mobile}: ${otp}`);

    res.json({
      success: true,
      message: 'OTP sent successfully',
      verificationId
    });

  } catch (error) {
    console.error('❌ Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP'
    });
  }
});

app.post('/api/auth/verify-otp', (req, res) => {
  try {
    const { verificationId, otp } = req.body;
    
    if (!verificationId || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Verification ID and OTP are required'
      });
    }

    const storedData = otpStore.get(verificationId);
    
    if (!storedData) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification ID'
      });
    }

    // Check if OTP is expired
    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(verificationId);
      return res.status(400).json({
        success: false,
        message: 'OTP has expired'
      });
    }

    // Check attempts
    if (storedData.attempts >= 3) {
      otpStore.delete(verificationId);
      return res.status(400).json({
        success: false,
        message: 'Maximum OTP attempts reached'
      });
    }

    // Verify OTP
    if (storedData.otp !== otp) {
      storedData.attempts++;
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // OTP is correct - generate token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Clean up OTP
    otpStore.delete(verificationId);

    console.log(`✅ OTP verified for ${storedData.mobile}`);

    res.json({
      success: true,
      message: 'OTP verified successfully',
      token,
      mobile: storedData.mobile,
      expiresIn: 3600 // 1 hour
    });

  } catch (error) {
    console.error('❌ Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP'
    });
  }
});

app.post('/api/license/activate', (req, res) => {
  try {
    const { mobile, licenseKey, machineID, deviceInfo, email, customerName, businessName } = req.body;
    
    console.log(`🔑 License activation request:`, {
      mobile,
      licenseKey,
      machineID,
      email,
      customerName,
      businessName
    });

    // Basic validation
    if (!mobile || !licenseKey || !machineID) {
      return res.status(400).json({
        success: false,
        message: 'Mobile, license key, and machine ID are required'
      });
    }

    // In a real implementation, validate against database
    // For now, we'll accept any license key that starts with "INVPRO"
    if (!licenseKey.startsWith('INVPRO')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid license key format'
      });
    }

    console.log(`✅ License activated for ${mobile} with key ${licenseKey}`);

    res.json({
      success: true,
      message: 'License activated successfully',
      mobile,
      licenseKey
    });

  } catch (error) {
    console.error('❌ License activation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate license'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/auth/send-otp',
      'POST /api/auth/verify-otp', 
      'POST /api/license/activate'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   POST /api/auth/send-otp`);
  console.log(`   POST /api/auth/verify-otp`);
  console.log(`   POST /api/license/activate`);
  console.log(`   GET  /api/health`);
  console.log(`\n🔧 Testing OTP functionality:`);
  console.log(`   1. Send OTP to mobile number`);
  console.log(`   2. Check console for generated OTP`);
  console.log(`   3. Use OTP to verify and activate license`);
});

module.exports = app;
