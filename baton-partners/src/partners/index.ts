import type { Partner } from '../types';
import { centralAx } from './central-ax';
import { dpPartners } from './dp-partners';
import { evorg } from './evorg';

const all: Partner[] = [evorg, centralAx, dpPartners];

/**
 * 準備中（draft）の企業は、プレビュー（*.vercel.app）とローカルにだけ出す。
 * 本番ビルド（VERCEL_ENV=production）には、ページ・一覧・sitemap・llms.txt のどこにも含めない。
 * 先方の確認が取れたら draft を外して、本番にデプロイする。
 */
const showDrafts = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.VERCEL_ENV !== 'production';

/** 掲載企業の一覧。ここに足した企業ぶん、5ページずつ自動で生成される */
export const partners: Partner[] = all.filter((p) => !p.draft || showDrafts);
