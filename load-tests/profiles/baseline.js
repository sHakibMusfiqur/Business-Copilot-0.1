

export const baselineProfile = {
  vus: 5,
  duration: '5m',
  stages: [
    { duration: '30s', target: 5 },
    { duration: '4m', target: 5 },
    { duration: '30s', target: 0 },
  ],
};
