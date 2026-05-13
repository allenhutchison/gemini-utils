import { GoogleGenAI, Interactions } from '@google/genai';

// Re-export SDK interaction types for consumers
export type Interaction = Interactions.Interaction;
export type TextContent = Interactions.TextContent;

/**
 * Represents a document in a file search store.
 * Structure based on the @google/genai SDK response format.
 */
export interface FileSearchDocument {
  /** Full resource name of the document (e.g., "documents/123") */
  name?: string;
  /** Display name of the document */
  displayName?: string;
  /** Custom metadata attached to the document */
  customMetadata?: Array<{
    key?: string;
    stringValue?: string;
    numericValue?: number;
  }>;
}

/**
 * Manages file search stores in Google's Gemini API.
 * Provides CRUD operations for stores and documents.
 */
export class FileSearchManager {
  constructor(private client: GoogleGenAI) {}

  /**
   * Creates a new file search store.
   */
  async createStore(displayName: string) {
    return await this.client.fileSearchStores.create({
      config: {
        displayName,
      },
    });
  }

  /**
   * Lists all file search stores.
   */
  async listStores() {
    return await this.client.fileSearchStores.list();
  }

  /**
   * Gets a file search store by name.
   */
  async getStore(name: string) {
    return await this.client.fileSearchStores.get({ name });
  }

  /**
   * Deletes a file search store.
   * @param name - Store resource name
   * @param force - If true, deletes even if store contains documents
   */
  async deleteStore(name: string, force: boolean = false) {
    return await this.client.fileSearchStores.delete({ name, config: { force } });
  }

  /**
   * Queries a file search store using the Gemini model.
   * @param storeName - Store resource name
   * @param query - Search query
   * @param model - Model to use for the query (default: gemini-2.5-flash)
   * @returns The interaction response containing query results
   */
  async queryStore(storeName: string, query: string, model: string = 'gemini-2.5-flash'): Promise<Interaction> {
    return await this.client.interactions.create({
      model,
      input: query,
      tools: [
        {
          type: 'file_search',
          file_search_store_names: [storeName],
        },
      ],
    });
  }

  /**
   * Lists all documents in a file search store.
   * Handles pagination automatically to retrieve all documents.
   */
  async listDocuments(storeName: string): Promise<FileSearchDocument[]> {
    const allDocuments: FileSearchDocument[] = [];
    const pager = await this.client.fileSearchStores.documents.list({
      parent: storeName,
      config: { pageSize: 20 },
    });

    // Iterate through all pages
    for await (const document of pager) {
      allDocuments.push(document);
    }

    return allDocuments;
  }

  /**
   * Gets a single document by name.
   */
  async getDocument(documentName: string): Promise<FileSearchDocument> {
    return await this.client.fileSearchStores.documents.get({ name: documentName });
  }

  /**
   * Deletes a document from a file search store.
   */
  async deleteDocument(documentName: string): Promise<void> {
    await this.client.fileSearchStores.documents.delete({ name: documentName });
  }
}
