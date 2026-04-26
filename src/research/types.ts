/**
 * Types for the research module.
 * Re-exports SDK types and defines custom interfaces for deep research operations.
 */

// Import Interaction type from file-search module (canonical source)
import { Interaction, TextContent } from '../file-search/FileSearchManager.js';

// Re-export for convenience
export type { Interaction, TextContent };

// Additional research-specific types
export type InteractionStatus = 'in_progress' | 'requires_action' | 'completed' | 'failed' | 'cancelled';
export type InteractionOutput = NonNullable<Interaction['outputs']>[number];

/**
 * Terminal statuses that indicate a research interaction has finished.
 */
export const TERMINAL_STATUSES: ReadonlyArray<InteractionStatus> = ['completed', 'failed', 'cancelled'];

/**
 * Checks if a status indicates the interaction has finished.
 */
export function isTerminalStatus(status: string): status is InteractionStatus {
  return TERMINAL_STATUSES.includes(status as InteractionStatus);
}

/**
 * Default Deep Research model (speed/efficiency tier).
 */
export const DEEP_RESEARCH_MODEL = 'deep-research-preview-04-2026';

/**
 * Deep Research Max model — highest-quality synthesis with extended test-time compute.
 */
export const DEEP_RESEARCH_MAX_MODEL = 'deep-research-max-preview-04-2026';

/**
 * Configuration for a remote MCP server tool.
 */
export interface McpServerConfig {
  /** Logical server name */
  name: string;
  /** MCP server URL */
  url: string;
  /** Optional headers (e.g., Authorization) sent with each MCP request */
  headers?: Record<string, string>;
  /** Optional allowlist of tool names that the agent may call on this server */
  allowedTools?: string[];
}

/**
 * Parameters for starting a deep research interaction.
 */
export interface StartResearchParams {
  /** The research query or instructions */
  input: string;
  /** The model/agent to use (defaults to DEEP_RESEARCH_MODEL) */
  model?: string;
  /** File search store names to ground the research in custom documents */
  fileSearchStoreNames?: string[];
  /** Enable Google Search grounding (default: undefined, agent decides) */
  googleSearch?: boolean;
  /** Enable URL Context tool for fetching/reading specific URLs */
  urlContext?: boolean;
  /** Enable Code Execution tool for analysis and visualization */
  codeExecution?: boolean;
  /** Remote MCP servers exposing custom tools to the agent */
  mcpServers?: McpServerConfig[];
  /** Whether to run in background mode (defaults to true) */
  background?: boolean;
}
