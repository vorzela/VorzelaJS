export interface RobotsConfig {
  rules: RobotsRule[]
  sitemapUrl?: string
}

export interface RobotsRule {
  allow?: string[]
  crawlDelay?: number
  disallow?: string[]
  userAgent: string | string[]
}

const AI_TRAINING_CRAWLERS = [
  'CCBot',
  'ChatGPT-User',
  'GPTBot',
  'Google-Extended',
  'anthropic-ai',
  'Bytespider',
  'ClaudeBot',
  'Diffbot',
  'FacebookBot',
  'Omgilibot',
  'cohere-ai',
]

const AI_SEARCH_CRAWLERS = [
  'ChatGPT-User',
  'PerplexityBot',
  'YouBot',
]

export function defineRobotsConfig(config: RobotsConfig): RobotsConfig {
  return config
}

export function defaultRobotsConfig(options: { siteUrl?: string } = {}): RobotsConfig {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
      },
      {
        userAgent: AI_TRAINING_CRAWLERS,
        disallow: ['/'],
      },
      {
        userAgent: AI_SEARCH_CRAWLERS,
        allow: ['/'],
        crawlDelay: 2,
      },
    ],
    sitemapUrl: options.siteUrl ? `${options.siteUrl.replace(/\/$/u, '')}/sitemap.xml` : undefined,
  }
}

export function renderRobotsTxt(config: RobotsConfig): string {
  const lines: string[] = []

  for (const rule of config.rules) {
    const agents = Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent]

    for (const agent of agents) {
      lines.push(`User-agent: ${agent}`)
    }

    if (rule.allow) {
      for (const path of rule.allow) {
        lines.push(`Allow: ${path}`)
      }
    }

    if (rule.disallow) {
      for (const path of rule.disallow) {
        lines.push(`Disallow: ${path}`)
      }
    }

    if (rule.crawlDelay !== undefined) {
      lines.push(`Crawl-delay: ${rule.crawlDelay}`)
    }

    lines.push('')
  }

  if (config.sitemapUrl) {
    lines.push(`Sitemap: ${config.sitemapUrl}`)
    lines.push('')
  }

  return lines.join('\n')
}
