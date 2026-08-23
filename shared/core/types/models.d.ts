export type UnknownRecord = Record<string, unknown>;
export type BooleanMap = Record<string, boolean>;

export interface UsageEntry {
  count: number;
  lastUsed: number;
}

export type UsageMap = Record<string, UsageEntry>;

export interface SearchableRecord {
  id: string;
  title?: string;
  type?: string;
  kind?: string;
  breadcrumb?: string;
  description?: string;
  icon?: string;
  iconFont?: string;
  appIcon?: string;
  appId?: string;
  startupClass?: string;
  intentQueries?: string[];
  aliases?: string[];
  exactKeywords?: string[];
  keywords?: string[];
  route?: string;
  parentRoute?: string;
  targetRoute?: string;
  provider?: string;
  providerPriority?: number;
  order?: number;
  searchText?: string;
  section?: string;
  favorite?: boolean;
  userAlias?: string;
  isChecked?: boolean;
  emptyVisible?: boolean;
  executionKind?: string;
  commandArgvJson?: string;
  commandBinary?: string;
  commandRoute?: string;
  requiresSudo?: boolean;
  sourcePluginId?: string;
  shellPayloadJson?: string;
  menuBinaries?: string[];
  coveredCommandRoutes?: string[];
  entryKind?: string;
  sourceAction?: string;
  action?: string;
  settingKey?: string;
  settingValue?: string;
  calculatorExpression?: string;
  calculatorResult?: string;
  filePath?: string;
  fileScope?: string;
  previewImageUrl?: string;
  controlType?: string;
  checked?: boolean;
  trailingText?: string;
  destructive?: boolean;
  semanticTier?: number;
  semanticQuality?: number;
  _searchIntentQueries?: string[];
  _searchTitle?: string;
  _searchAliases?: string[];
  _searchExactKeywords?: string[];
  _searchContextWords?: string[];
  _searchFullWords?: string[];
}

export interface RankedRecord extends SearchableRecord {
  semanticTier: number;
  semanticQuality: number;
}

export interface SearchOptions {
  usage?: UsageMap;
  now?: number;
  limit?: number;
}

export interface SemanticScore {
  tier: number;
  quality: number;
}

export interface DesktopEntryInput {
  id?: unknown;
  name?: unknown;
  noDisplay?: boolean;
  hidden?: boolean;
  genericName?: unknown;
  comment?: unknown;
  icon?: unknown;
  keywords?: unknown;
  categories?: unknown;
  startupClass?: unknown;
}

export interface ApplicationBuildOptions {
  providerPriority?: number;
}

export interface ApplicationRecord extends SearchableRecord {
  type: "application";
  kind: "application";
  appId: string;
  startupClass: string;
  title: string;
}

export interface InstalledPluginInput {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  version?: unknown;
  kinds?: unknown;
  enabled?: unknown;
  canDisable?: unknown;
  firstParty?: unknown;
  clonedFrom?: unknown;
  sourceDir?: unknown;
}

export interface PluginCatalogBuildOptions {
  marketplaceBaseUrl?: string;
}

export interface PluginCatalogPlugin {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  kinds: string[];
  category: string;
  tags: string[];
  license: string;
  sourceType: "builtin" | "community" | "local";
  repositoryUrl: string;
  cloneUrl: string;
  marketplaceUrl: string;
  previewUrl: string;
  verificationStatus: "verified" | "unverified" | "not-listed";
  verificationLabel: string;
  verificationCommit: string;
  listedAt: string;
  updatedAt: string;
  stars: number;
  installed: boolean;
  enabled: boolean;
  canDisable: boolean;
  firstParty: boolean;
  clonedFrom: string;
  sourceDir: string;
  installAvailable: boolean;
  installNote: string;
  order: number;
}

export interface PluginCatalogCounts {
  total: number;
  installed: number;
  enabled: number;
  available: number;
  builtin: number;
  verified: number;
}

export interface PluginCatalog {
  schemaVersion: number;
  generatedAt: string;
  warnings: string[];
  remoteError: string;
  marketplaceBaseUrl: string;
  plugins: PluginCatalogPlugin[];
  counts: PluginCatalogCounts;
}

export interface PluginCatalogRouteOptions {
  query?: string;
  limit?: number;
  loading?: boolean;
}

export interface PluginCatalogRecord extends SearchableRecord {
  id: string;
  type: "plugin-catalog";
  kind: string;
  title: string;
  controlType: string;
}

export type PluginLifecycleIntentKind = "none" | "direct" | "terminal" | "url" | "copy";

export interface PluginLifecycleIntent {
  kind: PluginLifecycleIntentKind;
  action: string;
  pluginId: string;
  argv: string[];
  url: string;
  value: string;
  message: string;
  destructive: boolean;
}
