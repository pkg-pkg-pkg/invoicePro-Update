// src/pages/Customers/CustomerForm.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  IconButton,
} from "@mui/material";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";
import { AppDispatch, RootState } from "../../store";

// IMPORTANT: we avoid depending on the exact Party type shape here.
// Instead we declare a FormState used only by this form component.
type FormState = {
  id?: string;
  name: string;
  mobile: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  gstin?: string;
  pan?: string;
  openingBalance: number;
  currentBalance: number;
  isActive?: boolean;
};

export default function CustomerForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  // Use the party slice safely (it may be registered under 'party' or 'parties' in store)
  const rootAny = useSelector((s: RootState) => s as any);
  const partySlice = rootAny.party ?? rootAny.parties ?? undefined;
  const currentParty = partySlice?.currentParty;
  const loading = partySlice?.loading ?? false;
  const error = partySlice?.error ?? null;

  const isEditMode = !!id;

  const [formData, setFormData] = useState<FormState>({
    name: "",
    mobile: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pincode: "",
    gstin: "",
    pan: "",
    openingBalance: 0,
    currentBalance: 0,
    isActive: true,
  });

  useEffect(() => {
    if (currentParty && isEditMode) {
      // currentParty may not have exact typed fields; cast as any and map defensively
      const p = currentParty as any;
      setFormData({
        id: p.id ?? p._id ?? undefined,
        name: p.name ?? "",
        mobile: p.mobile ?? p.phone ?? "",
        addressLine1: p.addressLine1 ?? p.address ?? "",
        addressLine2: p.addressLine2 ?? "",
        city: p.city ?? "",
        state: p.state ?? "",
        pincode: p.pincode ?? "",
        gstin: p.gstin ?? "",
        pan: p.pan ?? "",
        openingBalance: typeof p.openingBalance === "number" ? p.openingBalance : 0,
        currentBalance: typeof p.currentBalance === "number" ? p.currentBalance : 0,
        isActive: typeof p.isActive === "boolean" ? p.isActive : true,
      });
    }
  }, [currentParty, isEditMode]);

  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.name?.trim()) errs.name = "Name is required";
    if (!formData.mobile?.trim()) errs.mobile = "Mobile is required";
    // add more validations if needed
    if (Object.keys(errs).length) {
      // show simple alert for now
      alert(Object.values(errs).join("\n"));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      if (isEditMode && formData.id) {
        // dispatch update thunk — cast as any to avoid strict typings here
        // @ts-ignore
        await dispatch((rootAny.updateParty as any)({ id: formData.id, changes: formData })).unwrap?.();
      } else {
        // @ts-ignore
        await dispatch((rootAny.createParty as any)(formData)).unwrap?.();
      }
      navigate("/customers");
    } catch (err) {
      console.error("Failed to save party", err);
    }
  };

  if (loading && isEditMode) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 240 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <IconButton onClick={() => navigate("/customers")} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6">{isEditMode ? "Edit Customer" : "New Customer"}</Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {String(error)}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField label="Name" value={formData.name} onChange={(e) => handleChange("name", e.target.value)} fullWidth required />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Mobile" value={formData.mobile} onChange={(e) => handleChange("mobile", e.target.value)} fullWidth required />
            </Grid>

            <Grid item xs={12}>
              <TextField label="Address Line 1" value={formData.addressLine1} onChange={(e) => handleChange("addressLine1", e.target.value)} fullWidth required />
            </Grid>

            <Grid item xs={12}>
              <TextField label="Address Line 2" value={formData.addressLine2} onChange={(e) => handleChange("addressLine2", e.target.value)} fullWidth />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField label="City" value={formData.city} onChange={(e) => handleChange("city", e.target.value)} fullWidth required />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField label="State" value={formData.state} onChange={(e) => handleChange("state", e.target.value)} fullWidth required />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField label="Pincode" value={formData.pincode} onChange={(e) => handleChange("pincode", e.target.value)} fullWidth required />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField label="GSTIN" value={formData.gstin} onChange={(e) => handleChange("gstin", e.target.value)} fullWidth />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField label="PAN" value={formData.pan} onChange={(e) => handleChange("pan", e.target.value)} fullWidth />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField label="Opening Balance" type="number" value={formData.openingBalance} onChange={(e) => handleChange("openingBalance", parseFloat(e.target.value || "0"))} fullWidth />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField label="Current Balance" type="number" value={formData.currentBalance} onChange={(e) => handleChange("currentBalance", parseFloat(e.target.value || "0"))} fullWidth />
            </Grid>

            <Grid item xs={12} sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <Button variant="outlined" onClick={() => navigate("/customers")}>Cancel</Button>
              <Button type="submit" variant="contained">Save</Button>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
}
