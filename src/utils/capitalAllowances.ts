/**
 * capitalAllowances.ts — Nigerian Capital Allowances Engine
 *
 * Implements Initial Allowance (IA) and Annual Allowance (AA) computations
 * by asset class as prescribed under the Companies Income Tax Act (CITA).
 *
 * Capital allowances replace depreciation for tax purposes in Nigeria.
 * They are deducted from assessable profit to arrive at total profit.
 *
 * References:
 *  - Second Schedule to CITA
 *  - FIRS Information Circular on Capital Allowances
 */

// ─── Asset Classes ───────────────────────────────────────────────────────────

export interface AssetClass {
  id: string;
  name: string;
  description: string;
  initialAllowanceRate: number;   // e.g. 0.50 for 50%
  annualAllowanceRate: number;    // e.g. 0.25 for 25%
  examples: string[];
}

export const ASSET_CLASSES: AssetClass[] = [
  {
    id: 'buildings-industrial',
    name: 'Industrial Buildings',
    description: 'Factory buildings, warehouses, and structures used for industrial purposes',
    initialAllowanceRate: 0.15,
    annualAllowanceRate: 0.10,
    examples: ['Factories', 'Warehouses', 'Production facilities'],
  },
  {
    id: 'buildings-nonindustrial',
    name: 'Non-Industrial Buildings',
    description: 'Office buildings, retail outlets, and non-industrial structures',
    initialAllowanceRate: 0.15,
    annualAllowanceRate: 0.10,
    examples: ['Offices', 'Shops', 'Commercial buildings'],
  },
  {
    id: 'plant-machinery',
    name: 'Plant & Machinery',
    description: 'Manufacturing equipment, generators, heavy machinery',
    initialAllowanceRate: 0.50,
    annualAllowanceRate: 0.25,
    examples: ['Generators', 'Manufacturing equipment', 'Industrial machinery'],
  },
  {
    id: 'furniture-fittings',
    name: 'Furniture & Fittings',
    description: 'Office furniture, fixtures, and interior fittings',
    initialAllowanceRate: 0.25,
    annualAllowanceRate: 0.20,
    examples: ['Desks', 'Chairs', 'Shelving', 'Interior partitions'],
  },
  {
    id: 'motor-vehicles',
    name: 'Motor Vehicles',
    description: 'Cars, trucks, vans, and other vehicles used for business',
    initialAllowanceRate: 0.50,
    annualAllowanceRate: 0.25,
    examples: ['Company cars', 'Delivery trucks', 'Vans'],
  },
  {
    id: 'computers-ict',
    name: 'Computers & ICT Equipment',
    description: 'Computers, servers, networking equipment, and software',
    initialAllowanceRate: 0.50,
    annualAllowanceRate: 0.25,
    examples: ['Laptops', 'Servers', 'Network switches', 'Licensed software'],
  },
  {
    id: 'agricultural',
    name: 'Agricultural Plant & Equipment',
    description: 'Equipment used in agricultural production and processing',
    initialAllowanceRate: 0.95,
    annualAllowanceRate: 0.00,
    examples: ['Tractors', 'Harvesters', 'Irrigation systems'],
  },
  {
    id: 'mining',
    name: 'Mining Equipment',
    description: 'Mining machinery, drilling rigs, and exploration equipment',
    initialAllowanceRate: 0.95,
    annualAllowanceRate: 0.00,
    examples: ['Drilling rigs', 'Mining trucks', 'Excavators'],
  },
  {
    id: 'ranching-plantation',
    name: 'Ranching & Plantation',
    description: 'Assets used in ranching, forestry, and plantation operations',
    initialAllowanceRate: 0.30,
    annualAllowanceRate: 0.50,
    examples: ['Plantation equipment', 'Ranch infrastructure'],
  },
  {
    id: 'housing-estate',
    name: 'Housing Estate',
    description: 'Residential buildings built by companies for employees',
    initialAllowanceRate: 0.50,
    annualAllowanceRate: 0.25,
    examples: ['Staff quarters', 'Employee housing estates'],
  },
];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AssetEntry {
  id: string;
  assetClassId: string;
  description: string;
  acquisitionCost: number;
  yearAcquired: number;
}

export interface AllowanceResult {
  assetId: string;
  assetDescription: string;
  assetClassName: string;
  acquisitionCost: number;
  initialAllowance: number;
  annualAllowance: number;
  firstYearTotal: number;
  taxWrittenDownValue: number;
}

export interface AllowanceSummary {
  totalAcquisitionCost: number;
  totalInitialAllowance: number;
  totalAnnualAllowance: number;
  totalFirstYearAllowance: number;
  totalTaxWrittenDownValue: number;
  entries: AllowanceResult[];
}

// ─── Calculation ─────────────────────────────────────────────────────────────

/**
 * Calculate capital allowances for a single asset in its acquisition year.
 */
export function calculateAssetAllowance(
  acquisitionCost: number,
  assetClassId: string
): AllowanceResult | null {
  const assetClass = ASSET_CLASSES.find(c => c.id === assetClassId);
  if (!assetClass) return null;

  const initialAllowance = Math.round(acquisitionCost * assetClass.initialAllowanceRate);
  const residualAfterIA = acquisitionCost - initialAllowance;
  const annualAllowance = Math.round(residualAfterIA * assetClass.annualAllowanceRate);
  const firstYearTotal = initialAllowance + annualAllowance;
  const taxWrittenDownValue = acquisitionCost - firstYearTotal;

  return {
    assetId: '',
    assetDescription: '',
    assetClassName: assetClass.name,
    acquisitionCost,
    initialAllowance,
    annualAllowance,
    firstYearTotal,
    taxWrittenDownValue,
  };
}

/**
 * Calculate capital allowances for a portfolio of assets.
 */
export function calculatePortfolioAllowances(assets: AssetEntry[]): AllowanceSummary {
  const entries: AllowanceResult[] = [];

  for (const asset of assets) {
    const result = calculateAssetAllowance(asset.acquisitionCost, asset.assetClassId);
    if (result) {
      result.assetId = asset.id;
      result.assetDescription = asset.description;
      entries.push(result);
    }
  }

  return {
    totalAcquisitionCost: entries.reduce((s, e) => s + e.acquisitionCost, 0),
    totalInitialAllowance: entries.reduce((s, e) => s + e.initialAllowance, 0),
    totalAnnualAllowance: entries.reduce((s, e) => s + e.annualAllowance, 0),
    totalFirstYearAllowance: entries.reduce((s, e) => s + e.firstYearTotal, 0),
    totalTaxWrittenDownValue: entries.reduce((s, e) => s + e.taxWrittenDownValue, 0),
    entries,
  };
}
