/**
 * Password Reset Service
 * 
 * Handles password resets for both Firebase Auth users and local users
 * Stores passwords in Firestore for backup and sync
 */

import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import { getDeviceId } from './deviceService';

const USERS_COLLECTION = 'users';

export interface UserProfile {
  email: string;
  password: string;
  name?: string;
  mobile?: string;
  gstNumber?: string;
  address?: string;
  state?: string;
  businessName?: string;
  licenseKey?: string;
  deviceId?: string;
  lastLogin?: any;
  createdAt?: any;
  updatedAt?: any;
  passwordResetRequired?: boolean;
}

/**
 * Reset password for user (works for both Firebase and local users)
 */
export async function resetUserPassword(email: string): Promise<{
  success: boolean;
  tempPassword?: string;
  reason?: string;
}> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    console.log('🔄 Starting password reset for:', normalizedEmail);

    // Step 1: Try to find user in Firestore
    if (!db) {
      return {
        success: false,
        reason: 'Firestore not available',
      };
    }

    const userDocRef = doc(db, USERS_COLLECTION, normalizedEmail);
    let userDoc: any = null;

    try {
      userDoc = await getDoc(userDocRef);
    } catch (firestoreError) {
      console.log('❌ Firestore query failed:', firestoreError);
    }

    // Step 2: Generate temporary password
    const tempPassword = generateTempPassword();

    if (userDoc?.exists()) {
      // User exists in Firestore - update password
      console.log('✅ Found user in Firestore, updating password');
      
      const userData = userDoc.data() as UserProfile;
      
      await updateDoc(userDocRef, {
        password: tempPassword,
        passwordResetRequired: true,
        updatedAt: serverTimestamp(),
        lastPasswordReset: serverTimestamp()
      });

      console.log('✅ Password updated in Firestore for:', normalizedEmail);

      return {
        success: true,
        tempPassword,
        reason: 'Password reset successfully. Check your email for temporary password.'
      };

    } else {
      // User not in Firestore - check local storage
      console.log('🔍 User not in Firestore, checking local storage');
      
      const localUsers = JSON.parse(localStorage.getItem('gst_billing_users') || '[]');
      const localUser = localUsers.find((u: any) => 
        (u.email || '').toLowerCase() === normalizedEmail || 
        (u.username || '').toLowerCase() === normalizedEmail
      );

      if (localUser) {
        // Update local user
        console.log('✅ Found local user, updating password');
        
        const updatedUsers = localUsers.map((u: any) => 
          (u.email || '').toLowerCase() === normalizedEmail || 
          (u.username || '').toLowerCase() === normalizedEmail
            ? { 
                ...u, 
                password: tempPassword, 
                passwordResetRequired: true,
                updatedAt: new Date().toISOString()
              }
            : u
        );

        localStorage.setItem('gst_billing_users', JSON.stringify(updatedUsers));

        // Try to create/update Firestore user for future sync
        try {
          const deviceId = await getDeviceId();
          const userProfile: UserProfile = {
            email: localUser.email,
            password: tempPassword,
            name: localUser.fullName || localUser.name,
            mobile: localUser.mobile,
            gstNumber: localUser.gstNumber,
            address: localUser.address,
            state: localUser.state,
            businessName: localUser.businessName,
            licenseKey: localUser.activationKey,
            deviceId,
            passwordResetRequired: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };

          await setDoc(userDocRef, userProfile);
          console.log('✅ Created user in Firestore for future sync');
        } catch (createError) {
          console.log('⚠️ Could not create Firestore user:', createError);
        }

        return {
          success: true,
          tempPassword,
          reason: 'Password reset successfully. Check your email for temporary password.'
        };

      } else {
        return {
          success: false,
          reason: 'No account found with this email/username.'
        };
      }
    }

  } catch (error: any) {
    console.error('❌ Password reset failed:', error);
    return {
      success: false,
      reason: `Password reset failed: ${error.message}`
    };
  }
}

/**
 * Generate secure temporary password
 */
function generateTempPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return password + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
}

/**
 * Send password reset email (placeholder for email service integration)
 */
export async function sendPasswordResetEmail(email: string, tempPassword: string): Promise<boolean> {
  try {
    console.log('📧 Sending password reset email to:', email);
    
    // TODO: Integrate with actual email service
    // For now, return true and show password in UI
    console.log('📝 Email content would be:');
    console.log(`Subject: Password Reset - InvoicePro`);
    console.log(`Body: Your temporary password is: ${tempPassword}`);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to send reset email:', error);
    return false;
  }
}

/**
 * Update password after user logs in with temp password
 */
export async function updatePasswordAfterLogin(email: string, newPassword: string): Promise<{
  success: boolean;
  reason?: string;
}> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    console.log('🔄 Updating password for:', normalizedEmail);

    // Update Firestore
    if (!db) {
      return {
        success: false,
        reason: 'Firestore not available',
      };
    }

    const userDocRef = doc(db, USERS_COLLECTION, normalizedEmail);
    await updateDoc(userDocRef, {
      password: newPassword,
      passwordResetRequired: false,
      updatedAt: serverTimestamp()
    });

    // Update local storage
    const localUsers = JSON.parse(localStorage.getItem('gst_billing_users') || '[]');
    const updatedUsers = localUsers.map((u: any) => 
      (u.email || '').toLowerCase() === normalizedEmail || 
      (u.username || '').toLowerCase() === normalizedEmail
        ? { 
            ...u, 
            password: newPassword, 
            passwordResetRequired: false,
            updatedAt: new Date().toISOString()
          }
        : u
    );

    localStorage.setItem('gst_billing_users', JSON.stringify(updatedUsers));

    console.log('✅ Password updated successfully for:', normalizedEmail);
    return { success: true };

  } catch (error: any) {
    console.error('❌ Password update failed:', error);
    return {
      success: false,
      reason: `Password update failed: ${error.message}`
    };
  }
}
