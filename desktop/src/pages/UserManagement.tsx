// src/pages/UserManagement.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Alert,
  Grid,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Avatar,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Security as SecurityIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  updateUserPermissions,
  setSelectedUser,
  resetUserForm,
  clearError,
} from '../store/slices/userManagementSlice';
import { SerializableUser } from '../store/slices/userManagementSlice';
import { User, UserRole, DEFAULT_PERMISSIONS, UserPermissions } from '../store/slices/authSlice';
import { useAuth } from './contexts/auth';

const buildBlankPermissions = (): UserPermissions => {
  const keys = Object.keys(DEFAULT_PERMISSIONS.viewer) as Array<keyof UserPermissions>;
  return keys.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {} as UserPermissions);
};

const UserManagement: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { users, loading, error, selectedUser } = useSelector((state: RootState) => state.userManagement);
  const currentUser = useSelector((state: RootState) => state.auth.user);

  const { user: sessionUser, token: sessionToken, login: sessionLogin } = useAuth();

  const normalizeToSerializableUser = (u: SerializableUser | User): SerializableUser => {
    const lastLogin = (u as any)?.lastLogin;
    const createdAt = (u as any)?.createdAt;
    const updatedAt = (u as any)?.updatedAt;

    return {
      ...(u as any),
      lastLogin: lastLogin instanceof Date ? lastLogin.toISOString() : lastLogin || undefined,
      createdAt: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt ?? new Date().toISOString()),
      updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : String(updatedAt ?? new Date().toISOString()),
    } as SerializableUser;
  };

  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | 'permissions'>('create');
  const [activeTab, setActiveTab] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    fullName: '',
    password: '',
    confirmPassword: '',
    role: 'viewer' as UserRole,
  });

  const [permissions, setPermissions] = useState<UserPermissions>(() => {
    try {
      return JSON.parse(JSON.stringify(buildBlankPermissions()));
    } catch (error) {
      console.error('Error initializing permissions:', error);
      return buildBlankPermissions();
    }
  });

  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  const handleOpenDialog = (mode: 'create' | 'edit' | 'permissions', user?: SerializableUser | User) => {
    setDialogMode(mode);
    setOpenDialog(true);

    if (mode === 'edit' && user) {
      const serial = normalizeToSerializableUser(user);
      dispatch(setSelectedUser(serial));
      setFormData({
        username: serial.username,
        email: serial.email,
        fullName: serial.fullName,
        password: '',
        confirmPassword: '',
        role: serial.role,
      });
      try {
        setPermissions(JSON.parse(JSON.stringify(serial.permissions)));
      } catch {
        setPermissions({ ...serial.permissions });
      }
    } else if (mode === 'permissions' && user) {
      const serial = normalizeToSerializableUser(user);
      dispatch(setSelectedUser(serial));
      try {
        setPermissions(JSON.parse(JSON.stringify(serial.permissions)));
      } catch (error) {
        console.error('Error setting permissions:', error);
        setPermissions({ ...serial.permissions });
      }
    } else if (mode === 'create') {
      setFormData({
        username: '',
        email: '',
        fullName: '',
        password: '',
        confirmPassword: '',
        role: 'viewer',
      });
      setPermissions(buildBlankPermissions());
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    dispatch(resetUserForm());
    setFormData({
      username: '',
      email: '',
      fullName: '',
      password: '',
      confirmPassword: '',
      role: 'viewer',
    });
  };

  const handleSubmit = async () => {
    if (!formData.username || !formData.email || !formData.fullName) {
      alert('Please fill in all required fields');
      return;
    }

    if (dialogMode === 'create') {
      if (!formData.password) {
        alert('Password is required');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        alert('Passwords do not match');
        return;
      }

      const action = await dispatch(createUser({
        username: formData.username,
        email: formData.email,
        fullName: formData.fullName,
        password: formData.password,
        role: formData.role,
        permissions,
      }));

      if (createUser.fulfilled.match(action)) {
        handleCloseDialog();
      }
    } else if (dialogMode === 'edit' && selectedUser) {
      const action = await dispatch(updateUser({
        id: selectedUser.id,
        updates: {
          username: formData.username,
          email: formData.email,
          fullName: formData.fullName,
          role: formData.role,
          permissions,
        },
      }));

      if (updateUser.fulfilled.match(action)) {
        // If the edited user is the currently logged-in user, refresh session user
        // so the AppBar header updates immediately.
        try {
          const updated = action.payload as any;
          const sessionId = String((sessionUser as any)?.id ?? '').trim();
          if (sessionId && String(updated?.id ?? '') === sessionId) {
            const nextUser = {
              ...(sessionUser as any),
              id: String(updated?.id ?? sessionId),
              username: String(updated?.username ?? (sessionUser as any)?.username ?? ''),
              email: String(updated?.email ?? (sessionUser as any)?.email ?? ''),
              fullName: String(updated?.fullName ?? updated?.username ?? (sessionUser as any)?.fullName ?? ''),
              role: String(updated?.role ?? (sessionUser as any)?.role ?? 'user'),
            };
            const tok = String(sessionToken ?? localStorage.getItem('token') ?? '').trim();
            if (tok) {
              await sessionLogin(tok, nextUser as any);
            } else {
              // Best-effort fallback
              localStorage.setItem('user', JSON.stringify(nextUser));
            }
          }
        } catch {
          // ignore
        }
        handleCloseDialog();
      }
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      await dispatch(deleteUser(userId));
    }
  };

  const handlePermissionsChange = async () => {
    if (selectedUser) {
      await dispatch(updateUserPermissions({
        userId: selectedUser.id,
        permissions,
      }));
    }
    handleCloseDialog();
  };

  const handleRoleChange = (newRole: UserRole) => {
    setFormData(prev => ({ ...prev, role: newRole }));
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'error';
      case 'manager': return 'warning';
      case 'accountant': return 'info';
      case 'sales': return 'success';
      case 'viewer': return 'default';
      default: return 'default';
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin': return '👑';
      case 'manager': return '👔';
      case 'accountant': return '🧮';
      case 'sales': return '💼';
      case 'viewer': return '👁️';
      default: return '👤';
    }
  };

  // Permission categories for organized display
  const permissionCategories = [
    {
      title: 'Dashboard & Analytics',
      permissions: ['viewDashboard', 'viewAnalytics'],
    },
    {
      title: 'Sales & Invoices',
      permissions: ['createInvoices', 'editInvoices', 'deleteInvoices', 'viewInvoices', 'printInvoices'],
    },
    {
      title: 'Payments & Receipts',
      permissions: ['createPayments', 'editPayments', 'deletePayments', 'viewPayments'],
    },
    {
      title: 'Customers & Suppliers',
      permissions: ['createCustomers', 'editCustomers', 'deleteCustomers', 'viewCustomers', 'createSuppliers', 'editSuppliers', 'deleteSuppliers', 'viewSuppliers'],
    },
    {
      title: 'Products & Inventory',
      permissions: ['createProducts', 'editProducts', 'deleteProducts', 'viewProducts', 'manageInventory'],
    },
    {
      title: 'Banking',
      permissions: ['createBankAccounts', 'editBankAccounts', 'deleteBankAccounts', 'viewBankAccounts', 'viewBankStatements'],
    },
    {
      title: 'Reports & GST',
      permissions: ['viewReports', 'exportReports', 'viewGSTReports', 'fileGST'],
    },
    {
      title: 'Settings & Administration',
      permissions: ['manageSettings', 'manageUsers', 'manageCompany', 'customizePrint', 'backupData', 'restoreData'],
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">User Management</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog('create')}
        >
          Add User
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Login</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        {user.fullName.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="body1" fontWeight="medium">
                          {user.fullName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {user.email}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={<span style={{ fontSize: '14px' }}>{getRoleIcon(user.role)}</span>}
                      label={user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      color={getRoleColor(user.role)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.isActive ? 'Active' : 'Inactive'}
                      color={user.isActive ? 'success' : 'error'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog('permissions', user)}
                      title="Manage Permissions"
                    >
                      <SecurityIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog('edit', user)}
                      title="Edit User"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteUser(user.id)}
                      disabled={user.id === currentUser?.id}
                      title={user.id === currentUser?.id ? 'Cannot delete yourself' : 'Delete User'}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {users.length === 0 && !loading && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <PersonIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No users found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create your first user to get started
            </Typography>
          </Box>
        )}
      </Paper>

      {/* User Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {dialogMode === 'create' && <AddIcon />}
            {dialogMode === 'edit' && <EditIcon />}
            {dialogMode === 'permissions' && <SecurityIcon />}
            <Typography variant="h6">
              {dialogMode === 'create' && 'Create New User'}
              {dialogMode === 'edit' && 'Edit User'}
              {dialogMode === 'permissions' && 'Manage User Permissions'}
            </Typography>
            <IconButton
              onClick={handleCloseDialog}
              sx={{ ml: 'auto' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {dialogMode !== 'permissions' && (
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Username"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Full Name"
                  value={formData.fullName}
                  onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={formData.role}
                    label="Role"
                    onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  >
                    <MenuItem value="admin">👑 Admin - Full Access</MenuItem>
                    <MenuItem value="manager">👔 Manager - Most Features</MenuItem>
                    <MenuItem value="accountant">🧮 Accountant - Financial Operations</MenuItem>
                    <MenuItem value="sales">💼 Sales - Sales Operations</MenuItem>
                    <MenuItem value="viewer">👁️ Viewer - Read Only</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {dialogMode === 'create' && (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Confirm Password"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      required
                    />
                  </Grid>
                </>
              )}
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Access controls (admin-selected)
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  Role is only a label; enable exactly what this user can access.
                </Typography>
                <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
                  {permissionCategories.map((category, idx) => (
                    <Tab key={idx} label={category.title} />
                  ))}
                </Tabs>
                <Grid container spacing={1}>
                  {permissionCategories[activeTab]?.permissions.map((permission) => (
                    <Grid item xs={12} sm={6} key={permission}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(permissions[permission as keyof UserPermissions])}
                            onChange={(e) => {
                              setPermissions((prev) => ({
                                ...prev,
                                [permission]: e.target.checked,
                              }));
                            }}
                          />
                        }
                        label={permission.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            </Grid>
          )}

          {dialogMode === 'permissions' && selectedUser && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Permissions for {selectedUser.fullName}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Customize specific permissions for this user. Changes will override the default role permissions.
              </Typography>

              <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
                {permissionCategories.map((category, idx) => (
                  <Tab key={idx} label={category.title} />
                ))}
              </Tabs>

              <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                <Grid container spacing={2}>
                  {permissionCategories[activeTab]?.permissions.map((permission) => (
                    <Grid item xs={12} sm={6} key={permission}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={permissions[permission as keyof typeof permissions]}
                            onChange={(e) => {
                              try {
                                setPermissions(prev => ({
                                  ...prev,
                                  [permission]: e.target.checked
                                }));
                              } catch (error) {
                                console.error('Error updating permission:', error);
                                // Fallback: create a new object
                                const newPermissions = { ...permissions };
                                newPermissions[permission as keyof typeof permissions] = e.target.checked;
                                setPermissions(newPermissions);
                              }
                            }}
                          />
                        }
                        label={permission.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={dialogMode === 'permissions' ? handlePermissionsChange : handleSubmit}
            variant="contained"
            disabled={loading}
          >
            {dialogMode === 'create' && 'Create User'}
            {dialogMode === 'edit' && 'Update User'}
            {dialogMode === 'permissions' && 'Save Permissions'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagement;
