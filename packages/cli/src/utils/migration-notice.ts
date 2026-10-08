export interface SynaiCliMigrationNotice {
  id: string;
  title: string;
  body: string;
  url: string;
  openLabel: string;
}

export function getSynaiCliMigrationNotice(
  _dataDir?: string,
  _env?: NodeJS.ProcessEnv,
  _options?: { activeProviderId?: string },
): SynaiCliMigrationNotice | undefined {
  return undefined;
}

export function markSynaiCliMigrationNoticeShown(
  _dataDir?: string,
  _noticeId?: string,
): void {}
