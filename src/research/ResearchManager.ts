/**
 * ResearchManager - Manages deep research interactions with Google's Gemini API.
 * Provides methods to start, monitor, and control long-running research tasks.
 */
import { GoogleGenAI } from '@google/genai';
import { Interaction, StartResearchParams, TERMINAL_STATUSES, InteractionStatus } from './types.js';

const DEFAULT_MODEL = 'deep-research-pro-preview-12-2025';
const DEFAULT_POLL_INTERVAL_MS = 5000;

/**
 * Manages deep research interactions with the Gemini API.
 */
export class ResearchManager {
  constructor(private client: GoogleGenAI) {}

  /**
   * Starts a new deep research interaction.
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

    return (await this.client.interactions.create({
      input,
      agent: model,
      background,
      tools,
    })) as Interaction;
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
