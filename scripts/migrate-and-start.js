#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('🚀 Starting application...');

// Function to run a command and return a promise
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);
    const process = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} failed with exit code ${code}`));
      }
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
}

async function start() {
  try {
    // Run database migrations
    console.log('📊 Running database migrations...');
    await runCommand('npx', ['prisma', 'migrate', 'deploy']);

    // Start the Next.js application
    console.log('🌐 Starting Next.js server...');
    await runCommand('npm', ['run', 'start:next']);
  } catch (error) {
    console.error('❌ Error during startup:', error.message);
    process.exit(1);
  }
}

start();