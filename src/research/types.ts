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
 * Parameters for starting a deep research interaction.
 */
export interface StartResearchParams {
  /** The research query or instructions */
  input: string;
  /** The model/agent to use (defaults to 'deep-research-pro-preview-12-2025') */
  model?: string;
  /** Optional file search store names for grounding */
  fileSearchStoreNames?: string[];
  /** Whether to run in background mode (defaults to true) */
  background?: boolean;
}
