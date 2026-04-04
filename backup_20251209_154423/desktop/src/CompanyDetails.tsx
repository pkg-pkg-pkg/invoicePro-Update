import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Typography, Paper, Box, CircularProgress, Alert } from '@mui/material';
import { AppDispatch, RootState } from '../store';
// Assuming you create a new Redux slice for Company (e.g., companySlice)
// import { fetchCompanyDetails } from '../store/slices/companySlice'; 

// NOTE: Please adjust the import path and slice names based on your project structure!

export default function CompanyDetails() {
    // const dispatch = useDispatch<AppDispatch>();
    // const { details, loading, error } = useSelector((state: RootState) => state.company);
    
    // Hardcoded example data for immediate display:
    const details = {
        name: "PrityVanya Enterprises",
        address: "3B, Umang Enclave, Road No-1, Indrapuri, Ratu Road Ranchi",
        statePin: "Jharkhand-834005",
        mobiles: "7549030630, 9470932157",
        email: "pve.2020@hotmail.com",
        website: "www.mypve.in",
        gstin: "20BLPPK9138J1ZS"
    };

    /*
    // Uncomment this useEffect block when you have the Redux slice ready
    useEffect(() => {
        dispatch(fetchCompanyDetails());
    }, [dispatch]);
    */

    // if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}><CircularProgress /></Box>;
    // if (error) return <Alert severity="error">Error: {error}</Alert>;
    // if (!details) return <Alert severity="info">No company data found.</Alert>;
    
    return (
        <Paper elevation={3} sx={{ p: 4, maxWidth: 600, mx: 'auto', mt: 4 }}>
            <Typography variant="h5" component="h1" gutterBottom>
                {details.name} (Company Details)
            </Typography>
            
            <Box sx={{ mt: 3, lineHeight: 1.8 }}>
                <Typography variant="body1">
                    <strong>Address:</strong> {details.address}, {details.statePin}
                </Typography>
                <Typography variant="body1">
                    <strong>Mobile:</strong> {details.mobiles}
                </Typography>
                <Typography variant="body1">
                    <strong>Email:</strong> {details.email}
                </Typography>
                <Typography variant="body1">
                    <strong>Website:</strong> {details.website}
                </Typography>
                <Typography variant="body1">
                    <strong>GSTIN:</strong> {details.gstin}
                </Typography>
            </Box>
            
            <Box sx={{ mt: 4 }}>
                <Typography variant="subtitle2" color="text.secondary">
                    *This data should be fetched from the Backend API (/api/company)
                </Typography>
            </Box>
        </Paper>
    );
}
