// The catalog of documented AI crawlers.
//
// Every entry is documented by the operator that runs the crawler, and `source`
// links to the page the description is drawn from. The value of this project is
// that the table is true, so do not add a crawler that cannot be sourced to its
// operator's own documentation.
//
// group 'answer'   the crawler decides whether you can be cited in that
//                  assistant's answers; blocking it costs you visibility.
// group 'training' the crawler gathers content for model training; blocking it
//                  has no search or answer cost. The two groups are reported
//                  separately on purpose, because people routinely conflate them.
// ignoresRobots    the operator itself states this agent may fetch a page
//                  regardless of robots.txt, usually because the fetch is
//                  initiated by a user asking about that specific page.

export const CATALOG = [
  // OpenAI
  { id: 'OAI-SearchBot', company: 'OpenAI', group: 'answer', what: 'Surfaces your site in ChatGPT search results.', source: 'https://developers.openai.com/api/docs/bots' },
  { id: 'ChatGPT-User', company: 'OpenAI', group: 'answer', what: 'Visits a page when a ChatGPT user asks about it.', source: 'https://developers.openai.com/api/docs/bots' },
  { id: 'GPTBot', company: 'OpenAI', group: 'training', what: 'Crawls content that may be used to train OpenAI foundation models.', source: 'https://developers.openai.com/api/docs/bots' },
  // Anthropic
  { id: 'Claude-SearchBot', company: 'Anthropic', group: 'answer', what: 'Indexes pages to improve Claude search results.', source: 'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler' },
  { id: 'Claude-User', company: 'Anthropic', group: 'answer', what: 'Visits a page when a Claude user asks about it.', source: 'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler' },
  { id: 'ClaudeBot', company: 'Anthropic', group: 'training', what: 'Collects web content that may contribute to training Anthropic models.', source: 'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler' },
  // Perplexity
  { id: 'PerplexityBot', company: 'Perplexity', group: 'answer', what: 'Surfaces and links your site in Perplexity results. Not used for training.', source: 'https://docs.perplexity.ai/guides/bots' },
  { id: 'Perplexity-User', company: 'Perplexity', group: 'answer', what: 'Visits a page to answer a specific user question.', ignoresRobots: true, note: 'Perplexity states this agent generally disregards robots.txt because the visit is user-initiated.', source: 'https://docs.perplexity.ai/guides/bots' },
  // Google
  { id: 'Google-Extended', company: 'Google', group: 'training', what: 'Controls whether your content trains and grounds Gemini models.', note: 'Google states this does not affect your inclusion or ranking in Google Search.', source: 'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers' },
  { id: 'Google-CloudVertexBot', company: 'Google', group: 'training', what: 'Crawls sites for Vertex AI agents built by site owners.', source: 'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers' },
  // Apple
  { id: 'Applebot', company: 'Apple', group: 'answer', what: 'Indexes your site for Siri and Spotlight Suggestions.', source: 'https://support.apple.com/en-us/119829' },
  { id: 'Applebot-Extended', company: 'Apple', group: 'training', what: "Opts your content out of training Apple's foundation models.", note: 'This does not stop Applebot from crawling you for Siri and Spotlight.', source: 'https://support.apple.com/en-us/119829' },
  // Meta
  { id: 'meta-externalfetcher', company: 'Meta', group: 'answer', what: 'Fetches a link at a user request to support Meta AI features.', ignoresRobots: true, note: 'Meta states this agent may bypass robots.txt because the fetch is user-initiated.', source: 'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/' },
  { id: 'meta-externalagent', company: 'Meta', group: 'training', what: 'Indexes content to train foundation models or improve products.', source: 'https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/' },
  // Mistral
  { id: 'MistralAI-Index', company: 'Mistral', group: 'answer', what: 'Indexes the web to power Mistral search. Not used for training.', source: 'https://docs.mistral.ai/robots/' },
  { id: 'MistralAI-User', company: 'Mistral', group: 'answer', what: 'Visits a page when a Mistral user asks about it.', source: 'https://docs.mistral.ai/robots/' },
  // Common Crawl
  { id: 'CCBot', company: 'Common Crawl', group: 'training', what: 'Builds the open Common Crawl dataset, a common source of AI training data.', source: 'https://commoncrawl.org/ccbot' },
  // Amazon
  { id: 'Amazonbot', company: 'Amazon', group: 'training', what: 'Improves Amazon products and services, and may train Amazon AI models.', source: 'https://developer.amazon.com/amazonbot' },
];
