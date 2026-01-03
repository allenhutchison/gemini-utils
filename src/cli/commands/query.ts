/**
 * Query command - query file search stores.
 */

import { Command } from 'commander';
import { FileSearchManager } from '../../file-search/index.js';
import { output } from '../utils/output.js';
import { handleError } from '../utils/errors.js';

/**
 * Annotation on text content with optional source citation.
 */
interface TextAnnotation {
  source?: string;
  start_index?: number;
  end_index?: number;
}

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
          // Extract text content and citations from outputs
          const outputs = interaction.outputs ?? [];
          const textParts: string[] = [];
          const citations = new Set<string>();

          for (const item of outputs) {
            if (item.type === 'text' && item.text) {
              textParts.push(item.text);

              // Extract citation sources from annotations
              const annotations = (item as { annotations?: TextAnnotation[] }).annotations;
              if (annotations) {
                for (const annotation of annotations) {
                  if (annotation.source) {
                    citations.add(annotation.source);
                  }
                }
              }
            }
          }

          if (textParts.length === 0) {
            return 'No text response received.';
          }

          let result = textParts.join('\n\n');

          // Append citations section if any were found
          if (citations.size > 0) {
            result += '\n\n### Citations\n';
            for (const source of citations) {
              result += `- ${source}\n`;
            }
          }

          return result;
        });
      } catch (err) {
        handleError(outputContext, err);
      }
    });
}
