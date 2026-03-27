import Retell from 'retell-sdk';

export function getRetellClient() {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    throw new Error('RETELL_API_KEY environment variable is required');
  }
  return new Retell({ apiKey });
}
