export interface FilterMatchResult {
  shouldHide: boolean;
  matchedKeyword?: string;
  matchedType?: 'title' | 'channel' | 'shorts';
}

/**
 * Normalizes input strings by:
 * 1. Converting to Unicode Normalization Form KC
 * 2. Lowercasing
 * 3. Stripping redundant surrounding whitespaces
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFKC')
    .toLowerCase()
    .trim();
}

/**
 * Escapes characters that have special meaning in Regular Expressions.
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compiles a keyword into a robust regex:
 * - Word boundary at start (\b)
 * - Allows common plural/suffix variations (s, es, ed, ing, d)
 * - If keyword contains spaces or symbols, uses exact escaped match
 */
function compileKeywordPattern(keyword: string): RegExp {
  const escaped = escapeRegExp(keyword);

  // If keyword is a single word (e.g. "perfume", "fragrance", "game")
  if (/^\w+$/.test(keyword)) {
    // Matches "perfume", "perfumes", "perfumed", "perfumery"
    // Also matches "fragrance", "fragrances"
    return new RegExp(`\\b${escaped}(?:s|es|d|ed|ing|ry|r)?\\b|${escaped}`, 'i');
  }

  // Multi-word phrase (e.g. "dior sauvage", "best perfumes")
  return new RegExp(escaped, 'i');
}

/**
 * Pure Keyword, Channel, and Allowlist Matching Engine.
 */
export class FilterEngine {
  private keywords: string[] = [];
  private channels: string[] = [];
  private allowlist: string[] = [];
  private hideShorts: boolean = false;
  private isEnabled: boolean = true;

  private compiledKeywordRegexes: { raw: string; regex: RegExp }[] = [];
  private compiledAllowlistRegexes: { raw: string; regex: RegExp }[] = [];
  private normalizedChannels: Set<string> = new Set();
  private normalizedAllowlist: Set<string> = new Set();

  constructor(
    keywords: string[] = [],
    channels: string[] = [],
    allowlist: string[] = [],
    hideShorts: boolean = false,
    isEnabled: boolean = true
  ) {
    this.updateRules(keywords, channels, allowlist, hideShorts, isEnabled);
  }

  public updateRules(
    keywords: string[],
    channels: string[],
    allowlist: string[],
    hideShorts: boolean,
    isEnabled: boolean
  ): void {
    this.isEnabled = isEnabled;
    this.hideShorts = hideShorts;
    this.keywords = keywords.map(normalizeText).filter(Boolean);
    this.channels = channels.map(normalizeText).filter(Boolean);
    this.allowlist = allowlist.map(normalizeText).filter(Boolean);

    this.normalizedChannels = new Set(this.channels);
    this.normalizedAllowlist = new Set(this.allowlist);

    // Compile regexes with flexible plural/suffix support
    this.compiledKeywordRegexes = this.keywords.map((kw) => ({
      raw: kw,
      regex: compileKeywordPattern(kw),
    }));

    this.compiledAllowlistRegexes = this.allowlist.map((kw) => ({
      raw: kw,
      regex: compileKeywordPattern(kw),
    }));
  }

  public evaluate(
    title: string,
    channel: string = '',
    isShort: boolean = false
  ): FilterMatchResult {
    if (!this.isEnabled) {
      return { shouldHide: false };
    }

    const normTitle = normalizeText(title);
    const normChannel = normalizeText(channel);

    // 0. Priority: Allowlist Check
    if (normChannel && this.normalizedAllowlist.has(normChannel)) {
      return { shouldHide: false };
    }

    if (normTitle && this.compiledAllowlistRegexes.length > 0) {
      for (const { regex } of this.compiledAllowlistRegexes) {
        if (regex.test(normTitle)) {
          return { shouldHide: false };
        }
      }
    }

    // 1. Shorts Filter
    if (this.hideShorts && isShort) {
      return {
        shouldHide: true,
        matchedKeyword: 'Shorts',
        matchedType: 'shorts',
      };
    }

    // 2. Blocked Channels Check
    if (normChannel && this.normalizedChannels.size > 0) {
      if (this.normalizedChannels.has(normChannel)) {
        return {
          shouldHide: true,
          matchedKeyword: channel,
          matchedType: 'channel',
        };
      }
    }

    // 3. Blocked Keywords Check against Title
    if (normTitle && this.compiledKeywordRegexes.length > 0) {
      for (const { raw, regex } of this.compiledKeywordRegexes) {
        if (regex.test(normTitle) || normTitle.includes(raw)) {
          return {
            shouldHide: true,
            matchedKeyword: raw,
            matchedType: 'title',
          };
        }
      }
    }

    // 4. Blocked Keywords Check against Channel
    if (normChannel && this.compiledKeywordRegexes.length > 0) {
      for (const { raw, regex } of this.compiledKeywordRegexes) {
        if (regex.test(normChannel) || normChannel.includes(raw)) {
          return {
            shouldHide: true,
            matchedKeyword: raw,
            matchedType: 'channel',
          };
        }
      }
    }

    return { shouldHide: false };
  }
}
