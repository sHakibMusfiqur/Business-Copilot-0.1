
function createOriginHandler(allowedOrigins: string[]) {
  return function origin(
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) {
  
    if (origin === undefined || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  };
}

describe('CORS origin handler', () => {
  const allowed = ['https://app.example.com', 'https://admin.example.com'];
  const handler = createOriginHandler(allowed);

  function testOrigin(origin: string | undefined): Promise<boolean> {
    return new Promise((resolve) => {
      handler(origin, (err, allow) => {
        resolve(allow === true);
      });
    });
  }

  it('allows undefined origin (server-to-server requests)', async () => {
    expect(await testOrigin(undefined)).toBe(true);
  });

  it('allows configured origins', async () => {
    expect(await testOrigin('https://app.example.com')).toBe(true);
    expect(await testOrigin('https://admin.example.com')).toBe(true);
  });

  it('rejects explicit "null" origin (sandboxed iframes, file://)', async () => {
    expect(await testOrigin('null')).toBe(false);
  });

  it('rejects unknown origins', async () => {
    expect(await testOrigin('https://evil.example.com')).toBe(false);
    expect(await testOrigin('https://attacker.com')).toBe(false);
  });

  it('rejects empty string origin', async () => {
    expect(await testOrigin('')).toBe(false);
  });

  it('rejects localhost in production-like config', async () => {
    const prodHandler = createOriginHandler(['https://app.example.com']);
    function testProdOrigin(origin: string | undefined): Promise<boolean> {
      return new Promise((resolve) => {
        prodHandler(origin, (err, allow) => {
          resolve(allow === true);
        });
      });
    }
    expect(await testProdOrigin('http://localhost:3000')).toBe(false);
  });
});
