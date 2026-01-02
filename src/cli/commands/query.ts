/**
 * Query command - query file search stores.
 */

import { Command } from 'commander';
import { FileSearchManager } from '../../file-search/index.js';
import { output } from '../utils/output.js';
import { handleError } from '../utils/errors.js';

export function registerQueryCommand(program: Command): void {
  program
    .command('query <store> <query>')
    .description('Query a file search store')
    .option('-m, --model <model>', 'Model to use', 'gemini-2.5-flash')
    .action(async function (
      this: Command,
      storeName: string,
      query: string,
      options: { model: string }
    ) {
      const { client, outputContext } = this.ctx!;
      const manager = new FileSearchManager(client);

      try {
        const interaction = await manager.queryStore(storeName, query, options.model);

        output(outputContext, interaction, () => {
          // Extract text content from outputs
          const outputs = interaction.outputs ?? [];
          const textParts: string[] = [];

          for (const item of outputs) {
            if (item.type === 'text' && item.text) {
              textParts.push(item.text);
            }
          }

          if (textParts.length === 0) {
            return 'No text response received.';
          }

          return textParts.join('\n\n');
        });
      } catch (err) {
        handleError(outputContext, err);
      }
    });
}
