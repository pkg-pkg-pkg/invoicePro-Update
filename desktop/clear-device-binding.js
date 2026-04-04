// Temporary script to clear device binding for testing
// Run this in Firebase Console → Functions → Test Functions

const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

async function clearDeviceBinding() {
  const db = getFirestore();
  const email = 'pawanipm@gmail.com';
  
  try {
    // Clear the device binding to allow re-activation
    const userRef = db.collection('users').doc(email.replace(/[.@]/g, '_'));
    await userRef.update({
      deviceId: '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Device binding cleared for:', email);
    console.log('Now you can reactivate the license on this device');
    
  } catch (error) {
    console.error('❌ Error clearing device binding:', error);
  }
}

// For Firebase Console - copy this function:
exports.clearDeviceBinding = clearDeviceBinding;
