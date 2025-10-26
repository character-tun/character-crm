describe('telegramNotify — sendMessage', () => {
  const ORIG_ENV = { ...process.env };
  let requestMock;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIG_ENV };
    // Default: clear env
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.NOTIFY_DRY_RUN;
    requestMock = undefined;
  });

  afterAll(() => {
    process.env = ORIG_ENV;
  });

  test('returns CONFIG_MISSING when token or chatId not set', async () => {
    const { sendMessage } = require('../services/telegramNotify');
    const res = await sendMessage('hello');
    expect(res).toEqual({ ok: false, reason: 'CONFIG_MISSING' });
  });

  test('DRY_RUN=1 skips sending and returns ok:true', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'tkn';
    process.env.TELEGRAM_CHAT_ID = 'chat';
    process.env.NOTIFY_DRY_RUN = '1';

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const { sendMessage } = require('../services/telegramNotify');

    const res = await sendMessage('ping');
    expect(res).toEqual({ ok: true, dryRun: true });

    logSpy.mockRestore();
  });

  test('success flow: https.request returns {ok:true}', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'abc';
    process.env.TELEGRAM_CHAT_ID = '123';

    // Mock https.request to simulate a successful JSON response
    jest.doMock('https', () => ({
      request: jest.fn((options, cb) => {
        // Validate endpoint
        expect(options.hostname).toBe('api.telegram.org');
        expect(options.path).toContain('/botabc/sendMessage');
        const res = {
          on: (event, handler) => {
            if (event === 'data') handler(JSON.stringify({ ok: true, result: {} }));
            if (event === 'end') handler();
          },
        };
        cb(res);
        return {
          write: jest.fn(() => {}),
          end: jest.fn(() => {}),
          on: jest.fn(),
        };
      }),
    }));

    const { sendMessage } = require('../services/telegramNotify');
    const res = await sendMessage('test');
    expect(res).toEqual({ ok: true });
  });

  test('error response: https returns ok:false JSON', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'abc';
    process.env.TELEGRAM_CHAT_ID = '123';

    jest.doMock('https', () => ({
      request: jest.fn((options, cb) => {
        const res = {
          on: (event, handler) => {
            if (event === 'data') handler(JSON.stringify({ ok: false, error: 'bad' }));
            if (event === 'end') handler();
          },
        };
        cb(res);
        return {
          write: jest.fn(() => {}),
          end: jest.fn(() => {}),
          on: jest.fn(),
        };
      }),
    }));

    const { sendMessage } = require('../services/telegramNotify');
    const res = await sendMessage('err');
    expect(res.ok).toBe(false);
    expect(res.response).toEqual({ ok: false, error: 'bad' });
  });

  test('network error: request emits error and promise rejects', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'abc';
    process.env.TELEGRAM_CHAT_ID = '123';

    jest.doMock('https', () => ({
      request: jest.fn((options, cb) => {
        cb({ on: jest.fn() });
        const handlers = {};
        const req = {
          write: jest.fn(() => {}),
          end: jest.fn(() => {}),
          on: jest.fn((event, fn) => { handlers[event] = fn; }),
        };
        // Emit error on next tick after consumer attaches handlers
        process.nextTick(() => { if (handlers.error) handlers.error(new Error('net fail')); });
        return req;
      }),
    }));

    const { sendMessage } = require('../services/telegramNotify');
    await expect(sendMessage('boom')).rejects.toBeInstanceOf(Error);
  });
});