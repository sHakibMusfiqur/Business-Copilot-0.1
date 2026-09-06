

export const smokeProfile = {
  vus: 5,
  duration: '2m',
  stages: [
    { duration: '30s', target: 1 },
    { duration: '1m', target: 5 },
    { duration: '30s', target: 0 },
  ],
};
