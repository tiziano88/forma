import { access, constants } from 'fs/promises';
import { dirname, join, resolve } from 'path';

/**
 * Find the nearest config.forma.binpb file by walking up the directory tree
 */
export async function findConfig(startPath: string): Promise<string | null> {
  let currentDir = dirname(resolve(startPath));
  const visited = new Set<string>();
  const maxDepth = 10;

  for (let depth = 0; depth < maxDepth; depth++) {
    // Avoid infinite loops
    const normalized = resolve(currentDir);
    if (visited.has(normalized)) {
      break;
    }
    visited.add(normalized);

    // Check for config file
    const configPath = join(currentDir, 'config.forma.binpb');
    try {
      await access(configPath, constants.R_OK);
      return configPath;
    } catch {
      // File doesn't exist or not readable, continue searching
    }

    // Move up one directory
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached root
      break;
    }
    currentDir = parentDir;
  }

  return null;
}
