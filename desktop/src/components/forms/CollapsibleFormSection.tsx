import { ReactNode, useState } from 'react';
import { Box, Collapse, IconButton, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

type Props = {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function CollapsibleFormSection({ title, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, py: 1, bgcolor: 'action.hover', cursor: 'pointer' }}
        onClick={() => setOpen((v) => !v)}
      >
        <Typography variant="subtitle1" fontWeight={700}>
          {title}
        </Typography>
        <IconButton size="small" aria-label={open ? 'Collapse section' : 'Expand section'}>
          {open ? <RemoveIcon fontSize="small" /> : <AddIcon fontSize="small" />}
        </IconButton>
      </Stack>
      <Collapse in={open}>
        <Box sx={{ p: 2 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}
