#!/usr/bin/env npx tsx
/**
 * Manual MIME Type Validation Suite
 *
 * This script validates all MIME type mappings against the real Gemini File Search API.
 * It creates a temporary test store, uploads sample files for each supported extension,
 * and then cleans up by deleting the test store.
 *
 * Usage:
 *   npm run test:mime-types
 *   npx tsx scripts/test-mime-types.ts
 *
 * Environment:
 *   GEMINI_API_KEY - Required Gemini API key
 *
 * Output:
 *   - Console report with summary of passed/failed MIME types
 *   - JSON report saved to scripts/mime-type-validation-report.json
 */

import { GoogleGenAI } from '@google/genai';
import {
  FileUploader,
  FileSearchManager,
  getSupportedExtensions,
  EXTENSION_TO_MIME,
} from '../src/index.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM equivalents for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestResult {
  extension: string;
  mimeType: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  duration?: number;
}

interface TestReport {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  results: TestResult[];
  duration: number;
}

class MimeTypeValidator {
  private client: GoogleGenAI;
  private uploader: FileUploader;
  private testStoreName: string;
  private results: TestResult[] = [];
  private sampleDir: string;
  private startTime: number = 0;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
    this.uploader = new FileUploader(this.client);
    this.testStoreName = '';
    this.sampleDir = path.join(__dirname, 'sample-files');
  }

  /**
   * Creates a test file search store
   */
  private async createTestStore(): Promise<string> {
    const displayName = 'mime-type-test-store';
    const manager = new FileSearchManager(this.client);

    try {
      console.log(`Creating test file search store...`);
      const store = await manager.createStore(displayName);
      this.testStoreName = store.name!;
      console.log(`✓ Test store created: ${this.testStoreName}\n`);
      return this.testStoreName;
    } catch (error: unknown) {
      const errorMessage = (error as Error)?.message ?? String(error);
      const isAlreadyExists = errorMessage.includes('already exists') || errorMessage.includes('ALREADY_EXISTS');

      if (!isAlreadyExists) {
        throw error;
      }

      // Store already exists - find it by listing stores and matching displayName
      console.log(`Store already exists. Looking up existing store...`);
      try {
        const storesResponse = await manager.listStores();
        const stores = storesResponse?.fileSearchStores ?? [];
        const existingStore = stores.find((s) => s.displayName === displayName);

        if (existingStore?.name) {
          this.testStoreName = existingStore.name;
          console.log(`✓ Found existing store: ${this.testStoreName}\n`);
          return this.testStoreName;
        }

        // Store exists but couldn't find it - this shouldn't happen
        throw new Error(`Store '${displayName}' exists but could not be found in store list`);
      } catch (listError: unknown) {
        const listErrorMessage = (listError as Error)?.message ?? String(listError);
        throw new Error(`Failed to retrieve existing store: ${listErrorMessage}`);
      }
    }
  }

  /**
   * Deletes the test file search store
   */
  private async deleteTestStore(): Promise<void> {
    try {
      console.log(`\nCleaning up test store: ${this.testStoreName}...`);
      const manager = new FileSearchManager(this.client);
      await manager.deleteStore(this.testStoreName, true); // force delete
      console.log(`✓ Test store deleted successfully`);
    } catch (error: any) {
      console.error(`Warning: Failed to delete test store: ${error.message}`);
    }
  }

  /**
   * Validates all MIME types by testing each supported extension
   */
  async validateAllMimeTypes(): Promise<TestReport> {
    this.startTime = Date.now();
    const extensions = getSupportedExtensions();

    console.log(`\n${'='.repeat(60)}`);
    console.log('MIME Type Validation Suite');
    console.log(`${'='.repeat(60)}\n`);
    console.log(`Testing ${extensions.length} MIME types against ${this.testStoreName}\n`);

    try {
      // Create test store
      await this.createTestStore();

      // Ensure sample directory exists
      if (!fs.existsSync(this.sampleDir)) {
        fs.mkdirSync(this.sampleDir, { recursive: true });
      }

      // Test each extension
      let progressCount = 0;
      for (const ext of extensions) {
        progressCount++;
        process.stdout.write(`\rProgress: ${progressCount}/${extensions.length} (${Math.round((progressCount / extensions.length) * 100)}%)`);
        await this.testExtension(ext);
      }

      console.log('\n'); // New line after progress
    } finally {
      // Clean up sample directory
      if (fs.existsSync(this.sampleDir)) {
        fs.rmSync(this.sampleDir, { recursive: true, force: true });
      }

      // Delete test store
      await this.deleteTestStore();
    }

    const duration = Date.now() - this.startTime;
    const report = this.generateReport(duration);
    this.printReport(report);

    return report;
  }

  /**
   * Tests a single extension by creating a sample file and uploading it
   */
  private async testExtension(ext: string): Promise<void> {
    const mimeType = EXTENSION_TO_MIME[ext];
    const testFilePath = this.createSampleFile(ext);
    const testStart = Date.now();

    try {
      await this.uploader.uploadFile(testFilePath, this.testStoreName);

      this.results.push({
        extension: ext,
        mimeType,
        status: 'pass',
        message: 'Upload successful',
        duration: Date.now() - testStart,
      });
    } catch (error: any) {
      // Sanitize error message to use relative paths
      const rawMessage = error.message || String(error);
      const sanitizedMessage = rawMessage.replace(this.sampleDir, './sample-files');

      this.results.push({
        extension: ext,
        mimeType,
        status: 'fail',
        message: sanitizedMessage,
        duration: Date.now() - testStart,
      });
    } finally {
      // Clean up test file
      try {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Creates a sample file with the given extension
   */
  private createSampleFile(ext: string): string {
    const fileName = `test${ext}`;
    const filePath = path.join(this.sampleDir, fileName);

    // Create appropriate sample content based on file type
    let content: string | Buffer;

    // For binary formats, create minimal valid content
    if (ext === '.pdf') {
      // Minimal valid PDF
      content = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj xref 0 4 trailer<</Size 4/Root 1 0 R>>startxref 0 %%EOF';
    } else {
      // For text formats, create sample content
      content = `Sample file for ${ext} MIME type testing.\n`;
      content += `MIME Type: ${EXTENSION_TO_MIME[ext]}\n`;
      content += `Generated at: ${new Date().toISOString()}\n`;
      content += `File extension: ${ext}\n`;
      content += '\nThis is test content for validating MIME type support in the Gemini File Search API.\n';
    }

    fs.writeFileSync(filePath, content);
    return filePath;
  }

  /**
   * Generates a test report from the results
   */
  private generateReport(duration: number): TestReport {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const skipped = this.results.filter(r => r.status === 'skip').length;

    return {
      totalTests: this.results.length,
      passed,
      failed,
      skipped,
      results: this.results,
      duration,
    };
  }

  /**
   * Prints the test report to console
   */
  private printReport(report: TestReport): void {
    console.log(`\n${'='.repeat(60)}`);
    console.log('MIME Type Validation Report');
    console.log(`${'='.repeat(60)}\n`);

    // Summary
    const pct = (n: number) => report.totalTests > 0 ? ((n / report.totalTests) * 100).toFixed(1) : '0.0';
    console.log('Summary:');
    console.log(`  Total Tests:  ${report.totalTests}`);
    console.log(`  Passed:       ${report.passed} (${pct(report.passed)}%)`);
    console.log(`  Failed:       ${report.failed} (${pct(report.failed)}%)`);
    if (report.skipped > 0) {
      console.log(`  Skipped:      ${report.skipped}`);
    }
    console.log(`  Duration:     ${(report.duration / 1000).toFixed(2)}s`);
    console.log();

    // Failed tests
    if (report.failed > 0) {
      console.log('Failed Extensions:');
      const failedResults = report.results.filter(r => r.status === 'fail');
      for (const result of failedResults) {
        console.log(`  ✗ ${result.extension.padEnd(12)} (${result.mimeType})`);
        console.log(`    Error: ${result.message}`);
      }
      console.log();
    }

    // Success message
    if (report.failed === 0) {
      console.log('✓ All MIME types validated successfully!');
    } else {
      console.log(`⚠ ${report.failed} MIME type(s) failed validation`);
    }

    console.log(`\n${'='.repeat(60)}\n`);
  }

  /**
   * Saves the report to a JSON file
   */
  async saveReportToFile(filename: string, report?: TestReport): Promise<void> {
    const reportToSave = report ?? this.generateReport(Date.now() - this.startTime);
    const reportJson = JSON.stringify(reportToSave, null, 2);
    fs.writeFileSync(filename, reportJson);
    console.log(`Report saved to: ${filename}`);
  }
}

/**
 * CLI entry point
 */
async function main() {
  // Get API key
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_DEEP_RESEARCH_API_KEY;
  if (!apiKey) {
    console.error('Error: API key not found.');
    console.error('Please set GEMINI_API_KEY or GEMINI_DEEP_RESEARCH_API_KEY environment variable.');
    process.exit(1);
  }

  console.log('Starting MIME Type Validation...');
  console.log('Note: This will create a temporary test store, run validation, and clean up.\n');
  console.log('This may take several minutes depending on the number of MIME types.\n');

  try {
    // Create validator with a placeholder name (will be set when store is created)
    const validator = new MimeTypeValidator(apiKey);
    const report = await validator.validateAllMimeTypes();

    // Save report to file
    const reportPath = path.join(__dirname, 'mime-type-validation-report.json');
    await validator.saveReportToFile(reportPath, report);

    // Exit with error code if there were failures
    if (report.failed > 0) {
      console.log(`\n⚠ ${report.failed} MIME type(s) failed - see report for details`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\nFatal error during validation:');
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly (ESM equivalent of require.main === module)
const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
                     process.argv[1]?.endsWith('/scripts/test-mime-types.ts');
if (isMainModule) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { MimeTypeValidator };
