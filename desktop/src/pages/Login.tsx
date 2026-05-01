import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Avatar,
  Grid,
  Divider,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import {
  Business as BusinessIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  DevicesOther as DevicesIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./contexts/auth";
import { getDeviceId } from "../services/deviceService";
import {
  getLicenseKeyFromUserProfile,
  checkDeviceTransfer,
  surrenderOldDevice,
  verifyActivationKey,
  validateOnLoginOrStart,
} from "../services/licenseService";
import { bindCurrentDevice } from "../services/deviceChangeDetector";
import { setEncryptedItem } from "../services/secureStorage";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { resetUserPassword, sendPasswordResetEmail } from "../services/passwordResetService";
import { APP_DISPLAY_NAME, APP_TAGLINE } from "../constants/appBranding";

const LOCAL_LICENSE_CACHE_KEY = "enc_license_cache_v1";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Password reset state
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  // Device transfer state
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferData, setTransferData] = useState<{
    email: string;
    password: string;
    activationKey: string;
    oldDeviceId: string;
    newDeviceId: string;
    oldDeviceInfo?: any;
  } | null>(null);

  useEffect(() => {
    const lastEmail = localStorage.getItem("lastLoginEmail");
    if (lastEmail) setEmail(lastEmail);

    const lastErr = localStorage.getItem("lastAuthError");
    if (lastErr) {
      setError(lastErr);
      localStorage.removeItem("lastAuthError");
    }

    const gateMsg = localStorage.getItem("license_gate_message");
    if (gateMsg) {
      setError(gateMsg);
      localStorage.removeItem("license_gate_message");
    }
  }, []);

  const handleOpenResetDialog = () => {
    setResetDialogOpen(true);
    setResetEmail(email || "");
    setResetMessage(null);
    setResetError(null);
    setTempPassword(null);
  };

  const handleCloseResetDialog = () => {
    if (resetLoading) return;
    setResetDialogOpen(false);
  };

  const handlePasswordReset = async () => {
    const targetEmail = resetEmail.trim();
    if (!targetEmail) {
      setResetError("Please enter your registered email address.");
      return;
    }

    try {
      setResetLoading(true);
      setResetError(null);
      setResetMessage(null);
      setTempPassword(null);

      const result = await resetUserPassword(targetEmail);

      if (!result.success || !result.tempPassword) {
        setResetError(result.reason || "Password reset failed. Please try again.");
        return;
      }

      const emailSent = await sendPasswordResetEmail(targetEmail, result.tempPassword);

      if (!emailSent) {
        setResetError("Password reset email could not be sent. Please contact support.");
        setTempPassword(result.tempPassword);
        return;
      }

      setTempPassword(result.tempPassword);
      setResetMessage(
        "Password reset successful. A temporary password has been generated. " +
          "Use this temporary password to log in, then you can update your password from within the app."
      );
    } catch (err: any) {
      setResetError(err?.message || "Password reset failed. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Please enter email and password");
      return;
    }

    try {
      setLoading(true);
      localStorage.setItem("lastLoginEmail", email.trim());

      const normalizedEmail = email.trim().toLowerCase();

      // Step 1: Firebase Auth first — Firestore rules do not allow listing `licenses` without admin;
      // license key must be read from `users/{email}` after the user is signed in.
      console.log('🔐 Step 1: Signing in with Firebase...');
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
        await userCredential.user.getIdToken(true);
      } catch (authError: any) {
        console.error('❌ Firebase auth error:', authError);
        if (authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
          setError("Invalid password. Please try again.");
        } else if (authError.code === 'auth/user-not-found') {
          setError("User not found. Please activate your account first.");
        } else {
          setError(authError.message || "Authentication failed");
        }
        setLoading(false);
        return;
      }

      console.log('🔐 Step 2: Loading license from your profile...');
      const fromProfile = await getLicenseKeyFromUserProfile(normalizedEmail);
      if (!fromProfile) {
        await signOut(auth).catch(() => undefined);
        setError("No license linked to this account. Please complete activation on this email first.");
        setLoading(false);
        return;
      }

      const activationKey = fromProfile.licenseKey;
      console.log('✅ License key from profile');

      console.log('🔐 Step 3: Verifying license in Firestore...');
      const verifyResult = await verifyActivationKey(activationKey, normalizedEmail);

      if (verifyResult.status === 'not_found') {
        await signOut(auth).catch(() => undefined);
        setError("License key not found");
        setLoading(false);
        return;
      }

      if (verifyResult.status === 'not_activated') {
        await signOut(auth).catch(() => undefined);
        setError(verifyResult.reason || "License is not active");
        setLoading(false);
        return;
      }

      if (verifyResult.status === 'error') {
        await signOut(auth).catch(() => undefined);
        setError(verifyResult.reason || "Error verifying license");
        setLoading(false);
        return;
      }

      console.log('✅ License verified');

      console.log('🔐 Step 4: Checking device transfer...');
      const currentDeviceId = await getDeviceId();

      const transferCheck = await checkDeviceTransfer(activationKey, normalizedEmail, currentDeviceId);

      if (transferCheck.needsTransfer) {
        console.log('⚠️ Device transfer needed');
        setTransferData({
          email: normalizedEmail,
          password: password,
          activationKey,
          oldDeviceId: transferCheck.oldDeviceInfo?.deviceId || '',
          newDeviceId: currentDeviceId,
          oldDeviceInfo: transferCheck.oldDeviceInfo,
        });
        setShowTransferDialog(true);
        setLoading(false);
        return;
      }

      console.log('✅ No device transfer needed');

      const licName = String(fromProfile.profile?.name ?? verifyResult.licenseData?.name ?? "").trim();
      const fbName = String(userCredential.user.displayName ?? "").trim();
      const emailLocal = normalizedEmail.split("@")[0] || "";
      const prettyLocal =
        emailLocal.length > 0 ? emailLocal.charAt(0).toUpperCase() + emailLocal.slice(1) : "";
      const resolvedName = licName || fbName || prettyLocal || normalizedEmail;

      let gate: Awaited<ReturnType<typeof validateOnLoginOrStart>>;
      try {
        gate = await validateOnLoginOrStart();
      } catch (e: any) {
        await signOut(auth).catch(() => undefined);
        setError(e?.message || 'License check failed. Try again.');
        setLoading(false);
        return;
      }
      if (!gate.ok) {
        await signOut(auth).catch(() => undefined);
        setError(String((gate as { reason?: string }).reason || 'Could not validate license on this device.'));
        setLoading(false);
        return;
      }
      await bindCurrentDevice(normalizedEmail);

      await login('local', {
        id: userCredential.user.uid,
        username: normalizedEmail,
        email: normalizedEmail,
        fullName: resolvedName,
        role: 'admin',
        companyId: '',
        company: null,
        completedBusinessProfile: Boolean(fromProfile.profile?.completedBusinessProfile),
      });

      console.log('✅ Login successful - redirecting to dashboard');
      navigate("/dashboard", { replace: true });

    } catch (err: any) {
      console.error('❌ Login error:', err);
      const errorMessage = err?.message || "Login failed";
      setError(errorMessage);
      localStorage.setItem("lastAuthError", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceTransfer = async () => {
    if (!transferData) return;

    try {
      setLoading(true);
      setShowTransferDialog(false);

      console.log('🔄 Starting device transfer...');
      console.log('From device:', transferData.oldDeviceId);
      console.log('To device:', transferData.newDeviceId);

      // transferLicense requires an authenticated Firebase user (callable security).
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(
          auth,
          transferData.email,
          transferData.password
        );
        await userCredential.user.getIdToken(true);
      } catch (authError: any) {
        console.error('❌ Firebase auth error before transfer:', authError);
        setError(authError?.code === 'auth/wrong-password' ? 'Invalid password.' : 'Sign-in failed. Try again.');
        return;
      }

      const result = await surrenderOldDevice(
        transferData.activationKey,
        transferData.email,
        transferData.oldDeviceId,
        transferData.newDeviceId
      );

      if (!result.success) {
        setError(result.reason || "Device transfer failed");
        return;
      }

      console.log('✅ Device transfer successful (server)');

      const token = await userCredential.user.getIdToken();
      const tEmailNorm = transferData.email.trim().toLowerCase();
      await setEncryptedItem(LOCAL_LICENSE_CACHE_KEY, transferData.newDeviceId, {
        uid: userCredential.user.uid,
        email: tEmailNorm,
        token,
        licenseKey: transferData.activationKey.trim().toUpperCase(),
        licenseExpiry: result.expiryDateMs ?? null,
        cachedAt: Date.now(),
      });
      await bindCurrentDevice(tEmailNorm);

      const tEmail = transferData.email.trim();
      const tFb = String(userCredential.user.displayName ?? "").trim();
      const tLocal = tEmail.split("@")[0] || "";
      const tPretty =
        tLocal.length > 0 ? tLocal.charAt(0).toUpperCase() + tLocal.slice(1) : "";

      await login('local', {
        id: userCredential.user.uid,
        username: tEmail,
        email: tEmail,
        fullName: tFb || tPretty || tEmail,
        role: 'admin',
        companyId: '',
        company: null,
        completedBusinessProfile: false
      } as any);

      console.log('✅ Login successful after transfer - redirecting to dashboard');
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      console.error('❌ Device transfer error:', err);
      setError(err?.message || "Device transfer failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelTransfer = () => {
    setShowTransferDialog(false);
    setTransferData(null);
    setError("Device transfer cancelled. Please contact support if you need help.");
  };

  return (
    <Box
      sx={{
        height: "100%",
        minHeight: "100%",
        overflowY: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        "&::-webkit-scrollbar": { display: "none", width: 0, height: 0 },
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={10}
          sx={{
            p: 4,
            borderRadius: 3,
            background: "rgba(255, 255, 255, 0.98)",
            backdropFilter: "blur(10px)",
            color: "#1f2937",
          }}
        >
          <Box textAlign="center" mb={3}>
            <Avatar
              sx={{ width: 80, height: 80, bgcolor: "primary.main", mx: "auto", mb: 2 }}
            >
              <BusinessIcon sx={{ fontSize: 40 }} />
            </Avatar>
            <Typography variant="h4" fontWeight="bold" color="primary">
              {APP_DISPLAY_NAME}
            </Typography>
            <Typography variant="h6" color="text.secondary">
              {APP_TAGLINE}
            </Typography>
            <Typography variant="body2" color="text.primary" mt={1}>
              Sign in with your email and password
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleLogin}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  InputProps={{
                    startAdornment: <EmailIcon sx={{ mr: 1, color: "action.active" }} />,
                  }}
                  sx={{
                    "& .MuiInputLabel-root": { color: "#374151" },
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "#ffffff",
                      color: "#111827",
                      "& input": { color: "#111827" },
                      "& fieldset": { borderColor: "#94a3b8" },
                      "&:hover fieldset": { borderColor: "#475569" },
                      "&.Mui-focused fieldset": { borderColor: "#1d4ed8", borderWidth: 2 },
                    },
                  }}
                  required
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  InputProps={{
                    startAdornment: <LockIcon sx={{ mr: 1, color: "action.active" }} />,
                  }}
                  sx={{
                    "& .MuiInputLabel-root": { color: "#374151" },
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "#ffffff",
                      color: "#111827",
                      "& input": { color: "#111827" },
                      "& fieldset": { borderColor: "#94a3b8" },
                      "&:hover fieldset": { borderColor: "#475569" },
                      "&.Mui-focused fieldset": { borderColor: "#1d4ed8", borderWidth: 2 },
                    },
                  }}
                  required
                />
              </Grid>
            </Grid>

            <Box mt={1.5}>
              <Link
                component="button"
                type="button"
                underline="hover"
                onClick={handleOpenResetDialog}
                sx={{ fontSize: "0.875rem", color: "#1d4ed8", fontWeight: 600 }}
              >
                Forgot password?
              </Link>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mt: 2.5, py: 1.5, fontSize: "1.05rem", borderRadius: 2 }}
            >
              {loading ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>

            <Divider sx={{ my: 2 }} />

            <Box textAlign="center">
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                New user or have a licence key?
              </Typography>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => navigate("/activate")}
                sx={{ borderColor: "#64748b", color: "#0f172a", fontWeight: 600 }}
              >
                Activate licence
              </Button>
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Box textAlign="center">
            <Typography variant="body2" color="text.secondary" mb={1}>
              Need help?
            </Typography>
            <Link href="mailto:pve.2020@hotmail.com" variant="body2" sx={{ color: "#1d4ed8", fontWeight: 600 }}>
              Contact Support
            </Link>
            <Typography variant="caption" display="block" sx={{ mt: 1, color: "text.secondary" }}>
              For updates and customizations: pve.2020@hotmail.com
              <br />
              Minimum customization charge: ₹6,000.00
            </Typography>
          </Box>
        </Paper>
      </Container>

      {/* Device Transfer Dialog */}
      <Dialog 
        open={showTransferDialog} 
        onClose={handleCancelTransfer}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DevicesIcon color="warning" />
          License Active on Another Device
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Your license <strong>{transferData?.activationKey}</strong> is already activated on another device.
          </DialogContentText>
          
          {transferData?.oldDeviceInfo && (
            <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1, mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Current Device:</strong>
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                {transferData.oldDeviceId.substring(0, 20)}...
              </Typography>
              {transferData.oldDeviceInfo.lastSeen && (
                <Typography variant="caption" color="text.secondary">
                  Last seen: {new Date(transferData.oldDeviceInfo.lastSeen?.toDate?.() || transferData.oldDeviceInfo.lastSeen).toLocaleString()}
                </Typography>
              )}
            </Box>
          )}

          <DialogContentText>
            Do you want to transfer your license to this device?
          </DialogContentText>

          <Alert severity="warning" sx={{ mt: 2 }}>
            <strong>Warning:</strong> This will deactivate the license on your previous device. 
            You'll need to activate again if you want to use that device.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCancelTransfer} color="inherit">
            Cancel
          </Button>
          <Button 
            onClick={handleDeviceTransfer} 
            variant="contained" 
            color="primary"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <DevicesIcon />}
          >
            {loading ? "Transferring..." : "Transfer to This Device"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog
        open={resetDialogOpen}
        onClose={handleCloseResetDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reset Password</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Enter your registered email address. A temporary password will be generated for your account.
          </DialogContentText>

          <TextField
            fullWidth
            label="Registered Email Address"
            type="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            margin="dense"
          />

          {resetError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {resetError}
            </Alert>
          )}

          {resetMessage && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {resetMessage}
              {tempPassword && (
                <>
                  <br />
                  <strong>Temporary password:</strong> {tempPassword}
                </>
              )}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseResetDialog} disabled={resetLoading}>
            Close
          </Button>
          <Button
            onClick={handlePasswordReset}
            variant="contained"
            disabled={resetLoading}
          >
            {resetLoading ? (
              <>
                <CircularProgress size={18} sx={{ mr: 1 }} />
                Resetting...
              </>
            ) : (
              "Reset Password"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Login;