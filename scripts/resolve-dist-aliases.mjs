import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distSrc = path.join(projectRoot, 'dist', 'src');

const aliases = new Map([
  ['@/', distSrc],
  ['@config/', path.join(distSrc, 'config')],
  ['@modules/', path.join(distSrc, 'modules')],
  ['@shared/', path.join(distSrc, 'shared')],
  ['@middlewares/', path.join(distSrc, 'middlewares')],
  ['@constants/', path.join(distSrc, 'constants')],
  ['@ai/', path.join(distSrc, 'ai')],
  ['@queues/', path.join(distSrc, 'queues')]
]);

const toPosixRelativeSpecifier = (fromFile, toFile) => {
  const relativePath = path.relative(path.dirname(fromFile), toFile).replaceAll(path.sep, '/');
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
};

const resolveAlias = (specifier, fromFile) => {
  for (const [alias, targetRoot] of aliases) {
    if (specifier.startsWith(alias)) {
      return toPosixRelativeSpecifier(fromFile, path.join(targetRoot, specifier.slice(alias.length)));
    }
  }

  return specifier;
};

const rewriteFile = async (filePath) => {
  const source = await readFile(filePath, 'utf8');
  const aliasRegex = /((?:from\s+|import\s*\(\s*|import\s+|export\s+(?:\*\s+)?from\s+))(['"])(@(?:\/|config\/|modules\/|shared\/|middlewares\/|constants\/|ai\/|queues\/)[^'"]+)(['"])/g;
  const rewritten = source.replace(aliasRegex, (_match, prefix, quote, specifier, suffix) => `${prefix}${quote}${resolveAlias(specifier, filePath)}${suffix}`);

  if (rewritten !== source) {
    await writeFile(filePath, rewritten);
  }
};

const walk = async (directory) => {
  const entries = await readdir(directory);

  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry);
      const entryStats = await stat(entryPath);

      if (entryStats.isDirectory()) {
        await walk(entryPath);
        return;
      }

      if (entryPath.endsWith('.js')) {
        await rewriteFile(entryPath);
      }
    })
  );
};

await walk(distSrc);
