export interface LogEntry {
  timestamp: string;
  source: string;
  message: string;
  level: 'info' | 'warn' | 'error' | 'debug';
}

const MAX_LOGS = 500;
const logs: LogEntry[] = [];
let totalLogCount = 0;

export function addLog(source: string, message: string, level: LogEntry['level'] = 'info'): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 23),
    source,
    message,
    level,
  };
  logs.push(entry);
  totalLogCount++;
  if (logs.length > MAX_LOGS) {
    logs.splice(0, logs.length - MAX_LOGS);
  }
}

export function getLogs(since?: number): { logs: LogEntry[]; total: number } {
  if (since && since > 0) {
    const sinceTs = new Date(since).toISOString().replace('T', ' ').substring(0, 23);
    const filtered = logs.filter(l => l.timestamp > sinceTs);
    return { logs: filtered, total: totalLogCount };
  }
  return { logs: logs.slice(-100), total: totalLogCount };
}

export function getTotalLogCount(): number {
  return totalLogCount;
}

addLog('SYSTEM', 'Hermex backend initialized');
addLog('SYSTEM', 'Log collector active — recording all API/LLM events');
