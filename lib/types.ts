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
  stepFrames?: string[]; // base64 JPEG per step, aligned by index
  notes?: string;
  savedAt: string;
}
