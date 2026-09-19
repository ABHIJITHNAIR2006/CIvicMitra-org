export const CO2_PER_POINT = 0.05;
export const ELECTRICITY_PER_POINT = 1.5;
export const WATER_PER_POINT = 2.0;
export const WASTE_PER_POINT = 0.03;

export const calculateCO2 = (points: number): number =>
  parseFloat((points * CO2_PER_POINT).toFixed(2));

export const calculateElectricity = (points: number): number =>
  parseFloat((points * ELECTRICITY_PER_POINT).toFixed(1));

export const calculateWater = (points: number): number =>
  parseFloat((points * WATER_PER_POINT).toFixed(1));

export const calculateWaste = (points: number): number =>
  parseFloat((points * WASTE_PER_POINT).toFixed(2));

export const formatCO2 = (kg: number): string => `${kg.toFixed(2)} kg`;

export const formatElectricity = (wh: number): string =>
  wh >= 1000 ? `${(wh / 1000).toFixed(2)} kWh` : `${wh.toFixed(1)} Wh`;

export const formatWater = (litres: number): string =>
  litres >= 1000 ? `${(litres / 1000).toFixed(2)} kL` : `${litres.toFixed(1)} L`;

export const formatWaste = (kg: number): string => `${kg.toFixed(2)} kg`;
