// src/auth/jwt.js

/**
 * Decodes the payload segment of a JWT.
 */
export const decodeToken = (token) => {
  if (!token) return null;
  try {
    const parts = token.split('.');
    const payload = parts.length > 1 ? parts[1] : parts[0];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch {
    return null;
  }
};

/**
 * Checks if a token has expired or is valid.
 */
export const isTokenValid = (token) => {
  if (!token) return false;
  const decoded = decodeToken(token);
  if (!decoded) return false;
  if (decoded.exp && decoded.exp * 1000 <= Date.now()) return false;
  return true;
};

/**
 * Role checking helpers.
 */
export const hasRole = (token, allowedRoles = []) => {
  if (allowedRoles.length === 0) return true;
  const decoded = decodeToken(token);
  if (!decoded) return false;
  return allowedRoles.includes(decoded.role);
};
