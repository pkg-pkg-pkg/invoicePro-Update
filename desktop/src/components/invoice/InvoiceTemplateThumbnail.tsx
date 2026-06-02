import { Box, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { InvoiceTemplateDefinition } from '../../templates/invoice/invoiceTemplatesConfig';

type Props = {
  template: InvoiceTemplateDefinition;
  selected: boolean;
  onSelect: () => void;
};

export default function InvoiceTemplateThumbnail({ template, selected, onSelect }: Props) {
  const { preview, name } = template;
  const isMinimal = template.id === 'clean-minimal';

  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      sx={{
        cursor: 'pointer',
        border: selected ? '2px solid' : '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        borderRadius: 2,
        p: 0,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        textAlign: 'left',
        position: 'relative',
        width: '100%',
        transition: 'border-color 0.15s',
        '&:hover': { borderColor: 'primary.light' },
      }}
    >
      {selected && (
        <CheckCircleIcon
          color="primary"
          sx={{ position: 'absolute', top: 6, right: 6, zIndex: 2, fontSize: 22, bgcolor: '#fff', borderRadius: '50%' }}
        />
      )}
      <Box
        sx={{
          height: 72,
          bgcolor: preview.headerBg,
          borderBottom: isMinimal ? '3px solid #111' : 'none',
          borderLeft: template.id === 'navy-gold' ? '4px solid #EF9F27' : 'none',
          p: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <Box>
          <Box sx={{ width: 28, height: 10, bgcolor: isMinimal ? '#e5e7eb' : 'rgba(255,255,255,.3)', borderRadius: 0.5, mb: 0.5 }} />
          <Typography
            variant="caption"
            sx={{ color: isMinimal ? '#111' : '#fff', fontWeight: 800, fontSize: 10, display: 'block' }}
          >
            Company
          </Typography>
        </Box>
        <Box
          sx={{
            bgcolor: isMinimal ? 'transparent' : '#fff',
            color: preview.text,
            px: 0.75,
            py: 0.25,
            borderRadius: 0.5,
            fontSize: 8,
            fontWeight: 800,
          }}
        >
          TAX INV
        </Box>
      </Box>
      <Box sx={{ p: 1, bgcolor: '#fafafa' }}>
        <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
          <Box sx={{ flex: 1, height: 18, bgcolor: '#f3f4f6', borderRadius: 0.5 }} />
          <Box sx={{ flex: 1, height: 18, bgcolor: '#f3f4f6', borderRadius: 0.5 }} />
        </Box>
        <Box sx={{ height: 6, bgcolor: template.id === 'modern-blue' ? '#E6F1FB' : template.id === 'navy-gold' ? '#1a2e4a' : '#e5e7eb', borderRadius: 0.25, mb: 0.5 }} />
        {[1, 2, 3].map((i) => (
          <Box key={i} sx={{ height: 4, bgcolor: i % 2 ? '#fff' : '#f9fafb', borderBottom: '1px solid #eee' }} />
        ))}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
          <Box
            sx={{
              width: 48,
              height: 12,
              bgcolor: template.id === 'navy-gold' ? '#1a2e4a' : preview.accent,
              borderRadius: template.id === 'navy-gold' ? 0.5 : 0,
            }}
          />
        </Box>
      </Box>
      <Typography variant="subtitle2" sx={{ px: 1, py: 0.75, fontWeight: 700 }}>
        {name}
      </Typography>
    </Box>
  );
}
