import { UnitOfMeasure } from '../../types/masters';
import { generateId } from '../../utils/id';
import { nowIso, readList, sanitizeString, writeList } from './storageHelpers';

const STORAGE_KEY = 'pve_units_of_measure';

export interface UnitFilters {
  includeInactive?: boolean;
  search?: string;
}

const normalizePrecision = (value: unknown): number => {
  const precision = Number(value);
  if (!Number.isInteger(precision) || precision < 0 || precision > 6) {
    throw new Error('Precision must be an integer between 0 and 6');
  }
  return precision;
};

const DEFAULT_UNITS: Omit<UnitOfMeasure, 'createdAt' | 'updatedAt'>[] = [
  // Count / Pack
  { id: 'uom-pcs', name: 'Pieces', symbol: 'pcs', uqc: 'PCS', precision: 0, isActive: true },
  { id: 'uom-nos', name: 'Number', symbol: 'nos', uqc: 'NOS', precision: 0, isActive: true },
  { id: 'uom-doz', name: 'Dozen', symbol: 'doz', uqc: 'DOZ', precision: 0, isActive: true },
  { id: 'uom-prs', name: 'Pair', symbol: 'pr', uqc: 'PRS', precision: 0, isActive: true },
  { id: 'uom-set', name: 'Set', symbol: 'set', uqc: 'SET', precision: 0, isActive: true },
  { id: 'uom-pac', name: 'Pack', symbol: 'pk', uqc: 'PAC', precision: 0, isActive: true },
  { id: 'uom-box', name: 'Box', symbol: 'box', uqc: 'BOX', precision: 0, isActive: true },
  { id: 'uom-ctn', name: 'Carton', symbol: 'ctn', uqc: 'CTN', precision: 0, isActive: true },

  // Weight
  { id: 'uom-gms', name: 'Gram', symbol: 'g', uqc: 'GMS', precision: 3, isActive: true },
  { id: 'uom-kgs', name: 'Kilogram', symbol: 'kg', uqc: 'KGS', precision: 3, isActive: true },
  { id: 'uom-qtl', name: 'Quintal', symbol: 'qtl', uqc: 'QTL', precision: 3, isActive: true },
  { id: 'uom-ton', name: 'Tonne', symbol: 'ton', uqc: 'TON', precision: 3, isActive: true },

  // Volume
  { id: 'uom-mlt', name: 'Millilitre', symbol: 'ml', uqc: 'MLT', precision: 3, isActive: true },
  { id: 'uom-ltr', name: 'Litre', symbol: 'ltr', uqc: 'LTR', precision: 3, isActive: true },
  { id: 'uom-klr', name: 'Kilolitre', symbol: 'kl', uqc: 'KLR', precision: 3, isActive: true },

  // Length / Area
  { id: 'uom-mmt', name: 'Millimetre', symbol: 'mm', uqc: 'MMT', precision: 2, isActive: true },
  { id: 'uom-cmt', name: 'Centimetre', symbol: 'cm', uqc: 'CMT', precision: 2, isActive: true },
  { id: 'uom-mtr', name: 'Metre', symbol: 'm', uqc: 'MTR', precision: 2, isActive: true },
  { id: 'uom-kmt', name: 'Kilometre', symbol: 'km', uqc: 'KMT', precision: 3, isActive: true },
  { id: 'uom-sqm', name: 'Square Metre', symbol: 'sqm', uqc: 'SQM', precision: 2, isActive: true },
  { id: 'uom-sqf', name: 'Square Foot', symbol: 'sqft', uqc: 'SQF', precision: 2, isActive: true },
  { id: 'uom-sqi', name: 'Square Inch', symbol: 'sqin', uqc: 'SQI', precision: 2, isActive: true },

  // Time
  { id: 'uom-hur', name: 'Hour', symbol: 'hr', uqc: 'HUR', precision: 2, isActive: true },
  { id: 'uom-day', name: 'Day', symbol: 'day', uqc: 'DAY', precision: 0, isActive: true },
  { id: 'uom-mon', name: 'Month', symbol: 'mon', uqc: 'MON', precision: 0, isActive: true },
  { id: 'uom-yrs', name: 'Year', symbol: 'yr', uqc: 'YRS', precision: 0, isActive: true },

  // Other trade units
  { id: 'uom-rol', name: 'Roll', symbol: 'rol', uqc: 'ROL', precision: 0, isActive: true },
  { id: 'uom-bdl', name: 'Bundle', symbol: 'bdl', uqc: 'BDL', precision: 0, isActive: true },
  { id: 'uom-bag', name: 'Bag', symbol: 'bag', uqc: 'BAG', precision: 0, isActive: true },
  { id: 'uom-can', name: 'Can', symbol: 'can', uqc: 'CAN', precision: 0, isActive: true },
  { id: 'uom-btl', name: 'Bottle', symbol: 'btl', uqc: 'BTL', precision: 0, isActive: true },
];

const buildUnit = (payload: Partial<UnitOfMeasure>, isCreate: boolean): UnitOfMeasure => {
  const name = sanitizeString(payload.name ?? null);
  if (!name) {
    throw new Error('Unit name is required');
  }

  const symbol = sanitizeString(payload.symbol ?? null);
  if (!symbol) {
    throw new Error('Unit symbol is required');
  }

  if (!isCreate && !payload.id) {
    throw new Error('Unit id is required');
  }

  const precision = normalizePrecision(payload.precision);
  const uqc = sanitizeString(payload.uqc ?? null);

  return {
    id: payload.id ?? generateId('uom'),
    name,
    symbol,
    uqc,
    precision,
    isActive: payload.isActive ?? true,
    createdAt: payload.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
};

const ensureUniqueUnit = (
  units: UnitOfMeasure[],
  candidate: UnitOfMeasure,
  skipIndex?: number
) => {
  const duplicateName = units.some(
    (unit, index) => index !== skipIndex && unit.name.toLowerCase() === candidate.name.toLowerCase()
  );
  if (duplicateName) {
    throw new Error('Unit name already exists');
  }

  const duplicateSymbol = units.some(
    (unit, index) => index !== skipIndex && unit.symbol.toLowerCase() === candidate.symbol.toLowerCase()
  );
  if (duplicateSymbol) {
    throw new Error('Unit symbol already exists');
  }

  if (candidate.uqc) {
    const duplicateUqc = units.some(
      (unit, index) =>
        index !== skipIndex &&
        unit.uqc &&
        unit.uqc.toLowerCase() === candidate.uqc!.toLowerCase()
    );
    if (duplicateUqc) {
      throw new Error('Unit UQC already exists');
    }
  }
};

const filterUnits = (units: UnitOfMeasure[], filters: UnitFilters) => {
  const searchValue = sanitizeString(filters.search ?? null)?.toLowerCase();
  return units.filter((unit) => {
    if (!filters.includeInactive && unit.isActive === false) {
      return false;
    }
    if (searchValue) {
      const haystack = `${unit.name} ${unit.symbol} ${unit.uqc ?? ''}`.toLowerCase();
      if (!haystack.includes(searchValue)) {
        return false;
      }
    }
    return true;
  });
};

const sortUnits = (units: UnitOfMeasure[]) =>
  [...units].sort((a, b) => a.name.localeCompare(b.name));

export const unitOfMeasureService = {
  async list(filters: UnitFilters = {}): Promise<UnitOfMeasure[]> {
    const units = await readList<UnitOfMeasure>(STORAGE_KEY);
    return filterUnits(units, filters).sort((a, b) => a.name.localeCompare(b.name));
  },

  async getById(id: string): Promise<UnitOfMeasure | null> {
    const units = await readList<UnitOfMeasure>(STORAGE_KEY);
    return units.find((unit) => unit.id === id) ?? null;
  },

  async create(payload: Partial<UnitOfMeasure>): Promise<UnitOfMeasure> {
    const units = await readList<UnitOfMeasure>(STORAGE_KEY);
    const unit = buildUnit(payload, true);
    ensureUniqueUnit(units, unit);

    units.push(unit);
    await writeList(STORAGE_KEY, units);
    return unit;
  },

  async update(id: string, payload: Partial<UnitOfMeasure>): Promise<UnitOfMeasure> {
    const units = await readList<UnitOfMeasure>(STORAGE_KEY);
    const index = units.findIndex((unit) => unit.id === id);
    if (index < 0) {
      throw new Error('Unit not found');
    }

    const current = units[index];
    const updated = buildUnit(
      {
        ...current,
        ...payload,
        id: current.id,
        createdAt: current.createdAt,
        isActive: payload.isActive ?? current.isActive,
      },
      false
    );

    ensureUniqueUnit(units, updated, index);
    units[index] = updated;
    await writeList(STORAGE_KEY, units);
    return updated;
  },

  async softDelete(id: string): Promise<void> {
    const units = await readList<UnitOfMeasure>(STORAGE_KEY);
    const index = units.findIndex((unit) => unit.id === id);
    if (index < 0) {
      throw new Error('Unit not found');
    }

    units[index] = { ...units[index], isActive: false, updatedAt: nowIso() };
    await writeList(STORAGE_KEY, units);
  },

  async restore(id: string): Promise<void> {
    const units = await readList<UnitOfMeasure>(STORAGE_KEY);
    const index = units.findIndex((unit) => unit.id === id);
    if (index < 0) {
      throw new Error('Unit not found');
    }

    units[index] = { ...units[index], isActive: true, updatedAt: nowIso() };
    await writeList(STORAGE_KEY, units);
  },

  async clearAll() {
    await writeList(STORAGE_KEY, []);
  },

  async seedDefaults() {
    const units = await readList<UnitOfMeasure>(STORAGE_KEY);
    let changed = false;
    const now = nowIso();

    for (const defaultUnit of DEFAULT_UNITS) {
      if (units.some((unit) => unit.id === defaultUnit.id)) continue;
      units.push({
        ...defaultUnit,
        createdAt: now,
        updatedAt: now,
      });
      changed = true;
    }

    if (changed) {
      await writeList(STORAGE_KEY, sortUnits(units));
    }
  },
};
