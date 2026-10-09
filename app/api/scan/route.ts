import { NextRequest, NextResponse } from 'next/server';
import { availableFor } from '../../lib/tools';
import '../../lib/modules/recon'; // register() を走らせる
import '../../lib/modules/web';
import '../../lib/modules/deep';

export const runtime = 'edge';

// POST {url}: その対象に実行可能な手法を列挙（右ペインのプルダウン）
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const url = String(body.url ?? '');
  if (!url) return NextResponse.json({ error: 'url_required' }, { status: 400 });
  const tools = availableFor(url).map(({ tool, note }) => ({
    id: tool.id,
    category: tool.category,
    label: tool.label,
    note,
  }));
  return NextResponse.json({ tools });
}
