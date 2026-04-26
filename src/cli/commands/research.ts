/**
 * Research command - manage deep research interactions.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import {
  DEEP_RESEARCH_MAX_MODEL,
  DEEP_RESEARCH_MODEL,
  InteractionOutput,
  McpServerConfig,
  ReportGenerator,
  ResearchManager,
} from '../../research/index.js';
import { output, OutputContext, outputError } from '../utils/output.js';
import { handleError, ExitCode } from '../utils/errors.js';
import { validatePositiveInteger } from '../utils/validation.js';

/**
 * Parses --mcp flags of the form "name=label,url=https://..."
 * or "label,https://...". Multiple --mcp flags accumulate.
 */
function parseMcpServers(values: string[] | undefined): McpServerConfig[] | undefined {
  if (!values?.length) return undefined;
  const servers: McpServerConfig[] = [];
  for (const raw of values) {
    const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
    let name: string | undefined;
    let url: string | undefined;
    const allowedTools: string[] = [];
    const headers: Record<string, string> = {};

    for (const part of parts) {
      const eq = part.indexOf('=');
      if (eq === -1) {
        // Positional: first is name, second is url
        if (!name) name = part;
        else if (!url) url = part;
        continue;
      }
      const key = part.slice(0, eq).trim();
      const value = part.slice(eq + 1).trim();
      if (key === 'name' || key === 'label') name = value;
      else if (key === 'url') url = value;
      else if (key === 'tool' || key === 'tools') {
        allowedTools.push(...value.split('|').map((t) => t.trim()).filter(Boolean));
      } else if (key.startsWith('header.')) {
        headers[key.slice('header.'.length)] = value;
      }
    }

    if (!name || !url) {
      throw new Error(
        `Invalid --mcp value "${raw}". Expected "<name>,<url>" or "name=<n>,url=<u>".`
      );
    }
    const server: McpServerConfig = { name, url };
    if (allowedTools.length) server.allowedTools = allowedTools;
    if (Object.keys(headers).length) server.headers = headers;
    servers.push(server);
  }
  return servers;
}

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
    .option('-m, --model <model>', 'Model to use', DEEP_RESEARCH_MODEL)
    .option('--max', `Use the Deep Research Max model (${DEEP_RESEARCH_MAX_MODEL})`)
    .option('--stores <names>', 'File search store names (comma-separated)')
    .option('--google-search', 'Enable Google Search tool')
    .option('--url-context', 'Enable URL Context tool')
    .option('--code-execution', 'Enable Code Execution tool')
    .option(
      '--mcp <config>',
      'Add an MCP server, e.g. "name=docs,url=https://mcp.example.com" (repeatable)',
      (value: string, prev: string[] = []) => [...prev, value],
      [] as string[]
    )
    .option('-w, --wait', 'Wait for completion')
    .option('-o, --output <file>', 'Write markdown report to file (requires --wait)')
    .action(async function (
      this: Command,
      query: string,
      options: {
        model: string;
        max?: boolean;
        stores?: string;
        googleSearch?: boolean;
        urlContext?: boolean;
        codeExecution?: boolean;
        mcp?: string[];
        wait?: boolean;
        output?: string;
      }
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
        const mcpServers = parseMcpServers(options.mcp);
        const model = options.max ? DEEP_RESEARCH_MAX_MODEL : options.model;

        const interaction = await researcher.startResearch({
          input: query,
          model,
          fileSearchStoreNames,
          googleSearch: options.googleSearch,
          urlContext: options.urlContext,
          codeExecution: options.codeExecution,
          mcpServers,
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
