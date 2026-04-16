import os from 'os';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const startTime = Date.now();

export function getSystemStats() {
  const cpus = os.cpus();
  const cpuCount = cpus.length;

  let cpuLoad = 0;
  try {
    const loadAvg = os.loadavg()[0];
    cpuLoad = parseFloat((loadAvg / cpuCount).toFixed(2));
  } catch {
    cpuLoad = 0;
  }

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPercent = Math.round((usedMem / totalMem) * 100);

  let diskPercent = 0;
  let diskUsed = '0 GB';
  let diskTotal = '0 GB';
  try {
    const dfOutput = execSync('df -h / | tail -1', { encoding: 'utf-8' }).trim();
    const parts = dfOutput.split(/\s+/);
    if (parts.length >= 5) {
      diskTotal = parts[1];
      diskUsed = parts[2];
      diskPercent = parseInt(parts[4].replace('%', ''), 10);
    }
  } catch {
    diskPercent = 0;
  }

  const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
  const hrs = Math.floor(uptimeSec / 3600);
  const mins = Math.floor((uptimeSec % 3600) / 60);
  const secs = uptimeSec % 60;

  return {
    cpu: {
      load: cpuLoad,
      cores: cpuCount,
      model: cpus[0]?.model || 'Unknown',
    },
    memory: {
      percent: memPercent,
      used: formatBytes(usedMem),
      total: formatBytes(totalMem),
      usedBytes: usedMem,
      totalBytes: totalMem,
    },
    disk: {
      percent: diskPercent,
      used: diskUsed,
      total: diskTotal,
    },
    uptime: {
      seconds: uptimeSec,
      formatted: `${hrs}h ${mins}m ${secs}s`,
    },
    hostname: os.hostname(),
    platform: `${os.type()} ${os.arch()}`,
    nodeVersion: process.version,
  };
}

export function getDirectoryListing(dirPath: string): Array<{ name: string; type: 'file' | 'directory'; size?: string }> {
  try {
    const resolved = path.resolve(dirPath);
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    return entries
      .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 50)
      .map(entry => {
        const item: { name: string; type: 'file' | 'directory'; size?: string } = {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
        };
        if (entry.isFile()) {
          try {
            const stat = fs.statSync(path.join(resolved, entry.name));
            item.size = formatBytes(stat.size);
          } catch { /* skip */ }
        }
        return item;
      });
  } catch {
    return [];
  }
}

export function readFileContent(filePath: string): { content: string; size: string } | null {
  try {
    const resolved = path.resolve(filePath);
    const stat = fs.statSync(resolved);
    if (stat.size > 100_000) {
      return { content: '(File too large to display)', size: formatBytes(stat.size) };
    }
    const content = fs.readFileSync(resolved, 'utf-8');
    return { content, size: formatBytes(stat.size) };
  } catch {
    return null;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
