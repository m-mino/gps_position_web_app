import type { Context } from "hono";
import type { AppVariables, Env, User } from "../types";
import {
  authenticateWithPassword,
  findUserByApiToken,
} from "./users";

export async function authenticateOwnTracks(
  c: Context<{ Bindings: Env; Variables: AppVariables }>,
): Promise<User | null> {
  const authorization = c.req.header("Authorization");
  if (!authorization) {
    return null;
  }

  if (authorization.toLowerCase().startsWith("bearer ")) {
    const token = authorization.slice(7).trim();
    return findUserByApiToken(c.env.DB, token);
  }

  if (authorization.toLowerCase().startsWith("basic ")) {
    const decoded = atob(authorization.slice(6).trim());
    const separator = decoded.indexOf(":");
    if (separator < 0) {
      return null;
    }
    const email = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    return authenticateWithPassword(c.env.DB, email, password);
  }

  return null;
}
