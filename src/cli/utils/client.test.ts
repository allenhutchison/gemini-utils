import { describe, it, expect } from '@jest/globals';
import { createClient, GEMINI_API_VERSION } from './client.js';

describe('createClient', () => {
  it('pins the Gemini API version to v1beta', () => {
    const client = createClient('test-key') as unknown as {
      apiClient: { getApiVersion(): string; isVertexAI(): boolean };
    };
    expect(GEMINI_API_VERSION).toBe('v1beta');
    expect(client.apiClient.getApiVersion()).toBe('v1beta');
    expect(client.apiClient.isVertexAI()).toBe(false);
  });
});
