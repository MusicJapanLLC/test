import { NextRequest, NextResponse } from 'next/server';
import { listTargets, checkScope } from '../../lib/targets';

export const runtime = 'nodejs';

// GET: 認可済みターゲット一覧（右ペインのレジストリ用）
export async function GET() {
  const targets = listTargets().map((t) => ({
    id: t.id,
    name: t.name,
    base_url: t.base_url,
    host: t.host,
    owner_authorization: t.owner_authorization,
    rate_limit_rps: t.rate_limit_rps,
    allowed: t.allowed_interactions?.length ?? 0,
  }));
  return NextResponse.json({ targets });
}

// POST {url}: スコープ判定（実行可否バッジ用）
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const url = String(body.url ?? '');
  if (!url) return NextResponse.json({ error: 'url_required' }, { status: 400 });
  return NextResponse.json(checkScope(url));
}
