import type { Partner } from '../types';
import { centralAx } from './central-ax';
import { cominka } from './cominka';
import { dpPartners } from './dp-partners';
import { evorg } from './evorg';
import { musicJapan } from './music-japan';
import { smartaleck } from './smartaleck';

const all: Partner[] = [evorg, centralAx, dpPartners, cominka, smartaleck];

/**
 * 準備中（draft）の企業は、プレビュー（*.vercel.app）とローカルにだけ出す。
 * 本番ビルド（VERCEL_ENV=production）には、ページ・一覧・sitemap・llms.txt のどこにも含めない。
 * 先方の確認が取れたら draft を外して、本番にデプロイする。
 */
const showDrafts = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.VERCEL_ENV !== 'production';

/** 掲載企業の一覧（パートナー企業のカタログ）。ここに足した企業ぶん、5ページずつ自動で生成される */
export const partners: Partner[] = all.filter((p) => !p.draft || showDrafts);

/**
 * 運営会社（Music Japan）自身のページ＝ Baton Partners のサービス紹介（BP-000）。
 * パートナー企業のカタログには並べず、一覧・ヘッダー・フッターから別枠で案内する
 */
export const operatorPartner: Partner = musicJapan;

/** ページを生成するすべての会社（運営会社 → 掲載企業の順） */
export const sites: Partner[] = [operatorPartner, ...partners];
