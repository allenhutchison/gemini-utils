import { describe, it, expect, beforeEach } from '@jest/globals';
import { ReportGenerator } from './ReportGenerator.js';
import type { InteractionOutput } from './types.js';

describe('ReportGenerator', () => {
  let generator: ReportGenerator;

  beforeEach(() => {
    generator = new ReportGenerator();
  });

  it('should generate a simple markdown report from text output', () => {
    const outputs: InteractionOutput[] = [{ type: 'text', text: 'This is the research result.' }];
    const report = generator.generateMarkdown(outputs);

    expect(report).toContain('# Research Report');
    expect(report).toContain('This is the research result.');
  });

  it('should include citations in the report if present', () => {
    const outputs: InteractionOutput[] = [
      {
        type: 'text',
        text: 'The earth is round.',
        annotations: [{ start_index: 4, end_index: 10, source: 'Source 1' }],
      },
    ];
    const report = generator.generateMarkdown(outputs);

    expect(report).toContain('The earth is round.');
    expect(report).toContain('### Citations');
    expect(report).toContain('- Source 1');
  });

  it('should handle multiple output blocks', () => {
    const outputs: InteractionOutput[] = [
      { type: 'text', text: 'Block 1' },
      { type: 'text', text: 'Block 2' },
    ];
    const report = generator.generateMarkdown(outputs);

    expect(report).toContain('Block 1');
    expect(report).toContain('Block 2');
  });

  it('should ignore non-text output types', () => {
    const outputs: InteractionOutput[] = [
      { type: 'image', url: 'http://example.com/img.png' } as unknown as InteractionOutput,
      { type: 'text', text: 'Some text' },
    ];
    const report = generator.generateMarkdown(outputs);

    expect(report).not.toContain('http://example.com/img.png');
    expect(report).toContain('Some text');
  });

  it('should handle annotations without source', () => {
    const outputs: InteractionOutput[] = [
      {
        type: 'text',
        text: 'Text with annotation but no source',
        annotations: [{ start_index: 0, end_index: 4 }],
      },
    ];
    const report = generator.generateMarkdown(outputs);

    expect(report).toContain('Text with annotation but no source');
    expect(report).not.toContain('### Citations');
  });

  it('should deduplicate citation sources', () => {
    const outputs: InteractionOutput[] = [
      {
        type: 'text',
        text: 'Paragraph 1',
        annotations: [{ source: 'Source A' }, { source: 'Source A' }, { source: 'Source B' }],
      },
    ];
    const report = generator.generateMarkdown(outputs);

    expect(report).toContain('### Citations');
    // Count occurrences of sources
    const sourceAMatches = report.match(/- Source A/g);
    const sourceBMatches = report.match(/- Source B/g);
    expect(sourceAMatches).toHaveLength(1); // Should only appear once
    expect(sourceBMatches).toHaveLength(1);
  });

  it('should handle empty outputs array', () => {
    const outputs: InteractionOutput[] = [];
    const report = generator.generateMarkdown(outputs);

    expect(report).toContain('# Research Report');
    expect(report).not.toContain('### Citations');
  });
});
