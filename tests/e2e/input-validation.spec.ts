import {test, expect} from '@playwright/test';

// docs/TEST_PLAN.md §3: every API route rejects malformed/oversized/
// wrong-type input with 400, never 500, and the response is always
// well-formed JSON — never a raw stack trace or HTML error page.

async function expectClean400(response: {
  status(): number;
  json(): Promise<unknown>;
}) {
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body).toHaveProperty('error');
  expect(typeof (body as {error: unknown}).error).toBe('string');
}

test.describe('/api/profile input validation', () => {
  test('rejects an invalid level enum value', async ({request}) => {
    await expectClean400(
      await request.post('/api/profile', {data: {level: 'EXPERT'}}),
    );
  });

  test('rejects a wrong-type field', async ({request}) => {
    await expectClean400(
      await request.post('/api/profile', {data: {goal: 12345}}),
    );
  });

  test('rejects an oversized goal string', async ({request}) => {
    await expectClean400(
      await request.post('/api/profile', {data: {goal: 'x'.repeat(5000)}}),
    );
  });

  test('rejects a non-object body', async ({request}) => {
    const response = await request.post('/api/profile', {
      data: 'not an object',
    });
    expect(response.status()).toBe(400);
  });

  test('rejects malformed JSON without crashing', async ({request}) => {
    const response = await request.post('/api/profile', {
      headers: {'Content-Type': 'application/json'},
      data: '{not valid json',
    });
    // request.json().catch(() => null) in the route turns this into a
    // schema failure, not an unhandled exception — still a clean 400.
    expect(response.status()).toBe(400);
  });
});

test.describe('/api/chat input validation', () => {
  test('rejects an empty message', async ({request}) => {
    await expectClean400(
      await request.post('/api/chat', {data: {message: ''}}),
    );
  });

  test('rejects an oversized message', async ({request}) => {
    await expectClean400(
      await request.post('/api/chat', {data: {message: 'x'.repeat(5000)}}),
    );
  });

  test('rejects a wrong-type message field', async ({request}) => {
    await expectClean400(
      await request.post('/api/chat', {data: {message: 42}}),
    );
  });

  test('rejects an oversized history array', async ({request}) => {
    const history = Array.from({length: 50}, () => ({
      role: 'user',
      content: 'hi',
    }));
    await expectClean400(
      await request.post('/api/chat', {data: {message: 'hello', history}}),
    );
  });
});

test.describe('/api/progress input validation', () => {
  test('rejects an invalid status enum', async ({request}) => {
    await request.post('/api/profile', {data: {goal: 'Learn something'}});
    await expectClean400(
      await request.post('/api/progress', {
        data: {courseId: 'python-for-absolute-beginners', status: 'DONE'},
      }),
    );
  });

  test('rejects a missing courseId', async ({request}) => {
    await request.post('/api/profile', {data: {goal: 'Learn something'}});
    await expectClean400(
      await request.post('/api/progress', {data: {status: 'COMPLETE'}}),
    );
  });
});

test.describe('/api/explain input validation', () => {
  test('rejects a missing courseId', async ({request}) => {
    await request.post('/api/profile', {data: {goal: 'Learn something'}});
    await expectClean400(await request.post('/api/explain', {data: {}}));
  });
});
