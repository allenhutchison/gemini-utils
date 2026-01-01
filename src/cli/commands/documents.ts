/**
 * Documents command - manage documents in file search stores.
 */

import { Command } from 'commander';
import { FileSearchManager } from '../../file-search/index.js';
import { output, formatTable } from '../utils/output.js';
import { handleError } from '../utils/errors.js';

export function registerDocumentsCommands(program: Command): void {
  const documents = program
    .command('documents')
    .description('Manage documents in file search stores');

  // documents list <store>
  documents
    .command('list <store>')
    .description('List all documents in a store')
    .action(async function (this: Command, storeName: string) {
      const { client, outputContext } = this.ctx!;
      const manager = new FileSearchManager(client);

      try {
        const docs = await manager.listDocuments(storeName);

        output(outputContext, docs, () => {
          if (docs.length === 0) {
            return 'No documents found.';
          }
          return formatTable(
            ['Name', 'Display Name'],
            docs.map((d) => [
              d.name ?? '',
              d.displayName ?? '',
            ])
          );
        });
      } catch (err) {
        handleError(outputContext, err);
      }
    });

  // documents get <name>
  documents
    .command('get <name>')
    .description('Get details of a document')
    .action(async function (this: Command, name: string) {
      const { client, outputContext } = this.ctx!;
      const manager = new FileSearchManager(client);

      try {
        const doc = await manager.getDocument(name);
        output(outputContext, doc, () => {
          const lines = [
            `Name: ${doc.name}`,
            `Display Name: ${doc.displayName}`,
          ];
          if (doc.customMetadata) {
            lines.push(`Metadata: ${JSON.stringify(doc.customMetadata)}`);
          }
          return lines.join('\n');
        });
      } catch (err) {
        handleError(outputContext, err);
      }
    });

  // documents delete <name>
  documents
    .command('delete <name>')
    .description('Delete a document')
    .action(async function (this: Command, name: string) {
      const { client, outputContext } = this.ctx!;
      const manager = new FileSearchManager(client);

      try {
        await manager.deleteDocument(name);
        output(outputContext, { deleted: name }, () => `Deleted document: ${name}`);
      } catch (err) {
        handleError(outputContext, err);
      }
    });
}
