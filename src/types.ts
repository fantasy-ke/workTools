export type ViewId = "home" | "format" | "diff" | "config" | "cron" | "string-length" | "batch" | "workspaces" | "help" | "settings";
export type DocumentFormat = "auto" | "json" | "xml" | "text";
export type DiffDocumentFormat = DocumentFormat | "sql";
export type ResolvedFormat = Exclude<DiffDocumentFormat, "auto">;
export type DiffMode = "text" | "semantic" | "structure";
export type ArrayCompareMode = "sequence" | "unordered" | "match-by-key";
export type CronDialect = "unix" | "spring" | "quartz";
export type ThemeMode = "light" | "dark" | "system";
export type DensityMode = "comfortable" | "compact";
export type TabOverflowMode = "scroll" | "wrap";

export interface ValidationIssue {
  severity: "error" | "warning";
  message: string;
  offset: number;
  length: number;
  line: number;
  column: number;
  path?: string;
}

export interface StructureEntry {
  path: string;
  name: string;
  type: string;
  depth: number;
  cardinality?: "one" | "many";
}

export interface ParsedDocument {
  format: ResolvedFormat;
  valid: boolean;
  data?: unknown;
  issues: ValidationIssue[];
  duplicatePaths: string[];
}

export interface DiffOptions {
  mode: DiffMode;
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
  strictTypes: boolean;
  missingEqualsNull: boolean;
  ignorePaths: string[];
  includePaths: string[];
  arrayMode: ArrayCompareMode;
  arrayKey: string;
  maxChanges: number;
}

export type DiffChangeKind = "added" | "removed" | "changed" | "type-changed" | "moved" | "warning";

export interface DiffChange {
  id: string;
  kind: DiffChangeKind;
  path: string;
  leftType?: string;
  rightType?: string;
  leftValue?: unknown;
  rightValue?: unknown;
  message: string;
}

export interface DiffResult {
  format: ResolvedFormat;
  mode: DiffMode;
  changes: DiffChange[];
  warnings: string[];
  durationMs: number;
  truncated: boolean;
  leftValid: boolean;
  rightValid: boolean;
  normalizedLeft?: string;
  normalizedRight?: string;
}

export interface CronFieldModel {
  second?: string;
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
  year?: string;
}

export interface CronAnalysis {
  valid: boolean;
  expression: string;
  dialect: CronDialect;
  model?: CronFieldModel;
  description: string;
  fieldDescriptions: Array<{ label: string; value: string }>;
  nextRuns: Date[];
  warnings: string[];
  error?: string;
}

export interface MaskRule {
  id: string;
  path: string;
  strategy: "replace" | "keep-edges" | "remove";
  replacement: string;
  keepStart?: number;
  keepEnd?: number;
  enabled: boolean;
}

export interface RuleTemplate {
  id: string;
  name: string;
  createdAt: string;
  options: DiffOptions;
}

export interface MaskTemplate {
  id: string;
  name: string;
  createdAt: string;
  rules: MaskRule[];
}

export interface StructureBaseline {
  id: string;
  name: string;
  format: ResolvedFormat;
  createdAt: string;
  sourceName?: string;
  structure: StructureEntry[];
}

export type WorkspaceSnapshot =
  | { kind: "format"; text: string; format: DocumentFormat; sourceName?: string }
  | { kind: "diff"; leftText: string; rightText: string; format: DiffDocumentFormat; options: DiffOptions; leftName?: string; rightName?: string }
  | { kind: "cron"; dialect: CronDialect; expression: string; timezone: string };

export interface WorkspaceRecord {
  id: string;
  name: string;
  type: WorkspaceSnapshot["kind"];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  pinned: boolean;
  source?: string;
  sensitiveMode: boolean;
  snapshot: WorkspaceSnapshot;
}

export interface RecentFile {
  id: string;
  name: string;
  size: number;
  openedAt: string;
  path?: string;
  format: ResolvedFormat;
}

export type AppLanguage = "zh-CN" | "en-US";

export interface WorktoolsSettings {
  language: AppLanguage;
  theme: ThemeMode;
  density: DensityMode;
  tabOverflowMode: TabOverflowMode;
  editorFont: "Cascadia Code" | "JetBrains Mono" | "Consolas";
  fontSize: number;
  wordWrap: boolean;
  gpuAcceleration: boolean;
  temporaryByDefault: boolean;
  rememberRecentFiles: boolean;
  syncWorkspaceToLocalFile: boolean;
  maxLiveBytes: number;
  defaultDiffOptions: DiffOptions;
}

export interface WorktoolsPackage {
  format: "worktools-apiwork-v1";
  exportedAt: string;
  workspaces: WorkspaceRecord[];
  ruleTemplates: RuleTemplate[];
  maskTemplates: MaskTemplate[];
  baselines: StructureBaseline[];
  recentFiles: RecentFile[];
}

export interface LocalTextFile {
  name: string;
  content: string;
  size: number;
  path?: string;
  relativePath?: string;
}

export interface BatchPair {
  id: string;
  name: string;
  left?: LocalTextFile;
  right?: LocalTextFile;
  result?: DiffResult;
  error?: string;
}

export interface AppPersistedData {
  workspaces: WorkspaceRecord[];
  ruleTemplates: RuleTemplate[];
  maskTemplates: MaskTemplate[];
  baselines: StructureBaseline[];
  recentFiles: RecentFile[];
  settings: WorktoolsSettings;
}