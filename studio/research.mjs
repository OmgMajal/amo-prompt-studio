/**
 * Optional web-research boundary. Search results are evidence to assess, not
 * business facts. The default endpoint is a public, keyless search service;
 * the studio never sends credentials or publishes anything.
 */
const DEFAULT_ENDPOINT = 'https://api.duckduckgo.com/';

function endpoint() {
  const value = process.env.STUDIO_SEARCH_ENDPOINT || DEFAULT_ENDPOINT;
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') throw new Error('Search endpoint must use HTTPS or loopback.');
  return url;
}

function clean(value, limit = 240) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit); }

function flattenTopics(items = [], result = []) {
  for (const item of items) {
    if (item.Topics) flattenTopics(item.Topics, result);
    if (item.Text && item.FirstURL) result.push({ title: clean(item.Text.split(' - ')[0], 160), snippet: clean(item.Text), url: item.FirstURL });
  }
  return result;
}

function queryFor(target, brief) {
  return `${brief.niche || 'business'} ${target.platformName} ${target.surfaceName} content strategy ${brief.audience}`.trim();
}

export async function researchBrief({ brief, platformTargets = [], signal } = {}) {
  const queries = [...new Map(platformTargets.map(target => [target.id, queryFor(target, brief)])).values()].slice(0, 6);
  const sources = [];
  const errors = [];
  for (const query of queries) {
    try {
      const url = endpoint();
      url.search = new URLSearchParams({ q: query, format: 'json', no_html: '1', skip_disambig: '1' }).toString();
      const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000);
      const response = await fetch(url, { signal: requestSignal, headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`Search returned ${response.status}.`);
      const data = await response.json();
      const found = [
        ...(data.AbstractText && data.AbstractURL ? [{ title: clean(data.Heading || query, 160), snippet: clean(data.AbstractText), url: data.AbstractURL }] : []),
        ...flattenTopics(data.RelatedTopics)
      ];
      for (const item of found.slice(0, 8)) {
        let safeUrl; try { safeUrl = new URL(item.url); } catch { continue; }
        if (!['http:', 'https:'].includes(safeUrl.protocol)) continue;
        if (!sources.some(source => source.url === item.url)) sources.push({
          id: `web-${sources.length + 1}`,
          query,
          title: item.title,
          snippet: item.snippet,
          url: item.url,
          source: 'web_search_result',
          verification: 'unverified_search_result',
          retrievedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      errors.push({ query, reason: ['AbortError', 'TimeoutError'].includes(error.name) ? 'Search timed out.' : 'Search unavailable.' });
    }
  }
  return { enabled: true, provider: 'duckduckgo_api_or_configured_endpoint', queries, sources, errors, status: sources.length ? 'completed_with_unverified_sources' : errors.length ? 'unavailable' : 'no_results', limitations: ['Search snippets can be incomplete, stale, or wrong.', 'Sources are not business facts until a human verifies them.', 'No source is used to invent prices, claims, schedules, or customer data.'] };
}

export function previewResearch({ brief, platformTargets = [] } = {}) {
  return { enabled: true, provider: 'preview_only', queries: platformTargets.slice(0, 6).map(target => queryFor(target, brief)), sources: [], errors: [], status: 'example_only', limitations: ['Preview did not contact the web.', 'Run live with web research enabled to collect source candidates.'] };
}
