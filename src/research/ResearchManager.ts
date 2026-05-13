/**
 * ResearchManager - Manages deep research interactions with Google's Gemini API.
 * Provides methods to start, monitor, and control long-running research tasks.
 */
import { GoogleGenAI, Interactions } from '@google/genai';
import {
  DEEP_RESEARCH_MODEL,
  Interaction,
  InteractionOutput,
  InteractionStatus,
  McpServerConfig,
  StartResearchParams,
  TERMINAL_STATUSES,
} from './types.js';

const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 1000;

type ResearchTool = Interactions.Tool;
type ModelOutputStep = Interactions.ModelOutputStep;

/**
 * Extracts the model's output content (text, images, etc.) from an interaction.
 * In SDK v2, output content lives inside `model_output` steps rather than a
 * top-level `outputs` array. This helper flattens those steps back into the
 * v1-equivalent `InteractionOutput[]` shape that downstream code consumes.
 */
export function extractOutputs(interaction: Interaction): InteractionOutput[] {
  return (interaction.steps ?? [])
    .filter((step): step is ModelOutputStep => step.type === 'model_output')
    .flatMap((step) => step.content ?? []);
}

/**
 * Builds the tools array sent to the Interactions API from research params.
 * Returns undefined when no tools are configured (lets the agent use its defaults).
 */
export function buildResearchTools(params: {
  fileSearchStoreNames?: string[];
  googleSearch?: boolean;
  urlContext?: boolean;
  codeExecution?: boolean;
  mcpServers?: McpServerConfig[];
}): ResearchTool[] | undefined {
  const tools: ResearchTool[] = [];

  if (params.fileSearchStoreNames?.length) {
    tools.push({
      type: 'file_search',
      file_search_store_names: params.fileSearchStoreNames,
    });
  }
  if (params.googleSearch) tools.push({ type: 'google_search' });
  if (params.urlContext) tools.push({ type: 'url_context' });
  if (params.codeExecution) tools.push({ type: 'code_execution' });

  if (params.mcpServers?.length) {
    for (const server of params.mcpServers) {
      const tool: Interactions.Tool.MCPServer = {
        type: 'mcp_server',
        name: server.name,
        url: server.url,
      };
      if (server.headers) tool.headers = server.headers;
      if (server.allowedTools?.length) {
        tool.allowed_tools = [{ tools: server.allowedTools }];
      }
      tools.push(tool);
    }
  }

  return tools.length ? tools : undefined;
}

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
      model = DEEP_RESEARCH_MODEL,
      fileSearchStoreNames,
      googleSearch,
      urlContext,
      codeExecution,
      mcpServers,
      background = true,
    } = params;

    const tools = buildResearchTools({
      fileSearchStoreNames,
      googleSearch,
      urlContext,
      codeExecution,
      mcpServers,
    });

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
