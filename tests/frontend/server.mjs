import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const helper = await build({ entryPoints: ['src/helpers/templates.ts'], bundle: true,
  format: 'esm', platform: 'browser', target: 'es2022', write: false });
createServer(async (req, res) => {
  if (req.url === '/templates.js') {
    res.setHeader('Content-Type', 'text/javascript');
    return res.end(helper.outputFiles[0].text);
  }
  if (req.url === '/row.js') {
    res.setHeader('Content-Type', 'text/javascript');
    return res.end(await readFile('dist/nunjucks-entity-row.js'));
  }
  res.setHeader('Content-Type', 'text/html');
  res.end('<!doctype html><html><body></body></html>');
}).listen(4173, '127.0.0.1');
