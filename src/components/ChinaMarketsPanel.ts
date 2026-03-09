import { Panel } from './Panel';
import { t } from '@/services/i18n';
import { escapeHtml } from '@/utils/sanitize';
import { formatPrice, formatChange, getChangeClass } from '@/utils';
import { miniSparkline } from '@/utils/sparkline';
import { MarketServiceClient } from '@/generated/client/worldmonitor/market/v1/service_client';
import type { ListChinaQuotesResponse, ChinaQuote } from '@/generated/client/worldmonitor/market/v1/service_client';
import { startSmartPollLoop, type SmartPollLoopHandle } from '@/services/runtime';
import { getHydratedData } from '@/services/bootstrap';

const client = new MarketServiceClient('', { fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) });

function renderSection(title: string, quotes: ChinaQuote[]): string {
  if (quotes.length === 0) return '';
  const rows = quotes.map(q => `
    <div class="market-item">
      <div class="market-info">
        <span class="market-name">${q.flag} ${escapeHtml(q.name)}</span>
        <span class="market-symbol">${escapeHtml(q.category || q.symbol)}</span>
      </div>
      <div class="market-data">
        ${miniSparkline(q.sparkline, q.change)}
        <span class="market-price">${formatPrice(q.price)}</span>
        <span class="market-change ${getChangeClass(q.change)}">${formatChange(q.change)}</span>
      </div>
    </div>
  `).join('');
  return `<div class="gulf-section"><div class="gulf-section-title">${escapeHtml(title)}</div>${rows}</div>`;
}

export class ChinaMarketsPanel extends Panel {
  private pollLoop: SmartPollLoopHandle;

  constructor() {
    super({ id: 'china-markets', title: t('panels.chinaMarkets') });
    this.pollLoop = startSmartPollLoop(() => this.fetchData(), {
      intervalMs: 60_000,
      pauseWhenHidden: true,
      refreshOnVisible: true,
      runImmediately: false,
    });
    setTimeout(() => this.pollLoop.trigger(), 8_000);
  }

  destroy(): void {
    this.pollLoop.stop();
    super.destroy();
  }

  public async fetchData(): Promise<void> {
    try {
      const hydrated = getHydratedData('chinaQuotes') as ListChinaQuotesResponse | undefined;
      if (hydrated?.quotes?.length) {
        if (!this.element?.isConnected) return;
        this.renderChina(hydrated);
        return;
      }
      const data = await client.listChinaQuotes({});
      if (!this.element?.isConnected) return;
      this.renderChina(data);
    } catch (err) {
      if (this.isAbortError(err)) return;
      if (!this.element?.isConnected) return;
      this.showError(t('common.failedMarketData'), () => void this.fetchData());
    }
  }

  private renderChina(data: ListChinaQuotesResponse): void {
    if (!data.quotes.length) {
      const msg = data.rateLimited ? t('common.rateLimitedMarket') : t('common.failedMarketData');
      this.showError(msg, () => void this.fetchData());
      return;
    }

    const indices = data.quotes.filter(q => q.type === 'index');
    const etfs = data.quotes.filter(q => q.type === 'etf');
    const currencies = data.quotes.filter(q => q.type === 'currency');
    const commodities = data.quotes.filter(q => q.type === 'commodity');

    const html =
      renderSection(t('panels.chinaIndices'), indices) +
      renderSection(t('panels.chinaETFs'), etfs) +
      renderSection(t('panels.chinaCurrencies'), currencies) +
      renderSection(t('panels.chinaCommodities'), commodities);

    this.setContent(html);
  }
}
