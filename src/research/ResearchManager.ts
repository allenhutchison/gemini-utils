/**
 * ResearchManager - Manages deep research interactions with Google's Gemini API.
 * Provides methods to start, monitor, and control long-running research tasks.
 */
import { GoogleGenAI } from '@google/genai';
import { Interaction, StartResearchParams, TERMINAL_STATUSES, InteractionStatus } from './types.js';

const DEFAULT_MODEL = 'deep-research-pro-preview-12-2025';
const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 1000;

/**
 * Manages deep research interactions with the Gemini API.
 */
export class ResearchManager {
  constructor(private client: GoogleGenAI) {}

  /**
   * Determines if an error is a quota/billing error (not retryable)
   * vs a transient rate limit (retryable).
   */
  private isQuotaError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.toLowerCase().includes('quota') ||
      message.toLowerCase().includes('billing') ||
      message.toLowerCase().includes('not enabled');
  }

  /**
   * Determines if an error is a transient rate-limit that may succeed on retry.
   */
  private isRetryableError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const is429 = message.includes('429');
    // 429s caused by quota/billing issues should not be retried
    if (is429 && this.isQuotaError(error)) return false;
    // Retry on transient 429s, 503s, and network errors
    return is429 ||
      message.includes('503') ||
      message.toLowerCase().includes('econnreset') ||
      message.toLowerCase().includes('etimedout');
  }

  /**
   * Starts a new deep research interaction with automatic retry for transient errors.
   * @param params - Research configuration
   * @returns The created interaction
   */
  async startResearch(params: StartResearchParams): Promise<Interaction> {
    const {
      input,
      model = DEFAULT_MODEL,
      fileSearchStoreNames,
      background = true,
    } = params;

    // Build file search tools if store names provided
    const tools = fileSearchStoreNames?.length
      ? [
          {
            type: 'file_search' as const,
            file_search_store_names: fileSearchStoreNames,
          },
        ]
      : undefined;

    let lastError: unknown;
    for (let attempt = 0; attempt <= DEFAULT_MAX_RETRIES; attempt++) {
      try {
        return (await this.client.interactions.create({
          input,
          agent: model,
          background,
          tools,
        })) as Interaction;
      } catch (error: unknown) {
        lastError = error;

        // Don't retry non-retryable errors
        if (!this.isRetryableError(error) || attempt === DEFAULT_MAX_RETRIES) {
          throw error;
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = DEFAULT_INITIAL_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Gets the current status of a research interaction.
   * @param id - The interaction ID
   * @returns The interaction with current status and any outputs
   */
  async getStatus(id: string): Promise<Interaction> {
    return (await this.client.interactions.get(id)) as Interaction;
  }

  /**
   * Cancels a running research interaction.
   * @param id - The interaction ID
   * @returns The cancelled interaction
   */
  async cancel(id: string): Promise<Interaction> {
    return (await this.client.interactions.cancel(id)) as Interaction;
  }

  /**
   * Deletes a research interaction.
   * @param id - The interaction ID
   * @returns The deleted interaction
   */
  async delete(id: string): Promise<Interaction> {
    return (await this.client.interactions.delete(id)) as Interaction;
  }

  /**
   * Polls a research interaction until it reaches a terminal state.
   * @param id - The interaction ID
   * @param intervalMs - Poll interval in milliseconds (default: 5000)
   * @returns The completed, failed, or cancelled interaction
   */
  async poll(id: string, intervalMs: number = DEFAULT_POLL_INTERVAL_MS): Promise<Interaction> {
    while (true) {
      const interaction = await this.getStatus(id);
      const status = interaction.status as InteractionStatus;

      if (TERMINAL_STATUSES.includes(status)) {
        return interaction;
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}
