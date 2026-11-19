import type { PanelCall } from "./attendant.js";

export type ContentType = "NOTICE" | "NEWS" | "WEATHER" | "TIP";
export type DisplayCard = {
  id: string;
  type: ContentType;
  title: string;
  text: string;
  imageUrl?: string;
  source?: string;
  weather?: {
    temperature: number;
    days: { day: string; min: number; max: number }[];
  };
};
export type PanelSettings = {
  serviceIds: string[];
  weights: Record<ContentType, number>;
  cardSeconds: number;
  newsCategories: string[];
  city: string;
  callDisplaySeconds: number;
  ticker: string;
};
export type PanelData = {
  unitName: string;
  logoUrl?: string;
  timeZone: string;
  config: PanelSettings;
  calls: PanelCall[];
  cards: DisplayCard[];
  temperature?: number;
};
export const defaultPanelSettings: PanelSettings = {
  serviceIds: [],
  weights: { NOTICE: 50, NEWS: 30, WEATHER: 20, TIP: 20 },
  cardSeconds: 10,
  newsCategories: [],
  city: "São Paulo",
  callDisplaySeconds: 5,
  ticker: "",
};
