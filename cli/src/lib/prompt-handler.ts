import { ExitPromptError } from '@inquirer/core';
import chalk from 'chalk';

const easterEggs = [
  "👋 See you later, alligator!",
  "🦀 Crab-walking away...",
  "🚀 To infinity and beyond! (or just the exit)",
  "🎭 The show must go on... but not this one!",
  "🍕 Pizza time! (but first, let's exit)",
  "🎸 Rock and roll! (out of here)",
  "🌊 Making waves... of exit!",
  "🎪 Circus is over, folks!",
  "🎨 Art is never finished, only abandoned. (So is this prompt)",
  "☕ Coffee break approved!",
  "🎯 Mission aborted (by user request)",
  "🎪 The magic show has ended!",
  "🌙 Good night, and good luck!",
  "🎭 Exit stage left!",
  "🚪 Door's open, see you later!",
];

function getRandomEasterEgg(): string {
  return easterEggs[Math.floor(Math.random() * easterEggs.length)];
}

export function handlePromptError(error: unknown): never {
  if (error instanceof ExitPromptError) {
    console.log();
    console.log(chalk.dim(getRandomEasterEgg()));
    console.log();
    process.exit(0);
  }
  throw error;
}

export async function safePrompt<T>(
  promptFn: () => Promise<T>
): Promise<T> {
  try {
    return await promptFn();
  } catch (error) {
    return handlePromptError(error);
  }
}
