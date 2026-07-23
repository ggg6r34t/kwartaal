export interface LogFields {
  requestId?: string;
  orgId?: string;
  path?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  [key: string]: unknown;
}

function write(level: "info" | "error", message: string, fields: LogFields) {
  const line = JSON.stringify({
    level,
    message,
    ...fields,
    ts: new Date().toISOString(),
  });
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (message: string, fields: LogFields = {}) => write("info", message, fields),
  error: (message: string, fields: LogFields = {}) => write("error", message, fields),
};
