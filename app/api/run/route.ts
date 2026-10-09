import { NextRequest, NextResponse } from 'next/server';
import { execute } from '../../lib/tools';
import '../../lib/modules/recon'; // register() を走らせる
import '../../lib/modules/web';
import '../../lib/modules/deep';

export const runtime = 'nodejs';

// POST {toolId, url, options?}: ゲート付き実行。
// スコープ外 / 禁止手法は execute() 内で runner に到達する前に拒否される。
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const toolId = String(body.toolId ?? '');
  const url = String(body.url ?? '');
  if (!toolId || !url) return NextResponse.json({ error: 'toolId_and_url_required' }, { status: 400 });
  const result = await execute(toolId, url, body.options);
  return NextResponse.json(result);
}
