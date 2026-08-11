export type AuthMode = "session" | "access";

export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_NAME: string;
  APP_TIMEZONE: string;
  AUTH_MODE: AuthMode;
  SESSION_SECRET?: string;
  CF_ACCESS_TEAM_NAME?: string;
  CF_ACCESS_AUD?: string;
};

export type User = {
  id: number;
  name: string;
  email: string;
  password_hash: string | null;
  created_at: string;
  updated_at: string;
};

export type Position = {
  id: number;
  user_id: number;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recorded_at: string;
  created_at: string;
  updated_at: string;
};

export type PositionInput = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  recorded_at: string;
};

export type Stay = {
  latitude: number;
  longitude: number;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
};

export type AppVariables = {
  user: User;
};
