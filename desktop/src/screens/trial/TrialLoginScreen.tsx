import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { APP_DISPLAY_NAME } from '../../constants/appBranding';
import { detectLocation } from '../../services/locationService';
import { getDeviceInfo } from '../../services/deviceFingerprint';
import { getActiveCompanyId } from '../../utils/companyStorage';
import {
  resetFirebasePhoneOtpSession,
  sendFirebasePhoneOtp,
  verifyFirebasePhoneOtp,
} from '../../services/firebasePhoneAuthService';
import {
  checkTrialByMobile,
  createTrialRecord,
  maskMobile,
  validateTrialRemote,
} from '../../services/trialService';
import { buildTrialCache, completeTrialAppLogin } from '../../services/trialSession';
import { useAuth } from '../../pages/contexts/auth';
import TrialExpiredScreen from './TrialExpiredScreen';
import Logo from '../../components/Logo';

type Step = 'mobile' | 'otp' | 'success';

function normalizeMobile(raw: string): string {
  return raw.replace(/\D/g, '').slice(-10);
}

export default function TrialLoginScreen() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState<Step>('mobile');
  const [mobile, setMobile] = useState('');
  const [pincode, setPincode] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState<{
    reason: 'EXPIRED' | 'DEVICE_BLOCKED' | 'MOBILE_BLOCKED';
    endDate?: number;
  } | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [successMeta, setSuccessMeta] = useState({ endLabel: '', locationLabel: '' });
  const [resendSec, setResendSec] = useState(30);
  const locationRef = useRef<Awaited<ReturnType<typeof detectLocation>> | null>(null);
  const deviceRef = useRef<Awaited<ReturnType<typeof getDeviceInfo>> | null>(null);
  const verifyingRef = useRef(false);

  useEffect(() => {
    return () => {
      resetFirebasePhoneOtpSession();
    };
  }, []);

  useEffect(() => {
    void detectLocation().then((loc) => {
      locationRef.current = loc;
    });
    void getDeviceInfo().then((d) => {
      deviceRef.current = d;
    });
  }, []);

  useEffect(() => {
    if (step !== 'otp' || resendSec <= 0) return;
    const t = window.setInterval(() => setResendSec((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [step, resendSec]);

  const finishTrial = useCallback(
    async (cache: ReturnType<typeof buildTrialCache>) => {
      await completeTrialAppLogin(login, cache);
      navigate('/select-company', { replace: true });
    },
    [login, navigate]
  );

  const handleSendOtp = async () => {
    setError(null);
    const m = normalizeMobile(mobile);
    if (m.length !== 10) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    try {
      const device = deviceRef.current ?? (await getDeviceInfo());
      deviceRef.current = device;
      const existing = await checkTrialByMobile(m);
      if (existing?.converted_to_paid) {
        setBlocked({ reason: 'MOBILE_BLOCKED' });
        return;
      }
      const remote = await validateTrialRemote(m, device.device_id, {
        device_fingerprint: device.device_fingerprint,
        company_id: getActiveCompanyId(),
      });
      if (remote.status === 'EXPIRED' || remote.status === 'MOBILE_BLOCKED') {
        setBlocked({
          reason: remote.status === 'EXPIRED' ? 'EXPIRED' : 'MOBILE_BLOCKED',
          endDate: remote.trial_end_date?.seconds ? remote.trial_end_date.seconds * 1000 : undefined,
        });
        return;
      }
      if (remote.status === 'DEVICE_BLOCKED') {
        setBlocked({ reason: 'DEVICE_BLOCKED' });
        setError(remote.message || 'A trial has already been used on this device.');
        return;
      }
      if (remote.status === 'COMPANY_BLOCKED') {
        setBlocked({ reason: 'MOBILE_BLOCKED' });
        setError(remote.message || 'An active trial already exists for this company.');
        return;
      }
      if (remote.status === 'VALID' && remote.trial_end_date?.seconds) {
        const cache = buildTrialCache({
          mobile_no: m,
          device_id: device.device_id,
          trial_end_seconds: remote.trial_end_date.seconds,
          days_remaining: remote.days_remaining ?? 1,
          city: existing?.location?.city,
          state: existing?.location?.state,
        });
        await finishTrial(cache);
        return;
      }

      await sendFirebasePhoneOtp(`+91${m}`);
      setOtpSent(true);
      setResendSec(30);
      setStep('otp');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = useCallback(async () => {
    if (!otpSent || otp.trim().length < 6 || verifyingRef.current) return;
    verifyingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const m = normalizeMobile(mobile);
      const verified = await verifyFirebasePhoneOtp(otp.trim());
      const device = deviceRef.current ?? (await getDeviceInfo());
      const loc = locationRef.current ?? (await detectLocation());
      const remote = await validateTrialRemote(m, device.device_id, {
        device_fingerprint: device.device_fingerprint,
        company_id: getActiveCompanyId(),
      });

      if (remote.status === 'DEVICE_BLOCKED') {
        setBlocked({ reason: 'DEVICE_BLOCKED' });
        setError(remote.message || 'A trial has already been used on this device.');
        return;
      }
      if (remote.status === 'COMPANY_BLOCKED') {
        setBlocked({ reason: 'MOBILE_BLOCKED' });
        setError(remote.message || 'An active trial already exists for this company.');
        return;
      }

      let endSeconds = remote.trial_end_date?.seconds ?? 0;
      let days = remote.days_remaining ?? 7;

      if (remote.status === 'NEW_USER') {
        const created = await createTrialRecord({
          mobile_no: m,
          phone_uid: verified.localId,
          device_id: device.device_id,
          device_fingerprint: device.device_fingerprint,
          device_name: device.device_name,
          os_info: device.os_info,
          company_id: getActiveCompanyId(),
          user_pincode: pincode.trim(),
          location: loc,
        });
        endSeconds = created.end_date?.seconds ?? Math.floor(Date.now() / 1000) + 7 * 86400;
        days = created.days_remaining ?? 7;
      }

      const cache = buildTrialCache({
        mobile_no: m,
        device_id: device.device_id,
        trial_end_seconds: endSeconds,
        days_remaining: days,
        city: loc.city,
        state: loc.state,
        phone_uid: verified.localId,
      });

      setSuccessMeta({
        endLabel: new Date(endSeconds * 1000).toLocaleDateString(),
        locationLabel: [loc.city, loc.state].filter(Boolean).join(', ') || 'India',
      });
      setStep('success');
      window.setTimeout(() => void finishTrial(cache), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'OTP verification failed');
    } finally {
      verifyingRef.current = false;
      setLoading(false);
    }
  }, [otpSent, otp, mobile, pincode, finishTrial]);

  useEffect(() => {
    if (step === 'otp' && otp.length === 6) void handleVerifyOtp();
  }, [otp, step, handleVerifyOtp]);

  if (blocked) {
    return (
      <TrialExpiredScreen
        reason={blocked.reason}
        mobileNo={normalizeMobile(mobile)}
        endDate={blocked.endDate ?? null}
      />
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', py: 4 }}>
      <Container maxWidth="sm">
        <Paper sx={{ p: 3, borderRadius: 2 }}>
          <Stack spacing={2} alignItems="center">
            <Logo />
            <Typography variant="h5" fontWeight={800}>
              {APP_DISPLAY_NAME}
            </Typography>
            {step === 'mobile' && (
              <>
                <Typography color="text.secondary">Start Your Free Trial — 7 Days • All Features</Typography>
                <TextField
                  label="Mobile Number"
                  fullWidth
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="10-digit number"
                />
                <TextField
                  label="Pincode (optional)"
                  fullWidth
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                />
                <Button fullWidth variant="contained" disabled={loading} onClick={() => void handleSendOtp()}>
                  {loading ? <CircularProgress size={22} /> : 'Send OTP →'}
                </Button>
              </>
            )}
            {step === 'otp' && (
              <>
                <Typography fontWeight={600}>Verify Your Number</Typography>
                <Typography variant="body2">OTP sent to +91 {maskMobile(mobile)}</Typography>
                <TextField
                  label="6-digit OTP"
                  fullWidth
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                <Button
                  fullWidth
                  variant="contained"
                  disabled={loading || otp.length < 6}
                  onClick={() => void handleVerifyOtp()}
                >
                  Verify OTP ✓
                </Button>
                <Typography variant="caption">
                  {resendSec > 0 ? `Resend in 0:${String(resendSec).padStart(2, '0')}` : 'You can resend OTP'}
                </Typography>
                {resendSec <= 0 ? (
                  <Button size="small" disabled={loading} onClick={() => void handleSendOtp()}>
                    Resend OTP
                  </Button>
                ) : null}
                <Button
                  size="small"
                  onClick={() => {
                    resetFirebasePhoneOtpSession();
                    setStep('mobile');
                    setOtp('');
                    setOtpSent(false);
                  }}
                >
                  Change Number
                </Button>
              </>
            )}
            {step === 'success' && (
              <>
                <Typography variant="h6" fontWeight={800}>
                  🎉 Trial Started!
                </Typography>
                <Typography>Trial ends: {successMeta.endLabel}</Typography>
                <Typography variant="body2">Location: {successMeta.locationLabel}</Typography>
                <Button fullWidth variant="contained" onClick={() => navigate('/select-company')}>
                  Start Using App →
                </Button>
              </>
            )}
            {error ? <Alert severity="error">{error}</Alert> : null}
            <Button component={RouterLink} to="/login" size="small">
              ← Back to Login
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
