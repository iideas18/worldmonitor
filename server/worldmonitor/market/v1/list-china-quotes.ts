/**
 * RPC: ListChinaQuotes
 * Fetches China market indices, sector ETFs, currencies, and key commodities from Yahoo Finance.
 *
 * Covers: Shanghai Composite, Shenzhen, CSI 300, Hang Seng, CNY/USD,
 *         China-focused sector ETFs, and key commodities (gold, oil, iron ore).
 */

import type {
  ServerContext,
  ListChinaQuotesRequest,
  ListChinaQuotesResponse,
  ChinaQuote,
} from '../../../../src/generated/server/worldmonitor/market/v1/service_server';
import { fetchYahooQuotesBatch } from './_shared';
import { cachedFetchJson, getCachedJson } from '../../../_shared/redis';

const REDIS_KEY = 'market:china-quotes:v1';
const REDIS_TTL = 480; // 8 min

const SEED_FRESHNESS_MS = 90 * 60_000; // 90 min

let memCache: { data: ListChinaQuotesResponse; ts: number } | null = null;
const MEM_TTL = 480_000;

interface ChinaSymbolMeta {
  symbol: string;
  name: string;
  category: string;
  flag: string;
  type: 'index' | 'currency' | 'commodity' | 'etf';
}

const CHINA_SYMBOLS: ChinaSymbolMeta[] = [
  // Major Indices
  { symbol: '000001.SS', name: '上证综指 (Shanghai Composite)', category: '大盘指数', flag: '🇨🇳', type: 'index' },
  { symbol: '399001.SZ', name: '深证成指 (Shenzhen Component)', category: '大盘指数', flag: '🇨🇳', type: 'index' },
  { symbol: '000300.SS', name: '沪深300 (CSI 300)', category: '大盘指数', flag: '🇨🇳', type: 'index' },
  { symbol: '000688.SS', name: '科创50 (STAR 50)', category: '大盘指数', flag: '🇨🇳', type: 'index' },
  { symbol: '399006.SZ', name: '创业板指 (ChiNext)', category: '大盘指数', flag: '🇨🇳', type: 'index' },
  // Hong Kong
  { symbol: '^HSI', name: '恒生指数 (Hang Seng)', category: '港股', flag: '🇭🇰', type: 'index' },
  { symbol: '^HSCE', name: '国企指数 (H-Share)', category: '港股', flag: '🇭🇰', type: 'index' },
  // China-focused ETFs (US-listed, liquid proxies)
  { symbol: 'FXI', name: '中国大盘ETF (iShares China)', category: 'ETF', flag: '🇨🇳', type: 'etf' },
  { symbol: 'KWEB', name: '中国互联网ETF (KraneShares)', category: 'ETF', flag: '🇨🇳', type: 'etf' },
  { symbol: 'MCHI', name: 'MSCI中国ETF', category: 'ETF', flag: '🇨🇳', type: 'etf' },
  { symbol: 'ASHR', name: '沪深300 ETF (Xtrackers)', category: 'ETF', flag: '🇨🇳', type: 'etf' },
  { symbol: 'CQQQ', name: '中国科技ETF', category: 'ETF', flag: '🇨🇳', type: 'etf' },
  // Currencies
  { symbol: 'CNY=X', name: '美元/人民币 (USD/CNY)', category: '汇率', flag: '🇨🇳', type: 'currency' },
  { symbol: 'CNHJPY=X', name: '人民币/日元 (CNH/JPY)', category: '汇率', flag: '🇨🇳', type: 'currency' },
  { symbol: 'CNYEUR=X', name: '人民币/欧元 (CNY/EUR)', category: '汇率', flag: '🇨🇳', type: 'currency' },
  // Key Commodities (China-relevant)
  { symbol: 'GC=F', name: '黄金 (Gold)', category: '大宗商品', flag: '🥇', type: 'commodity' },
  { symbol: 'CL=F', name: '原油 (WTI Crude)', category: '大宗商品', flag: '🛢️', type: 'commodity' },
  { symbol: 'HG=F', name: '铜 (Copper)', category: '大宗商品', flag: '🔶', type: 'commodity' },
];

const ALL_SYMBOLS = CHINA_SYMBOLS.map(s => s.symbol);
const META_MAP = new Map(CHINA_SYMBOLS.map(s => [s.symbol, s]));

export async function listChinaQuotes(
  _ctx: ServerContext,
  _req: ListChinaQuotesRequest,
): Promise<ListChinaQuotesResponse> {
  const now = Date.now();

  if (memCache && now - memCache.ts < MEM_TTL) {
    return memCache.data;
  }

  // Layer 0: seed data from Railway
  try {
    const [seedData, seedMeta] = await Promise.all([
      getCachedJson(REDIS_KEY, true) as Promise<ListChinaQuotesResponse | null>,
      getCachedJson('seed-meta:market:china-quotes', true) as Promise<{ fetchedAt?: number } | null>,
    ]);
    if (seedData?.quotes?.length) {
      const fetchedAt = seedMeta?.fetchedAt ?? 0;
      const isFresh = now - fetchedAt < SEED_FRESHNESS_MS;
      if (isFresh) {
        memCache = { data: seedData, ts: now };
        return seedData;
      }
    }
  } catch { /* fall through to live fetch */ }

  try {
    const result = await cachedFetchJson<ListChinaQuotesResponse>(REDIS_KEY, REDIS_TTL, async () => {
      const batch = await fetchYahooQuotesBatch(ALL_SYMBOLS);

      const quotes: ChinaQuote[] = [];
      for (const sym of ALL_SYMBOLS) {
        const yahoo = batch.results.get(sym);
        const meta = META_MAP.get(sym)!;
        if (yahoo) {
          quotes.push({
            symbol: sym,
            name: meta.name,
            category: meta.category,
            flag: meta.flag,
            type: meta.type,
            price: yahoo.price,
            change: yahoo.change,
            sparkline: yahoo.sparkline,
          });
        }
      }

      if (quotes.length === 0 && memCache) return null;
      if (quotes.length === 0) {
        return batch.rateLimited
          ? { quotes: [], rateLimited: true }
          : null;
      }

      return { quotes, rateLimited: false };
    });

    if (result?.quotes?.length) {
      memCache = { data: result, ts: now };
    }

    return result || memCache?.data || { quotes: [], rateLimited: false };
  } catch {
    return memCache?.data || { quotes: [], rateLimited: false };
  }
}
