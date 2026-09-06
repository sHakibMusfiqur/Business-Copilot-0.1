

import { SharedArray } from 'k6/data';
import { config } from '../config.js';

let _users = null;


export function getUsers() {
  if (_users) return _users;

  try {
    _users = new SharedArray('test-users', function () {
      // eslint-disable-next-line no-undef
      const data = open('../data/test-users.csv');
      return data
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const [email, password, orgId] = line.split(',').map((s) => s.trim());
          return { email, password, orgId: orgId || '' };
        });
    });
  } catch (e) {
    // Fallback: single test user
    _users = [
      {
        email: config.testUserEmail,
        password: config.testUserPassword,
        orgId: config.testOrgId,
      },
    ];
  }

  return _users;
}


export function getRandomUser() {
  const users = getUsers();
  // Use VU id to distribute users, with randomization within the pool
  const idx = (__VU - 1) % users.length;
  return users[idx];
}


export function getUserAtIndex(index) {
  const users = getUsers();
  return users[index % users.length];
}
