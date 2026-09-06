

export const stressProfile = {
  vus: 1000,
  duration: '20m',
  stages: [
    { duration: '2m', target: 1000 },
    { duration: '3m', target: 2000 },
    { duration: '3m', target: 3000 },
    { duration: '5m', target: 3000 },
    { duration: '3m', target: 5000 },
    { duration: '4m', target: 0 },
  ],
};
