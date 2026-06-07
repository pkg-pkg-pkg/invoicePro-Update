import type { Timestamp } from 'firebase/firestore';

export type LicenseDoc = {
  licenseKey: string;
  assignedToEmail?: string;
  isActive?: boolean;
  currentDeviceId?: string;
  createdAt?: Timestamp;
  activatedAt?: Timestamp;
  reactivatedAt?: Timestamp;
  surrenderedAt?: Timestamp;
  expiryDate?: Timestamp | null;
  renewalAmount?: number;
  isPremium?: boolean;
  premiumExpiry?: Timestamp | null;
  premiumAmount?: number;
  notes?: string;
  maxDevices?: number;
  /** Granted after paid LAN upgrade + admin UTR approval (Cloud Function). */
  multiUserLan?: boolean;
  /** Updates + new features entitlement (subscription gateway); license key itself may remain lifetime. */
  gatewayValidUntil?: Timestamp | null;
};

export type UserProfileDoc = {
  name: string;
  fullName?: string;
  electricianName?: string;
  businessName: string;
  email: string;
  mobile: string;

  licenseKey: string;
  deviceId: string;
  completedBusinessProfile: boolean;
  address: string;
  state: string;
  gstNumber?: string;

  licenseExpiry?: Timestamp | null;

  createdAt: Timestamp;
  lastLogin: Timestamp | null;
  lastActiveAt?: Timestamp | null;
  lastAppOpenAt?: Timestamp | null;
  lastSessionEndedAt?: Timestamp | null;
  lastSessionDurationMinutes?: number;
  totalUsageMinutes?: number;
  liveSessionMinutes?: number;
  sessionCount?: number;
  usagePlatform?: string;
  appVersion?: string;
};
