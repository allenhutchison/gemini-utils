/**
 * Stores command - manage file search stores.
 */

import { Command } from 'commander';
import { FileSearchManager } from '../../file-search/index.js';
import { output, formatTable } from '../utils/output.js';
import { handleError } from '../utils/errors.js';

export function registerStoresCommands(program: Command): void {
  const stores = program
    .command('stores')
    .description('Manage file search stores');

  // stores create <name>
  stores
    .command('create <name>')
    .description('Create a new file search store')
    .action(async function (this: Command, name: string) {
      const { client, outputContext } = this.ctx!;
      const manager = new FileSearchManager(client);

      try {
        const store = await manager.createStore(name);
        output(outputContext, store, () => `Created store: ${store.name}`);
      } catch (err) {
        handleError(outputContext, err);
      }
    });

  // stores list
  stores
    .command('list')
    .description('List all file search stores')
    .action(async function (this: Command) {
      const { client, outputContext } = this.ctx!;
      const manager = new FileSearchManager(client);

      try {
        const pager = await manager.listStores();
        const storesList: Array<{ name?: string; displayName?: string; createTime?: string }> = [];
        for await (const store of pager) {
          storesList.push(store);
        }

        output(outputContext, storesList, () => {
          if (storesList.length === 0) {
            return 'No stores found.';
          }
          return formatTable(
            ['Name', 'Display Name', 'Created'],
            storesList.map((s) => [
              s.name ?? '',
              s.displayName ?? '',
              s.createTime ?? '',
            ])
          );
        });
      } catch (err) {
        handleError(outputContext, err);
      }
    });

  // stores get <name>
  stores
    .command('get <name>')
    .description('Get details of a file search store')
    .action(async function (this: Command, name: string) {
      const { client, outputContext } = this.ctx!;
      const manager = new FileSearchManager(client);

      try {
        const store = await manager.getStore(name);
        output(outputContext, store, () => {
          const lines = [
            `Name: ${store.name}`,
            `Display Name: ${store.displayName}`,
            `Created: ${store.createTime}`,
          ];
          return lines.join('\n');
        });
      } catch (err) {
        handleError(outputContext, err);
      }
    });

  // stores delete <name>
  stores
    .command('delete <name>')
    .description('Delete a file search store')
    .option('-f, --force', 'Force delete even if store contains documents')
    .action(async function (this: Command, name: string, options: { force?: boolean }) {
      const { client, outputContext } = this.ctx!;
      const manager = new FileSearchManager(client);

      try {
        await manager.deleteStore(name, options.force);
        output(outputContext, { deleted: name }, () => `Deleted store: ${name}`);
      } catch (err) {
        handleError(outputContext, err);
      }
    });
}
