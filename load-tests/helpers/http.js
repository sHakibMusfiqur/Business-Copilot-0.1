

import http from 'k6/http';
import { check } from 'k6';
import { config } from '../config.js';


export function authHeaders(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };
}


export function publicHeaders() {
  return {
    headers: {
      'Content-Type': 'application/json',
    },
  };
}


export function apiGet(path, token) {
  const url = `${config.apiUrl}${path}`;
  const res = http.get(url, authHeaders(token));
  return res;
}


export function apiPost(path, body, token) {
  const url = `${config.apiUrl}${path}`;
  const res = http.post(url, JSON.stringify(body), authHeaders(token));
  return res;
}


export function apiPut(path, body, token) {
  const url = `${config.apiUrl}${path}`;
  const res = http.put(url, JSON.stringify(body), authHeaders(token));
  return res;
}


export function apiDelete(path, token) {
  const url = `${config.apiUrl}${path}`;
  const res = http.del(url, null, authHeaders(token));
  return res;
}


export function publicPost(path, body) {
  const url = `${config.apiUrl}${path}`;
  const res = http.post(url, JSON.stringify(body), publicHeaders());
  return res;
}

/**
 * Check that a response is 2xx.
 */
export function checkOk(res, name) {
  return check(res, {
    [`${name} — status is 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${name} — has body`]: (r) => r.body && r.body.length > 0,
  });
}

/**
 * Check that a response is 429 (rate limited).
 */
export function checkRateLimited(res, name) {
  return check(res, {
    [`${name} — status is 429`]: (r) => r.status === 429,
  });
}

/**
 * Check that a response is 401 or 403 (unauthorized).
 */
export function checkUnauthorized(res, name) {
  return check(res, {
    [`${name} — status is 401 or 403`]: (r) => r.status === 401 || r.status === 403,
  });
}

/**
 * Parse JSON response body safely.
 */
export function parseJson(res) {
  try {
    return JSON.parse(res.body);
  } catch (e) {
    return null;
  }
}
