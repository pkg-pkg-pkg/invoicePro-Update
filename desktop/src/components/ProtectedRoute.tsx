import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Box, Typography, Button, Paper } from '@mui/material';
import { RootState } from '../store';
import { usePermissions } from '../hooks/usePermissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredAnyPermissions?: string[];
  requiredAllPermissions?: string[];
}

export default function ProtectedRoute({
  children,
  requiredPermission,
  requiredAnyPermissions,
  requiredAllPermissions
}: ProtectedRouteProps) {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { canAccessFeature, hasAnyPermission, hasAllPermissions, user } = usePermissions();

  // Check authentication first
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Check permission requirements
  if (requiredPermission && !canAccessFeature(requiredPermission)) {
    return (
      <Box sx={{ p: 3, maxWidth: 600, mx: 'auto', mt: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Access Denied
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            You don't have permission to access this page.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Required permission: {requiredPermission}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Your role: {user.role}
          </Typography>
          <Button variant="contained" onClick={() => window.history.back()}>
            Go Back
          </Button>
        </Paper>
      </Box>
    );
  }

  if (requiredAnyPermissions && !hasAnyPermission(requiredAnyPermissions as any)) {
    return (
      <Box sx={{ p: 3, maxWidth: 600, mx: 'auto', mt: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Access Denied
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            You don't have the required permissions to access this page.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Required any of: {requiredAnyPermissions.join(', ')}
          </Typography>
          <Button variant="contained" onClick={() => window.history.back()}>
            Go Back
          </Button>
        </Paper>
      </Box>
    );
  }

  if (requiredAllPermissions && !hasAllPermissions(requiredAllPermissions as any)) {
    return (
      <Box sx={{ p: 3, maxWidth: 600, mx: 'auto', mt: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Access Denied
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            You don't have all the required permissions to access this page.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Required all of: {requiredAllPermissions.join(', ')}
          </Typography>
          <Button variant="contained" onClick={() => window.history.back()}>
            Go Back
          </Button>
        </Paper>
      </Box>
    );
  }

  return <>{children}</>;
}

// Utility component for permission-based rendering
export function PermissionGate({
  children,
  permission,
  fallback = null
}: {
  children: React.ReactNode;
  permission: string;
  fallback?: React.ReactNode;
}) {
  const { canAccessFeature } = usePermissions();

  if (!canAccessFeature(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

