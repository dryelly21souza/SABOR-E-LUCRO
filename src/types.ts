/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Ingredient {
  id: string;
  name: string;
  cost: number;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: Ingredient[];
  quantityProduced: number;
  productionTimeHours: number;
}

export interface FixedCosts {
  gas: number;
  energy: number;
  transport: number;
  internet: number;
  others: number;
  monthlyProductionUnits: number;
}

export interface LaborConfig {
  hourlyRate: number;
}

export interface Sale {
  id: string;
  recipeId: string;
  quantitySold: number;
  unitPrice: number;
  date: string;
}

export interface AppState {
  recipes: Recipe[];
  fixedCosts: FixedCosts;
  laborConfig: LaborConfig;
  sales: Sale[];
}
