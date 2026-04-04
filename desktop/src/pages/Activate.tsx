import React, { useState } from "react";
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
} from "@mui/material";
import {
  Business as BusinessIcon,
  Phone as PhoneIcon,
  VpnKey as VpnKeyIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./contexts/auth";
import { activateAccountWithLicense } from "../services/licenseService";

const Activate: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [licenseKey, setLicenseKey] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const goToLogin = () => {
    try {
      logout();
    } finally {
      // Electron + file://: navigate() alone often fails after direct hash writes elsewhere — force hash
      window.location.hash = '#/login';
    }
  };

  /* ---------------------------------- */
  /*  License-based Activation          */
  /* ---------------------------------- */
  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!businessName.trim()) {
      setError("Enter your business name.");
      return;
    }
    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }
    if (!mobile.trim()) {
      setError("Enter your mobile number.");
      return;
    }
    if (!password.trim()) {
      setError("Enter a password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!licenseKey.trim()) {
      setError("Enter license key.");
      return;
    }

    try {
      setLoading(true);
      const result = await activateAccountWithLicense({
        name,
        businessName,
        email,
        mobile,
        password,
        licenseKey,
      });

      if (!result.ok) {
        if (result.type === 'DEVICE_ALREADY_BOUND') {
          setError(
            'This license is already active on another PC. Open Login on this computer with the same email and password — you will be asked to move the license here (old device is released on the server).'
          );
        } else if (result.type === 'NO_LICENSE') {
          setError("Invalid license key. Please check your license key and try again.");
        } else {
          setError(result.reason || "Activation failed. Please try again.");
        }
        return;
      }

      setSuccessMessage("License activated successfully. Redirecting to dashboard...");
      // Give a short delay for user to read the message, then navigate.
      setTimeout(() => {
        navigate("/dashboard");
      }, 1200);
    } catch (err: any) {
      console.error("Activation error:", err);
      setError(err?.message || "Activation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
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
            background: "rgba(255,255,255,0.95)",
          }}
        >
          <Box textAlign="center" mb={3}>
            <Avatar
              sx={{ width: 80, height: 80, bgcolor: "primary.main", mx: "auto", mb: 2 }}
            >
              <BusinessIcon sx={{ fontSize: 40 }} />
            </Avatar>
            <Typography variant="h4" fontWeight="bold" color="primary">
              InvoicePro
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Activate your licence (new install or new account)
            </Typography>
            <Button variant="outlined" size="small" sx={{ mt: 2 }} onClick={goToLogin} type="button">
              Back to Login
            </Button>
          </Box>

          {/* Step 1: Account & Contact */}
          <Typography variant="subtitle1" gutterBottom>
            Step 1: Account & Contact
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Business Name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Mobile Number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                InputProps={{
                  startAdornment: <PhoneIcon sx={{ mr: 1 }} />,
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </Grid>
          </Grid>

          {/* Step 2: License */}
          <Box component="form" onSubmit={handleActivate} mt={3}>
            <Typography variant="subtitle1" gutterBottom>
              Step 2: Enter License Key
            </Typography>

            <TextField
              fullWidth
              label="License Key"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              InputProps={{
                startAdornment: <VpnKeyIcon sx={{ mr: 1 }} />,
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={20} /> : "Activate License"}
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {successMessage && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {successMessage}
            </Alert>
          )}

          <Box mt={2} textAlign="center">
            <Button variant="text" onClick={goToLogin} type="button">
              Back to Login
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Activate;
