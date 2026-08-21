export type UnknownRecord = Record<string, unknown>;
export type BooleanMap = Record<string, boolean>;
export type StringMap = Record<string, string>;

export interface UsageEntry {
  count: number;
  lastUsed: number;
}

export type UsageMap = Record<string, UsageEntry>;

export interface Preferences {
  compactMode: boolean;
  calculatorEnabled: boolean;
  fileSearchEnabled: boolean;
  quickActivationEnabled: boolean;
  fileSearchScopes: string[];
  fileSearchIgnores: string[];
}

export interface OnboardingState {
  version: number;
  status: "pending" | "verify" | "complete";
  hotkey: string;
  showCoach: boolean;
}

export interface LauncherState {
  version: number;
  favorites: string[];
  usage: UsageMap;
  aliases: StringMap;
  hidden: string[];
  queryHistory: string[];
  preferences: Preferences;
  onboarding: OnboardingState;
}

export interface StateParseResult {
  state: LauncherState;
  error: string;
}

export type BooleanPreferenceKey =
  | "compactMode"
  | "calculatorEnabled"
  | "fileSearchEnabled"
  | "quickActivationEnabled";

export type ListPreferenceKey = "fileSearchScopes" | "fileSearchIgnores";

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
  checked?: boolean;
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
  semanticTier?: number;
  semanticQuality?: number;
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

export interface AppRuntimeWindow {
  address: string;
  pid: number;
  className: string;
  title: string;
}

export interface AppRuntimeSnapshot {
  supported: boolean;
  appId: string;
  startupClass: string;
  identity: string;
  running: boolean;
  windows: AppRuntimeWindow[];
  error: string;
}

export interface DesktopEntryResolutionRequest {
  active: boolean;
  appId: string;
  operation: string;
  command: string[];
}

export interface AppHotkeyEntry {
  appId: string;
  title: string;
  hotkey: string;
}

export type AppHotkeyMap = Record<string, AppHotkeyEntry>;

export interface HotkeyMutationRequest {
  active: boolean;
  command: string[];
}

export interface CatalogCommandInput {
  route: string;
  binary: string;
  group?: string;
  name?: string;
  summary?: string;
  requires_sudo?: boolean;
  hidden?: boolean;
  args?: string;
  examples?: string[];
  aliases?: string[];
}

export interface CatalogCommand extends CatalogCommandInput {
  group: string;
  name: string;
  summary: string;
  requires_sudo: boolean;
  hidden: boolean;
  args: string;
  examples: string[];
  aliases: string[];
}

export interface CatalogParseResult {
  commands: CatalogCommand[];
  error: string;
}

export interface CliRecord extends SearchableRecord {
  type: "omarchy-cli";
  kind: "cli-command" | "cli-help";
  executionKind: "cli-direct" | "cli-help";
  commandArgvJson: string;
  commandBinary: string;
  commandRoute: string;
  requiresSudo: boolean;
  emptyVisible: boolean;
  title: string;
}

export interface ShellPluginBuildOptions {
  enabledIds?: BooleanMap;
  panelIds?: BooleanMap;
  launcherId?: string;
}

export interface ShellPluginRecord extends SearchableRecord {
  type: "shell-plugin";
  kind: "shell-feature";
  executionKind: "shell-plugin" | "shell-ipc";
  sourcePluginId: string;
  shellPayloadJson: string;
  menuBinaries: string[];
  coveredCommandRoutes: string[];
  emptyVisible: boolean;
  title: string;
  keywords: string[];
  commandArgvJson: string;
}

export interface MenuSourceItem {
  id: string;
  definition: UnknownRecord;
}

export interface MenuParseResult {
  items: MenuSourceItem[];
  error: string;
}

export interface MenuEntry {
  id: string;
  parent: string;
  kind: "action" | "link" | "menu";
  icon: string;
  iconFont: string;
  label: string;
  title: string;
  target: string;
  description: string;
  action: string;
  provider: string;
  aliases: string[];
  keywords: string[];
  when: string;
  checked: string;
  order: number;
}

export interface MergedMenu {
  items: Record<string, MenuEntry>;
  itemOrder: string[];
}

export interface MenuCommandRecord extends SearchableRecord {
  type: "omarchy-command";
  kind: "action" | "link" | "menu";
  sourceAction: string;
  checked: boolean;
  title: string;
  breadcrumb: string;
  route: string;
  searchText: string;
}

export interface GuardResults {
  when: BooleanMap;
  checked: BooleanMap;
}

export interface SourceMergeOptions {
  applications?: SearchableRecord[];
  menuRecords?: SearchableRecord[];
  pluginRecords?: PluginCoverageRecord[];
  cliRecords?: CliCoverageRecord[];
  menuItems?: MenuActionInput[];
}

export interface MenuActionInput {
  action?: string;
  sourceAction?: string;
}

export interface PluginCoverageRecord extends SearchableRecord {
  sourcePluginId: string;
  menuBinaries: string[];
  coveredCommandRoutes: string[];
}

export interface CliCoverageRecord extends SearchableRecord {
  commandBinary: string;
  commandRoute: string;
}

export interface MenuCoverage {
  binaries: BooleanMap;
  pluginIds: BooleanMap;
}

export interface QueryRequest {
  active: boolean;
  query: string;
  explicit: boolean;
}

export interface FileRank {
  path: string;
  scope: string;
  tier: number;
  relative: string;
}

export interface FileRecord extends SearchableRecord {
  type: "file";
  kind: "file";
  filePath: string;
  fileScope: string;
  title: string;
  description: string;
}

export interface DescribedRecord extends SearchableRecord {
  kind: string;
  title: string;
  description: string;
}

export interface CalculatorRecord extends DescribedRecord {
  calculatorExpression: string;
  calculatorResult: string;
}

export interface CalculatorRequest {
  active: boolean;
  expression: string;
  explicit: boolean;
  key: string;
}

export interface ActionInput {
  id?: string;
  resultId?: string;
  type?: string;
  resultType?: string;
  kind?: string;
  resultKind?: string;
  title?: string;
  description?: string;
  breadcrumb?: string;
  parentRoute?: string;
  targetRoute?: string;
  commandRoute?: string;
  executionKind?: string;
  calculatorExpression?: string;
  calculatorResult?: string;
  filePath?: string;
  appId?: string;
  startupClass?: string;
}

export interface ActionContext {
  usage?: UsageMap;
  favorite?: boolean;
  favoriteIndex?: number;
  favoriteCount?: number;
  alias?: string;
  hidden?: boolean;
  canUninstall?: boolean;
  canResolveDesktopEntry?: boolean;
  canConfigureHotkeys?: boolean;
  hotkey?: string;
  applicationRunning?: boolean;
}

export interface ActionRecord extends SearchableRecord {
  type: "action";
  description: string;
  shortcut: string;
  icon: string;
  section: string;
  kind: string;
  target: string;
  title: string;
  destructive: boolean;
}

export interface NavigationRow {
  section?: string;
}

export interface ScreenLike {
  name?: unknown;
  width?: unknown;
  height?: unknown;
  devicePixelRatio?: unknown;
}

export interface CardGeometry {
  width: number;
  height: number;
  y: number;
}

export interface GenerationCompletion {
  apply: boolean;
  restart: boolean;
}

export interface ProviderDiagnosticInput {
  provider?: unknown;
  error?: unknown;
  detail?: unknown;
}

export interface ProviderDiagnostic {
  provider: string;
  error: string;
  detail: string;
}

export interface EmptyStatusOptions {
  resultCount?: number;
  totalRecords?: number;
  query?: string;
  warnings?: readonly unknown[];
  stateReady?: boolean;
  indexSettled?: boolean;
}

export interface EmptyStatus {
  visible: boolean;
  kind: string;
  title: string;
  detail: string;
}

export interface SettingsContext {
  calculatorSettled?: boolean;
  calculatorAvailable?: boolean;
  fileSearchSettled?: boolean;
  fileSearchAvailable?: boolean;
  commonScopes?: readonly string[];
  launcherHotkey?: string;
  onboardingHotkey?: string;
  productVersion?: string;
  creatorWebsiteUrl?: string;
  repositoryUrl?: string;
}

export interface SettingRecord extends SearchableRecord {
  type: "launcher-command";
  kind: string;
  settingKey: string;
  settingValue: string;
  title: string;
  controlType: string;
  checked: boolean;
  trailingText: string;
  destructive: boolean;
}

export interface RecentRecord {
  record: SearchableRecord;
  usage: UsageEntry;
}

export interface EmptyRowsOptions {
  favoriteLimit?: number;
  recentApplicationLimit?: number;
  recentCommandLimit?: number;
}
