/**
 * Simple Node.js API Server for OTP functionality
 * No external dependencies required - uses only built-in Node.js modules
 */

const http = require('http');
const url = require('url');
const crypto = require('crypto');

const PORT = 3001;

// Store OTPs in memory
const otpStore = new Map();

// Helper functions
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateVerificationId() {
  return crypto.randomBytes(16).toString('hex');
}

function parsePostData(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Request handler
const server = http.createServer(async (req, res) => {
  // Enable CORS
  setCORSHeaders(res);

  // Log all incoming requests
  console.log(`📥 ${req.method} ${req.url} from ${req.headers.origin || 'unknown'}`);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;

  // Route handling
  if (req.method === 'POST' && path === '/api/auth/send-otp') {
    try {
      const data = await parsePostData(req);
      const { mobile } = data;

      if (!mobile) {
        return sendJSON(res, 400, {
          success: false,
          message: 'Mobile number is required'
        });
      }

      const otp = generateOTP();
      const verificationId = generateVerificationId();
      
      otpStore.set(verificationId, {
        mobile,
        otp,
        createdAt: Date.now(),
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
        attempts: 0
      });

      console.log(`🔐 OTP Generated for ${mobile}: ${otp} (Verification ID: ${verificationId})`);
      console.log(`📱 Use this OTP for testing: ${otp}`);

      sendJSON(res, 200, {
        success: true,
        message: 'OTP sent successfully',
        verificationId
      });

    } catch (error) {
      console.error('❌ Send OTP error:', error);
      sendJSON(res, 500, {
        success: false,
        message: 'Failed to send OTP'
      });
    }
  }

  else if (req.method === 'POST' && path === '/api/auth/verify-otp') {
    try {
      const data = await parsePostData(req);
      const { verificationId, otp } = data;

      console.log(`🔍 OTP Verification Request:`, {
        verificationId,
        otp,
        storedIds: Array.from(otpStore.keys())
      });

      if (!verificationId || !otp) {
        console.log(`❌ Missing verificationId or otp`);
        return sendJSON(res, 400, {
          success: false,
          message: 'Verification ID and OTP are required'
        });
      }

      const storedData = otpStore.get(verificationId);
      
      console.log(`🔍 Stored data for verificationId ${verificationId}:`, storedData);
      
      if (!storedData) {
        console.log(`❌ No stored data found for verificationId: ${verificationId}`);
        return sendJSON(res, 400, {
          success: false,
          message: 'Invalid or expired verification ID'
        });
      }

      if (Date.now() > storedData.expiresAt) {
        console.log(`❌ OTP expired for verificationId: ${verificationId}`);
        otpStore.delete(verificationId);
        return sendJSON(res, 400, {
          success: false,
          message: 'OTP has expired'
        });
      }

      if (storedData.attempts >= 3) {
        console.log(`❌ Max attempts reached for verificationId: ${verificationId}`);
        otpStore.delete(verificationId);
        return sendJSON(res, 400, {
          success: false,
          message: 'Maximum OTP attempts reached'
        });
      }

      if (storedData.otp !== otp) {
        storedData.attempts++;
        console.log(`❌ Invalid OTP. Expected: ${storedData.otp}, Got: ${otp}, Attempts: ${storedData.attempts}`);
        return sendJSON(res, 400, {
          success: false,
          message: 'Invalid OTP'
        });
      }

      const token = crypto.randomBytes(32).toString('hex');
      otpStore.delete(verificationId);

      console.log(`✅ OTP verified for ${storedData.mobile}`);

      sendJSON(res, 200, {
        success: true,
        message: 'OTP verified successfully',
        token,
        mobile: storedData.mobile,
        expiresIn: 3600
      });

    } catch (error) {
      console.error('❌ Verify OTP error:', error);
      sendJSON(res, 500, {
        success: false,
        message: 'Failed to verify OTP'
      });
    }
  }

  else if (req.method === 'POST' && path === '/api/license/activate') {
    try {
      const data = await parsePostData(req);
      const { mobile, licenseKey, machineID, deviceInfo, email, customerName, businessName } = data;

      console.log(`🔑 License activation request:`, {
        mobile,
        licenseKey,
        machineID,
        email,
        customerName,
        businessName
      });

      if (!mobile || !licenseKey || !machineID) {
        return sendJSON(res, 400, {
          success: false,
          message: 'Mobile, license key, and machine ID are required'
        });
      }

      if (!licenseKey.startsWith('INVPRO')) {
        return sendJSON(res, 400, {
          success: false,
          message: 'Invalid license key format'
        });
      }

      console.log(`✅ License activated for ${mobile} with key ${licenseKey}`);

      sendJSON(res, 200, {
        success: true,
        message: 'License activated successfully',
        mobile,
        licenseKey
      });

    } catch (error) {
      console.error('❌ License activation error:', error);
      sendJSON(res, 500, {
        success: false,
        message: 'Failed to activate license'
      });
    }
  }

  else if (req.method === 'GET' && path === '/api/health') {
    sendJSON(res, 200, {
      status: 'OK',
      timestamp: new Date().toISOString(),
      endpoints: [
        'POST /api/auth/send-otp',
        'POST /api/auth/verify-otp', 
        'POST /api/license/activate'
      ]
    });
  }

  else {
    sendJSON(res, 404, {
      success: false,
      message: 'Endpoint not found'
    });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
  console.log(`\n📋 Available endpoints:`);
  console.log(`   POST /api/auth/send-otp`);
  console.log(`   POST /api/auth/verify-otp`);
  console.log(`   POST /api/license/activate`);
  console.log(`   GET  /api/health`);
  console.log(`\n🔧 Testing OTP functionality:`);
  console.log(`   1. Send OTP to mobile number`);
  console.log(`   2. Check console for generated OTP`);
  console.log(`   3. Use OTP to verify and activate license`);
  console.log(`\n🌐 CORS enabled for all origins`);
});

module.exports = server;
