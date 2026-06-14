import { useEffect, useMemo, useState } from 'react';
import { Button, FormControl, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';

const ADD_BRAND = '__add_new_brand__';
const PRIMARY_VALUE = '';

type Props = {
  label?: string;
  value: string;
  options: string[];
  disabled?: boolean;
  onChange: (brand: string) => void;
  onBrandCreated?: (brand: string) => void;
  dialogOpen?: boolean;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
};

/** Optional brand/group picker — empty means Primary (Tally-style). */
export function BrandGroupField({
  label = 'Brand / Group',
  value,
  options,
  disabled,
  onChange,
  onBrandCreated,
  dialogOpen,
  size = 'small',
  fullWidth = true,
}: Props) {
  const [addingBrand, setAddingBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');

  const trimmedValue = value.trim();
  const selectOptions = useMemo(() => {
    const set = new Set(options.map((o) => o.trim()).filter(Boolean));
    if (trimmedValue) set.add(trimmedValue);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [options, trimmedValue]);

  useEffect(() => {
    if (!dialogOpen) return;
    setAddingBrand(false);
    setNewBrandName('');
  }, [dialogOpen]);

  useEffect(() => {
    setAddingBrand(false);
    setNewBrandName('');
  }, [trimmedValue]);

  const selectValue = addingBrand
    ? ADD_BRAND
    : trimmedValue || PRIMARY_VALUE;

  const handleSelectChange = (next: string) => {
    if (next === ADD_BRAND) {
      setAddingBrand(true);
      setNewBrandName('');
      return;
    }
    setAddingBrand(false);
    setNewBrandName('');
    onChange(next === PRIMARY_VALUE ? '' : next);
  };

  const handleSaveNewBrand = () => {
    const name = newBrandName.trim();
    if (!name) return;
    const exists = selectOptions.some((o) => o.toLowerCase() === name.toLowerCase());
    onChange(name);
    if (!exists) onBrandCreated?.(name);
    setAddingBrand(false);
    setNewBrandName('');
  };

  return (
    <Stack spacing={1} sx={{ width: fullWidth ? '100%' : undefined }}>
      <FormControl fullWidth={fullWidth} size={size} disabled={disabled}>
        <InputLabel>{label}</InputLabel>
        <Select label={label} value={selectValue} onChange={(e) => handleSelectChange(e.target.value as string)}>
          <MenuItem value={PRIMARY_VALUE}>
            <em>Primary</em>
          </MenuItem>
          {selectOptions.map((brand) => (
            <MenuItem key={brand} value={brand}>
              {brand}
            </MenuItem>
          ))}
          <MenuItem value={ADD_BRAND}>+ Add New Brand</MenuItem>
        </Select>
      </FormControl>

      {addingBrand ? (
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            fullWidth
            autoFocus
            label="New brand name"
            value={newBrandName}
            onChange={(e) => setNewBrandName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveNewBrand();
              }
            }}
          />
          <Button variant="contained" size="small" disabled={!newBrandName.trim()} onClick={handleSaveNewBrand}>
            Add
          </Button>
          <Button
            size="small"
            onClick={() => {
              setAddingBrand(false);
              setNewBrandName('');
            }}
          >
            Cancel
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
}
