export const ID_PREFIXES = {
  org: "org",
  user: "usr",
  invite: "inv",
  businessProfile: "bprf",
  taxYearProfile: "typ",
  quarter: "qtr",
  incomeLine: "inc",
  expenseLine: "exp",
  depreciationSchedule: "dep",
  receipt: "rcpt",
  hoursEntry: "hrs",
  kmEntry: "km",
  pot: "pot",
  setAsideEntry: "sae",
  voorlopigeAanslag: "va",
  deadline: "ddl",
  reminderLog: "rlog",
  subscription: "sub",
  exportJob: "xjob",
  auditLog: "aud",
  secret: "sec",
  notification: "ntf",
} as const;

export type IdKind = keyof typeof ID_PREFIXES;

export function newId(kind: IdKind): string {
  return `${ID_PREFIXES[kind]}_${crypto.randomUUID()}`;
}
