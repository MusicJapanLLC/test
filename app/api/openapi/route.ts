import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * OpenAPI 3.1 スキーマ。ChatGPT のカスタムGPT「Actions」や Codex/LLM から
 * このコンソールのスキャン機能を呼び出せるようにする（＝プラグイン化）。
 * すべて認可ゲート経由・認可レンジ限定。LLM（頭脳）は外側（ChatGPT等）が担当。
 */
const SERVER = process.env.PUBLIC_BASE_URL ?? 'https://standment-redteam-console.vercel.app';

const SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Standment Redteam Console API',
    version: '1.0.0',
    description:
      '認可スコープ内レッドチーム・コンソールのAPI。登録済みテストレンジに対して、受動的な検出手法（セキュリティヘッダ、CORS、Cookie、露出ファイル、GraphQL、入力反射、詳細エラー等）を実行し、所見・再現手順・修正提案を返す。スコープ外ホストは実行前に拒否される。アカウント乗っ取り・権限変更・遠隔操作・DoSは提供しない。',
  },
  servers: [{ url: SERVER }],
  paths: {
    '/api/targets': {
      get: {
        operationId: 'listAuthorizedTargets',
        summary: '認可済みテストターゲット一覧を取得',
        description: 'このコンソールが検査を許可されている登録済みターゲット（owner認可済みテストレンジ）を返す。',
        responses: {
          '200': {
            description: 'ターゲット一覧',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/TargetsResponse' } } },
          },
        },
      },
      post: {
        operationId: 'checkScope',
        summary: 'URLが認可スコープ内かを判定',
        description: '投入URLが認可フェデレーション内かを返す。inScope=false のURLに対しては実行モジュールが拒否する。',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UrlBody' } } } },
        responses: { '200': { description: 'スコープ判定', content: { 'application/json': { schema: { $ref: '#/components/schemas/ScopeResponse' } } } } },
      },
    },
    '/api/scan': {
      post: {
        operationId: 'listMethods',
        summary: '対象に実行可能な検出手法を列挙',
        description: '認可スコープ内の対象に対して実行できる検出モジュール（手法）の一覧と説明を返す。',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UrlBody' } } } },
        responses: { '200': { description: '手法一覧', content: { 'application/json': { schema: { $ref: '#/components/schemas/MethodsResponse' } } } } },
      },
    },
    '/api/run': {
      post: {
        operationId: 'runMethod',
        summary: '検出手法を1つ実行',
        description:
          '指定した検出モジュール（toolId）を認可スコープ内の対象(url)に対して実行し、所見（severity/再現手順/影響/修正提案）を返す。toolId は listMethods の結果から選ぶ。スコープ外・禁止手法は実行前に拒否される。',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RunBody' } } } },
        responses: { '200': { description: '実行結果', content: { 'application/json': { schema: { $ref: '#/components/schemas/RunResult' } } } } },
      },
    },
  },
  components: {
    schemas: {
      UrlBody: { type: 'object', required: ['url'], properties: { url: { type: 'string', description: '対象URL（https、認可レンジ内）', example: 'https://kabeya-authorized-test-range.onrender.com/' } } },
      RunBody: {
        type: 'object', required: ['toolId', 'url'],
        properties: {
          toolId: { type: 'string', description: '検出モジュールID（例: recon.http-fingerprint, web.cors-probe, fuzzing.content-discovery）', example: 'recon.http-fingerprint' },
          url: { type: 'string', description: '対象URL（認可レンジ内）' },
        },
      },
      TargetsResponse: { type: 'object', properties: { targets: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, base_url: { type: 'string' }, host: { type: 'string' }, rate_limit_rps: { type: 'number' }, allowed: { type: 'number' } } } } } },
      ScopeResponse: { type: 'object', properties: { inScope: { type: 'boolean' }, reason: { type: 'string' }, rateLimitRps: { type: 'number' } } },
      MethodsResponse: { type: 'object', properties: { tools: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, category: { type: 'string' }, label: { type: 'string' }, note: { type: 'string' } } } } } },
      Finding: { type: 'object', properties: { title: { type: 'string' }, severity: { type: 'string', enum: ['info', 'low', 'medium', 'high', 'critical'] }, reproduce: { type: 'string' }, impact: { type: 'string' }, remediation: { type: 'string' } } },
      RunResult: { type: 'object', properties: { ok: { type: 'boolean' }, summary: { type: 'string' }, raw: { type: 'string' }, error: { type: 'string' }, findings: { type: 'array', items: { $ref: '#/components/schemas/Finding' } } } },
    },
  },
};

export async function GET() {
  return NextResponse.json(SPEC, {
    headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
  });
}
