import { describe, expect, it } from 'vitest';
import { web3formsBody } from '../../src/site/scripts/web3forms';

describe('the Contact form through Web3Forms (plan stage 11.3)', () => {
  const f = { name: 'Grace Hopper', email: 'grace@example.com', message: 'Hello.' };
  it('sends the key, the name, the email and the message, with a subject that says what it is', () => {
    expect(web3formsBody('k', f, null)).toEqual({ access_key: 'k', subject: 'A message from Grace Hopper', from_name: 'Grace Hopper', name: 'Grace Hopper', email: 'grace@example.com', message: 'Hello.' });
    expect(web3formsBody('k', f, 'work').subject).toBe('Grace Hopper asks for access to work');
    expect(web3formsBody('k', f, '').subject).toBe('Grace Hopper asks for access');
  });
});
