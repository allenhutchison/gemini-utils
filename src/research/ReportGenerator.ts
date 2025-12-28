/**
 * ReportGenerator - Converts research interaction outputs to markdown format.
 */
import { InteractionOutput, TextContent } from './types.js';

/**
 * Annotation on text content with optional source citation.
 */
interface TextAnnotation {
  source?: string;
  start_index?: number;
  end_index?: number;
}

/**
 * Type guard to check if an output is TextContent.
 */
function isTextContent(output: InteractionOutput): output is TextContent {
  return output.type === 'text';
}

/**
 * Generates markdown reports from research interaction outputs.
 */
export class ReportGenerator {
  /**
   * Generates a markdown report from interaction outputs.
   * @param outputs - Array of interaction outputs (text, images, etc.)
   * @returns Formatted markdown string with citations
   */
  generateMarkdown(outputs: InteractionOutput[]): string {
    let markdown = '# Research Report\n\n';
    const citations: string[] = [];

    for (const output of outputs) {
      if (isTextContent(output)) {
        markdown += (output.text ?? '') + '\n\n';

        // Extract unique citation sources from annotations
        const annotations = output.annotations as TextAnnotation[] | undefined;
        if (annotations) {
          for (const annotation of annotations) {
            if (annotation.source && !citations.includes(annotation.source)) {
              citations.push(annotation.source);
            }
          }
        }
      }
    }

    // Append citations section if any were found
    if (citations.length > 0) {
      markdown += '### Citations\n';
      for (const source of citations) {
        markdown += `- ${source}\n`;
      }
    }

    return markdown.trim() + '\n';
  }
}
