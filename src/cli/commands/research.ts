/**
 * Research command - manage deep research interactions.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import { ResearchManager, ReportGenerator, InteractionOutput } from '../../research/index.js';
import { output, OutputContext, outputError } from '../utils/output.js';
import { handleError, ExitCode } from '../utils/errors.js';
import { validatePositiveInteger } from '../utils/validation.js';

/**
 * Writes a markdown report to a file.
 */
async function writeReport(
  outputPath: string,
  outputs: InteractionOutput[],
  outputContext: OutputContext
): Promise<void> {
  const generator = new ReportGenerator();
  const markdown = generator.generateMarkdown(outputs);
  await fs.promises.writeFile(outputPath, markdown);
  if (!outputContext.quiet && !outputContext.json) {
    console.log(`Report saved to: ${outputPath}`);
  }
}

export function registerResearchCommands(program: Command): void {
  const research = program
    .command('research')
    .description('Manage deep research interactions');

  // research start <query>
  research
    .command('start <query>')
    .description('Start a new deep research task')
    .option('-m, --model <model>', 'Model to use', 'deep-research-pro-preview-12-2025')
    .option('--stores <names>', 'File search store names (comma-separated)')
    .option('-w, --wait', 'Wait for completion')
    .option('-o, --output <file>', 'Write markdown report to file (requires --wait)')
    .action(async function (
      this: Command,
      query: string,
      options: { model: string; stores?: string; wait?: boolean; output?: string }
    ) {
      const { client, outputContext } = this.ctx!;
      const researcher = new ResearchManager(client);

      // Validate that --output requires --wait
      if (options.output && !options.wait) {
        outputError(
          outputContext,
          '--output requires --wait flag to be set',
          ExitCode.MISSING_ARGUMENT
        );
      }

      try {
        const fileSearchStoreNames = options.stores?.split(',').map((s) => s.trim());

        const interaction = await researcher.startResearch({
          input: query,
          model: options.model,
          fileSearchStoreNames,
        });

        if (!options.wait) {
          output(outputContext, interaction, () =>
            `Started research: ${interaction.id}\nStatus: ${interaction.status}`
          );
          return;
        }

        // Wait for completion
        if (!outputContext.quiet && !outputContext.json) {
          console.log(`Started research: ${interaction.id}`);
          console.log('Waiting for completion...');
        }

        const completed = await researcher.poll(interaction.id);

        // Generate report if output file specified
        if (options.output && completed.outputs) {
          await writeReport(options.output, completed.outputs, outputContext);
        }

        output(outputContext, completed, () => {
          const lines = [
            `Research complete: ${completed.id}`,
            `Status: ${completed.status}`,
          ];
          if (completed.outputs?.length) {
            lines.push(`Outputs: ${completed.outputs.length} items`);
          }
          return lines.join('\n');
        });
      } catch (err) {
        handleError(outputContext, err);
      }
    });

  // research status <id>
  research
    .command('status <id>')
    .description('Get status of a research task')
    .action(async function (this: Command, id: string) {
      const { client, outputContext } = this.ctx!;
      const researcher = new ResearchManager(client);

      try {
        const interaction = await researcher.getStatus(id);
        output(outputContext, interaction, () => {
          const lines = [
            `ID: ${interaction.id}`,
            `Status: ${interaction.status}`,
          ];
          if (interaction.outputs?.length) {
            lines.push(`Outputs: ${interaction.outputs.length} items`);
          }
          return lines.join('\n');
        });
      } catch (err) {
        handleError(outputContext, err);
      }
    });

  // research poll <id>
  research
    .command('poll <id>')
    .description('Poll until research completes')
    .option('--interval <ms>', 'Poll interval in milliseconds', '5000')
    .option('-o, --output <file>', 'Write markdown report to file')
    .action(async function (
      this: Command,
      id: string,
      options: { interval: string; output?: string }
    ) {
      const { client, outputContext } = this.ctx!;
      const researcher = new ResearchManager(client);

      try {
        const intervalMs = validatePositiveInteger(
          options.interval,
          5000,
          'interval',
          outputContext
        );

        // Show progress
        if (!outputContext.quiet && !outputContext.json) {
          console.log('Polling for completion...');
        }

        const completed = await researcher.poll(id, intervalMs);

        // Generate report if output file specified
        if (options.output && completed.outputs) {
          await writeReport(options.output, completed.outputs, outputContext);
        }

        output(outputContext, completed, () => {
          const lines = [
            `Research complete: ${completed.id}`,
            `Status: ${completed.status}`,
          ];
          if (completed.outputs?.length) {
            lines.push(`Outputs: ${completed.outputs.length} items`);
          }
          return lines.join('\n');
        });
      } catch (err) {
        handleError(outputContext, err);
      }
    });

  // research cancel <id>
  research
    .command('cancel <id>')
    .description('Cancel a running research task')
    .action(async function (this: Command, id: string) {
      const { client, outputContext } = this.ctx!;
      const researcher = new ResearchManager(client);

      try {
        const interaction = await researcher.cancel(id);
        output(outputContext, interaction, () => `Cancelled research: ${id}`);
      } catch (err) {
        handleError(outputContext, err);
      }
    });

  // research delete <id>
  research
    .command('delete <id>')
    .description('Delete a research task')
    .action(async function (this: Command, id: string) {
      const { client, outputContext } = this.ctx!;
      const researcher = new ResearchManager(client);

      try {
        await researcher.delete(id);
        output(outputContext, { deleted: id }, () => `Deleted research: ${id}`);
      } catch (err) {
        handleError(outputContext, err);
      }
    });
}
