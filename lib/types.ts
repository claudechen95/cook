export interface Ingredient {
  amount?: string;
  unit?: string;
  item: string;
}

export interface Recipe {
  id: string;
  title: string;
  igUrl: string;
  ingredients: Ingredient[];
  steps: string[];
  notes?: string;
  savedAt: string;
}
