// Bundle a single module to catch syntax errors and bad imports: node scripts/check.mjs <file>
import { build } from 'vite';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/check.mjs <file>');
  process.exit(1);
}
try {
  await build({
    configFile: false,
    logLevel: 'error',
    build: { write: false, target: 'esnext', lib: { entry: file, formats: ['es'], fileName: 'check' } },
  });
  console.log(`OK ${file}`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
