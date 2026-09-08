

import { group } from 'k6';
import { config } from '../config.js';
import { publicPost, apiGet, parseJson } from './http.js';


export function login(email, password) {
  const res = publicPost('/auth/login', { email, password });
  if (res.status !== 200) return null;
  const body = parseJson(res);
  if (!body) return null;
  return {
    accessToken: body.accessToken || body.access_token,
    refreshToken: body.refreshToken || body.refresh_token,
  };
}


export function refreshToken(refreshToken) {
  const res = publicPost('/auth/refresh', { refreshToken });
  if (res.status !== 200) return null;
  const body = parseJson(res);
  if (!body) return null;
  return {
    accessToken: body.accessToken || body.access_token,
    refreshToken: body.refreshToken || body.refresh_token,
  };
}

/**
 * Get current user profile (/auth/me).
 */
export function getMe(token) {
  const res = apiGet('/auth/me', token);
  if (res.status !== 200) return null;
  return parseJson(res);
}


export function authenticateTestUser() {
  const tokens = login(config.testUserEmail, config.testUserPassword);
  if (!tokens || !tokens.accessToken) return null;
  const user = getMe(tokens.accessToken);
  return { token: tokens.accessToken, user };
}


export function createSetupFunction(email, password) {
  return function setup() {
    const userEmail = email || config.testUserEmail;
    const userPassword = password || config.testUserPassword;

    if (!userEmail || !userPassword) {
      throw new Error(
        'Missing required test credentials. ' +
        'Set K6_TEST_USERS and K6_TEST_PASSWORD environment variables before running load tests.'
      );
    }

    const tokens = login(userEmail, userPassword);
    if (!tokens || !tokens.accessToken) {
      throw new Error(`Failed to authenticate: ${userEmail}`);
    }
    return { token: tokens.accessToken, refreshToken: tokens.refreshToken };
  };
}
