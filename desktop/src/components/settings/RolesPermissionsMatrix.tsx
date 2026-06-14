import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import {
  PRODUCTION_PERMISSION_MATRIX,
  PRODUCTION_ROLES,
  productionRoleHasPermission,
} from '../../config/productionRoles';

/** Read-only role × permission matrix for production deployments. */
export default function RolesPermissionsMatrix() {
  return (
    <Paper variant="outlined" sx={{ mt: 3, overflow: 'hidden' }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ p: 2, pb: 1 }}>
        Production permission matrix
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 2 }}>
        Default access per role. Individual users can be overridden in the user dialog.
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Permission</TableCell>
              {PRODUCTION_ROLES.map((role) => (
                <TableCell key={role.id} align="center" sx={{ minWidth: 88 }}>
                  <Chip label={role.label} size="small" variant="outlined" />
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {PRODUCTION_PERMISSION_MATRIX.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.label}</TableCell>
                {PRODUCTION_ROLES.map((role) => {
                  const ok = productionRoleHasPermission(role.id, row.id);
                  return (
                    <TableCell key={role.id} align="center">
                      {ok ? (
                        <CheckIcon fontSize="small" color="success" />
                      ) : (
                        <CloseIcon fontSize="small" color="disabled" />
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
