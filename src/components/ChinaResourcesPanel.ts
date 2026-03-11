import { Panel } from './Panel';
import { t } from '@/services/i18n';
import { escapeHtml, sanitizeUrl } from '@/utils/sanitize';

interface ChinaResourceLink {
  name: string;
  description: string;
  url: string;
  tag: string;
}

const CHINA_RESOURCE_LINKS: ChinaResourceLink[] = [
  {
    name: 'CLS',
    description: 'Real-time mainland market coverage and fast financial headlines.',
    url: 'https://www.cls.cn/',
    tag: 'Markets',
  },
  {
    name: 'Yicai',
    description: 'Business and policy reporting with strong China macro coverage.',
    url: 'https://www.yicai.com/',
    tag: 'Business',
  },
  {
    name: 'Eastmoney',
    description: 'Retail-market sentiment, quotes, and broad A-share coverage.',
    url: 'https://www.eastmoney.com/',
    tag: 'Retail',
  },
  {
    name: 'PBOC',
    description: 'Official People\'s Bank of China notices and monetary policy updates.',
    url: 'http://www.pbc.gov.cn/',
    tag: 'Policy',
  },
  {
    name: 'SSE',
    description: 'Shanghai Stock Exchange announcements, listings, and notices.',
    url: 'https://www.sse.com.cn/',
    tag: 'Exchange',
  },
  {
    name: 'SZSE',
    description: 'Shenzhen Stock Exchange filings, products, and market notices.',
    url: 'https://www.szse.cn/',
    tag: 'Exchange',
  },
  {
    name: 'SAFE',
    description: 'Foreign-exchange administration updates, capital-flow policy, and notices.',
    url: 'https://www.safe.gov.cn/',
    tag: 'FX',
  },
  {
    name: 'MIIT',
    description: 'Industry, manufacturing, and industrial policy announcements.',
    url: 'https://www.miit.gov.cn/',
    tag: 'Industry',
  },
];

export class ChinaResourcesPanel extends Panel {
  constructor() {
    super({
      id: 'china-resources',
      title: t('panels.chinaResources'),
      className: 'panel-wide',
    });
    this.render();
  }

  private render(): void {
    const html = CHINA_RESOURCE_LINKS.map((resource) => `
      <a class="china-resource-card" href="${sanitizeUrl(resource.url)}" target="_blank" rel="noopener noreferrer">
        <div class="china-resource-card-header">
          <span class="china-resource-card-name">${escapeHtml(resource.name)}</span>
          <span class="china-resource-card-tag">${escapeHtml(resource.tag)}</span>
        </div>
        <div class="china-resource-card-description">${escapeHtml(resource.description)}</div>
      </a>
    `).join('');

    this.setContent(`<div class="china-resource-grid">${html}</div>`);
  }
}