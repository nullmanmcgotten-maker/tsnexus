import { RiskEngineConfig, StrategyDSL, UnifiedOrderRecord } from '../../types/unified.ts';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  parents?: string[];
  isFolder: boolean;
}

export interface DriveProjectBundle {
  projectName: string;
  sourceType: 'google_drive';
  rootFolderId?: string;
  loadedAt: string;
  files: {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    content?: string;
    language?: string;
  }[];
  detectedType: 'nexus_engine' | 'trading_bot' | 'strategy_dsl' | 'risk_config' | 'custom_app';
  parsedConfig?: Partial<RiskEngineConfig>;
  parsedStrategies?: StrategyDSL[];
  parsedOrders?: UnifiedOrderRecord[];
  summary: string;
  rawEnvVars?: Record<string, string>;
}

export class GoogleDriveService {
  /**
   * List files or search files in Google Drive
   */
  async listFiles(
    accessToken: string,
    options: {
      folderId?: string;
      searchTerm?: string;
      pageSize?: number;
    } = {}
  ): Promise<DriveFile[]> {
    const { folderId, searchTerm, pageSize = 50 } = options;

    let queryParts = ['trashed = false'];

    if (folderId && folderId !== 'root') {
      queryParts.push(`'${folderId}' in parents`);
    }

    if (searchTerm && searchTerm.trim().length > 0) {
      const cleanTerm = searchTerm.replace(/'/g, "\\'");
      queryParts.push(`name contains '${cleanTerm}'`);
    }

    const q = queryParts.join(' and ');
    const fields = 'nextPageToken, files(id, name, mimeType, size, modifiedTime, parents)';
    const url = `https://www.googleapis.com/drive/v3/files?pageSize=${pageSize}&fields=${encodeURIComponent(
      fields
    )}&q=${encodeURIComponent(q)}&orderBy=folder,name`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Drive API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const files: DriveFile[] = (data.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      modifiedTime: f.modifiedTime,
      parents: f.parents,
      isFolder: f.mimeType === 'application/vnd.google-apps.folder',
    }));

    return files;
  }

  /**
   * Fetch text content of a file from Google Drive
   */
  async getFileContent(accessToken: string, fileId: string): Promise<string> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      // If it's a Google Doc or Sheet, attempt export
      if (res.status === 403 || res.status === 400) {
        const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
        const exportRes = await fetch(exportUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (exportRes.ok) {
          return await exportRes.text();
        }
      }
      const err = await res.text();
      throw new Error(`Failed to load file content (${res.status}): ${err}`);
    }

    return await res.text();
  }

  /**
   * Inspect and bundle a set of Drive files into an active App Bundle
   */
  async buildProjectBundle(
    accessToken: string,
    projectName: string,
    targetFiles: DriveFile[],
    rootFolderId?: string
  ): Promise<DriveProjectBundle> {
    const loadedFiles: DriveProjectBundle['files'] = [];
    let parsedConfig: Partial<RiskEngineConfig> | undefined;
    const parsedStrategies: StrategyDSL[] = [];
    let parsedOrders: UnifiedOrderRecord[] | undefined;
    const rawEnvVars: Record<string, string> = {};

    // Fetch content of relevant files (text, json, code, toml, yaml)
    for (const f of targetFiles) {
      if (f.isFolder) continue;

      const lowerName = f.name.toLowerCase();
      const isReadable =
        lowerName.endsWith('.json') ||
        lowerName.endsWith('.ts') ||
        lowerName.endsWith('.tsx') ||
        lowerName.endsWith('.js') ||
        lowerName.endsWith('.py') ||
        lowerName.endsWith('.rs') ||
        lowerName.endsWith('.toml') ||
        lowerName.endsWith('.yaml') ||
        lowerName.endsWith('.yml') ||
        lowerName.endsWith('.env') ||
        lowerName.endsWith('.txt') ||
        lowerName.endsWith('.csv') ||
        lowerName.endsWith('.md') ||
        lowerName.endsWith('.dsl');

      let content: string | undefined;
      let language = 'text';

      if (lowerName.endsWith('.json')) language = 'json';
      else if (lowerName.endsWith('.ts') || lowerName.endsWith('.tsx')) language = 'typescript';
      else if (lowerName.endsWith('.py')) language = 'python';
      else if (lowerName.endsWith('.rs')) language = 'rust';
      else if (lowerName.endsWith('.toml') || lowerName.endsWith('.yaml')) language = 'yaml';

      if (isReadable) {
        try {
          content = await this.getFileContent(accessToken, f.id);
        } catch (e: any) {
          console.warn(`Could not read ${f.name}:`, e.message);
          content = `// Error loading content: ${e.message}`;
        }
      }

      loadedFiles.push({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        content,
        language,
      });

      // Try parsing configuration or strategies
      if (content) {
        if (lowerName.endsWith('.json')) {
          try {
            const parsed = JSON.parse(content);
            // Check if it's risk configuration
            if (parsed.total_capital_usd || parsed.hard_caps_usd || parsed.max_daily_loss_pct) {
              parsedConfig = { ...parsedConfig, ...parsed };
            }
            // Check if it's a strategy or list of strategies
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].triggers && parsed[0].guards) {
              parsedStrategies.push(...parsed);
            } else if (parsed.triggers && parsed.guards && parsed.id) {
              parsedStrategies.push(parsed);
            }
            // Check if it's an order journal
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].adapter && parsed[0].notional_usd) {
              parsedOrders = parsed;
            }
          } catch {
            // not a json match
          }
        } else if (lowerName.endsWith('.env')) {
          content.split('\n').forEach((line) => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
              const [k, ...v] = trimmed.split('=');
              rawEnvVars[k.trim()] = v.join('=').trim();
            }
          });
        }
      }
    }

    let detectedType: DriveProjectBundle['detectedType'] = 'custom_app';
    if (parsedStrategies.length > 0) detectedType = 'strategy_dsl';
    else if (parsedConfig) detectedType = 'risk_config';
    else if (loadedFiles.some((f) => f.name.endsWith('.py') || f.name.endsWith('.rs'))) detectedType = 'trading_bot';
    else detectedType = 'nexus_engine';

    const summary = `Loaded ${loadedFiles.length} file(s) from Google Drive. ${
      parsedStrategies.length > 0 ? `${parsedStrategies.length} trading strategies detected. ` : ''
    }${parsedConfig ? 'Risk Kernel parameters recognized. ' : ''}${
      Object.keys(rawEnvVars).length > 0 ? `${Object.keys(rawEnvVars).length} environment variables parsed. ` : ''
    }`;

    return {
      projectName: projectName || 'Google Drive App',
      sourceType: 'google_drive',
      rootFolderId,
      loadedAt: new Date().toISOString(),
      files: loadedFiles,
      detectedType,
      parsedConfig,
      parsedStrategies: parsedStrategies.length > 0 ? parsedStrategies : undefined,
      parsedOrders,
      summary,
      rawEnvVars: Object.keys(rawEnvVars).length > 0 ? rawEnvVars : undefined,
    };
  }
}

export const driveService = new GoogleDriveService();
