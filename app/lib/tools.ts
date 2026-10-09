/**
 * tools.ts — ツール・プラグイン規格
 *
 * レッドチーム手法を無限拡張するためのプラグイン・インターフェース。
 * 各モジュールは「認可スコープ内の対象」に対してのみ実行され、
 * isActionPermitted / checkScope を通過しない限り runner は起動しない。
 *
 * 実行バイナリ連携（httpx/nmap/nuclei/ZAP/ffuf/sqlmap 等）は個別モジュールで
 * 実装するが、本ファイルは「安全に実行させる土台」のみを定義する。
 */
import { checkScope, isActionPermitted } from './targets';

export type ToolCategory = 'recon' | 'web' | 'fuzzing' | 'injection' | 'report' | 'github';

export type ToolModule = {
  id: string;
  category: ToolCategory;
  label: string;
  /** この手法が対象に適用可能かを自然言語で説明（中央会話が提案に使う）。 */
  describe: (targetUrl: string) => string;
  /** 実行本体。ここに来る時点でスコープ・禁止チェックは通過済み。 */
  run: (ctx: ToolRunContext) => Promise<ToolResult>;
};

export type ToolRunContext = {
  targetUrl: string;
  rateLimitRps: number;
  options?: Record<string, unknown>;
};

export type ToolResult = {
  ok: boolean;
  summary: string;
  raw?: string;
  findings?: Finding[];
  error?: string;
};

export type Finding = {
  title: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  reproduce: string;
  impact: string;
  remediation: string; // ブルー側価値（修正提案）
};

const registry = new Map<string, ToolModule>();

export function register(mod: ToolModule): void {
  registry.set(mod.id, mod);
}
export function listTools(category?: ToolCategory): ToolModule[] {
  const all = [...registry.values()];
  return category ? all.filter((m) => m.category === category) : all;
}

/** 対象に対して実行可能な手法を列挙（右ペインのプルダウン用）。 */
export function availableFor(targetUrl: string): { tool: ToolModule; note: string }[] {
  const scope = checkScope(targetUrl);
  if (!scope.inScope) return [];
  return listTools().map((tool) => ({ tool, note: tool.describe(targetUrl) }));
}

/**
 * ゲート付き実行。スコープ外 / 禁止手法は runner に到達する前に拒否する。
 */
export async function execute(toolId: string, targetUrl: string, options?: Record<string, unknown>): Promise<ToolResult> {
  const tool = registry.get(toolId);
  if (!tool) return { ok: false, summary: '', error: `未登録のツール: ${toolId}` };

  const permit = isActionPermitted(toolId);
  if (!permit.ok) return { ok: false, summary: '', error: `拒否: ${permit.reason}` };

  const scope = checkScope(targetUrl);
  if (!scope.inScope) return { ok: false, summary: '', error: `スコープ外: ${scope.reason}` };

  return tool.run({ targetUrl, rateLimitRps: scope.rateLimitRps, options });
}
