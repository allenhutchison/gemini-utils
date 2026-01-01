#!/usr/bin/env node
/**
 * CLI entry point for @allenhutchison/gemini-utils
 */

import { createProgram } from './index.js';

const program = createProgram();
program.parse();
