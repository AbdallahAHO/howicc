import chalk from 'chalk';
import ora from 'ora';
import { TimelineExtractor } from '../lib/extractor.js';

export async function extractCommand(
  sessionId: string,
  options: { logsDir?: string }
): Promise<void> {
  const spinner = ora('Extracting conversation timeline...').start();

  try {
    const extractor = new TimelineExtractor(sessionId, options.logsDir);
    const conversation = await extractor.extract();

    // Stop spinner before outputting JSON
    spinner.stop();

    // Log warnings to stderr if there were any parsing errors
    const parsingErrors = conversation.timeline.filter(
      (event) => event.type === 'parsing_error'
    );

    if (parsingErrors.length > 0) {
      console.error(
        chalk.yellow(`\n⚠️  Found ${parsingErrors.length} parsing errors\n`)
      );

      // Show first few errors for quick diagnosis
      const previewCount = Math.min(3, parsingErrors.length);
      for (let i = 0; i < previewCount; i++) {
        const error = parsingErrors[i];
        if (error.type === 'parsing_error') {
          console.error(
            chalk.dim(
              `   ${error.sourceFile}:${error.lineNumber} - ${error.error}`
            )
          );
        }
      }

      if (parsingErrors.length > previewCount) {
        console.error(
          chalk.dim(
            `   ... and ${parsingErrors.length - previewCount} more errors`
          )
        );
      }

      console.error(); // Empty line
    }

    // Output JSON to stdout
    console.log(JSON.stringify(conversation, null, 2));
  } catch (error) {
    spinner.fail('Failed to extract conversation');

    if (error instanceof Error) {
      console.error(chalk.red(`\nError: ${error.message}\n`));
    } else {
      console.error(chalk.red(`\nUnknown error occurred\n`));
    }

    process.exit(1);
  }
}
