

export const spikeProfile = {
  vus: 50,
  duration: '8m',
  stages: [
    { duration: '1m', target: 50 },
    { duration: '10s', target: 5000 },
    { duration: '2m', target: 5000 },
    { duration: '10s', target: 50 },
    { duration: '3m', target: 50 },
    { duration: '10s', target: 3000 },
    { duration: '2m', target: 3000 },
    { duration: '1m', target: 0 },
  ],
};
