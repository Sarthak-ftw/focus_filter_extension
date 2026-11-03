export interface FilterMatchResult {
  shouldHide: boolean;
  matchedKeyword?: string;
  matchedType?: 'title' | 'channel' | 'shorts';
}

/**
 * Normalizes input strings by:
 * 1. Converting to Unicode Normalization Form KC (handles full-width chars & accents)
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
 * Pure Keyword, Channel, and Allowlist Matching Engine.
 */
export class FilterEngine {
  private keywords: string[] = [];
  private channels: string[] = [];
  private allowlist: string[] = [];
  private hideShorts: boolean = false;
  private isEnabled: boolean = true;

  // Precompiled regexes for optimal O(1) matching during high-frequency scrolls
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

  /**
   * Updates internal rules and pre-compiles regex patterns for performance.
   */
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

    // Compile blocked keywords
    this.compiledKeywordRegexes = this.keywords.map((kw) => {
      const escaped = escapeRegExp(kw);
      const pattern = /^\w+$/.test(kw) ? `\\b${escaped}\\b` : escaped;
      return { raw: kw, regex: new RegExp(pattern, 'i') };
    });

    // Compile allowlisted keywords
    this.compiledAllowlistRegexes = this.allowlist.map((kw) => {
      const escaped = escapeRegExp(kw);
      const pattern = /^\w+$/.test(kw) ? `\\b${escaped}\\b` : escaped;
      return { raw: kw, regex: new RegExp(pattern, 'i') };
    });
  }

  /**
   * Evaluates video card metadata against blocked rules.
   */
  public evaluate(
    title: string,
    channel: string = '',
    isShort: boolean = false
  ): FilterMatchResult {
    // If master shield is OFF, never hide anything
    if (!this.isEnabled) {
      return { shouldHide: false };
    }

    const normTitle = normalizeText(title);
    const normChannel = normalizeText(channel);

    // 0. PRIORITY CHECK: Allowlist takes precedence over all blocked rules
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

    // 1. Check Shorts toggle
    if (this.hideShorts && isShort) {
      return {
        shouldHide: true,
        matchedKeyword: 'Shorts',
        matchedType: 'shorts',
      };
    }

    // 2. Check Channel match
    if (normChannel && this.normalizedChannels.size > 0) {
      if (this.normalizedChannels.has(normChannel)) {
        return {
          shouldHide: true,
          matchedKeyword: channel,
          matchedType: 'channel',
        };
      }
    }

    // 3. Check Keyword match against title
    if (normTitle && this.compiledKeywordRegexes.length > 0) {
      for (const { raw, regex } of this.compiledKeywordRegexes) {
        if (regex.test(normTitle)) {
          return {
            shouldHide: true,
            matchedKeyword: raw,
            matchedType: 'title',
          };
        }
      }
    }

    // 4. Check Keyword match against channel name
    if (normChannel && this.compiledKeywordRegexes.length > 0) {
      for (const { raw, regex } of this.compiledKeywordRegexes) {
        if (regex.test(normChannel)) {
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
