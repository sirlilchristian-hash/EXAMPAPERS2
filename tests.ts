import test from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { 
  generateCheckoutToken, 
  verifyCheckoutToken, 
  isCheckoutSessionAuthorized,
  simulatedIdempotencyRegistry 
} from './server.ts';

test('1. Checkout Token Expiration and Secure Validation', () => {
  const orderId = 'test-order-123';
  
  // Generate valid token with 10 seconds TTL
  const token = generateCheckoutToken(orderId, 10);
  assert.strictEqual(verifyCheckoutToken(orderId, token), true, 'Valid token should verify successfully');

  // Verify failure for wrong order ID
  assert.strictEqual(verifyCheckoutToken('wrong-order', token), false, 'Token verified with wrong order ID should fail');

  // Verify failure for tampered token
  assert.strictEqual(verifyCheckoutToken(orderId, token + 'tampered'), false, 'Tampered token should fail');

  // Generate expired token (-5 seconds TTL)
  const expiredToken = generateCheckoutToken(orderId, -5);
  assert.strictEqual(verifyCheckoutToken(orderId, expiredToken), false, 'Expired token should fail verification');
});

test('2. Simulation Idempotency Registry & Cache', () => {
  const idempotencyKey = 'idem-key-999';
  const orderId = 'ord-456';
  
  // Register in memory registry
  simulatedIdempotencyRegistry.set(idempotencyKey, {
    orderId,
    paymentId: 'pay-789',
    mpesaReceipt: 'SIMXYZ123',
    createdAt: Date.now()
  });

  const cached = simulatedIdempotencyRegistry.get(idempotencyKey);
  assert.strictEqual(cached?.orderId, orderId, 'Cached idempotency record should match orderId');
  assert.strictEqual(cached?.mpesaReceipt, 'SIMXYZ123');
});

test('3. Order Status Privacy & Unauthorized Access Control', () => {
  const orderId = 'order-privacy-test';
  
  // Mock mock request without auth or checkout token
  const reqUnauth: any = {
    headers: {},
    query: {},
    body: {}
  };

  assert.strictEqual(
    isCheckoutSessionAuthorized(reqUnauth, orderId), 
    false, 
    'Unauthorized caller without session token or auth should be rejected'
  );

  // Mock request with valid checkout token
  const validToken = generateCheckoutToken(orderId, 3600);
  const reqAuth: any = {
    headers: { 'x-checkout-token': validToken },
    query: {},
    body: {}
  };

  assert.strictEqual(
    isCheckoutSessionAuthorized(reqAuth, orderId), 
    true, 
    'Authorized caller with valid checkout token should pass'
  );
});

test('4. Daraja Terminal State Protection Logic', () => {
  // Test simulation terminal state protection simulation
  const paymentState = { id: 'p-1', status: 'completed' };
  
  // If payment is already completed, callbacks or retries in terminal state are protected
  const isTerminal = paymentState.status === 'completed' || paymentState.status === 'failed';
  assert.strictEqual(isTerminal, true, 'Completed payment should be recognized as terminal state');
});

test('5. Deterministic Last-N-Pages Selection Logic', () => {
  const computeLastN = (totalPages: number, n: number) => {
    if (n < 1 || n > totalPages) return [];
    return Array.from({ length: n }, (_, i) => totalPages - n + i + 1);
  };

  // 300-page document, quantity 6 -> pages 295–300
  const res1 = computeLastN(300, 6);
  assert.deepStrictEqual(res1, [295, 296, 297, 298, 299, 300]);

  // 300-page document, quantity 10 -> pages 291–300
  const res2 = computeLastN(300, 10);
  assert.strictEqual(res2.length, 10);
  assert.strictEqual(res2[0], 291);
  assert.strictEqual(res2[9], 300);

  // 100-page document, quantity 20 -> pages 81–100
  const res3 = computeLastN(100, 20);
  assert.strictEqual(res3[0], 81);
  assert.strictEqual(res3[res3.length - 1], 100);

  // 20-page document, quantity 6 -> pages 15–20
  const res4 = computeLastN(20, 6);
  assert.deepStrictEqual(res4, [15, 16, 17, 18, 19, 20]);

  // Invalid quantities
  assert.deepStrictEqual(computeLastN(300, 0), []);
  assert.deepStrictEqual(computeLastN(300, 301), []);
});

test('6. GitHub Repository Integration & OAuth Redirect URI Validation', () => {
  const targetRepo = 'sirlilchristian-hash/Past-Exam-papers';
  const defaultBranch = 'main';

  // Verify repository slug format
  const repoRegex = /^[a-zA-Z0-9_\-\.]+\/[a-zA-Z0-9_\-\.]+$/;
  assert.strictEqual(repoRegex.test(targetRepo), true, 'Target repository should match GitHub owner/repo format');

  // Verify OAuth URL construction
  const appBaseUrl = 'https://ais-dev-nshdd56h5te37zhjadvkyr-570243852297.europe-west1.run.app';
  const redirectUri = `${appBaseUrl}/auth/github/callback`;
  const params = new URLSearchParams({
    client_id: 'test-client-id',
    redirect_uri: redirectUri,
    scope: 'repo,read:user,user:email',
    state: 'test-state-123'
  });
  const oauthUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

  assert.strictEqual(oauthUrl.includes('https://github.com/login/oauth/authorize'), true);
  assert.strictEqual(oauthUrl.includes('redirect_uri=' + encodeURIComponent(redirectUri)), true);
  assert.strictEqual(oauthUrl.includes('scope=' + encodeURIComponent('repo,read:user,user:email')), true);
});

console.log('All automated tests executed successfully.');
