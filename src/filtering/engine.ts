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
 * Pure Keyword and Channel Matching Engine.
 * Does not touch the DOM, making it 100% testable in unit tests or node environments.
 */
export class FilterEngine {
  private keywords: string[] = [];
  private channels: string[] = [];
  private hideShorts: boolean = false;
  private isEnabled: boolean = true;

  // Precompiled regexes for optimal O(1) matching during high-frequency scrolls
  private compiledKeywordRegexes: { raw: string; regex: RegExp }[] = [];
  private normalizedChannels: Set<string> = new Set();

  constructor(
    keywords: string[] = [],
    channels: string[] = [],
    hideShorts: boolean = false,
    isEnabled: boolean = true
  ) {
    this.updateRules(keywords, channels, hideShorts, isEnabled);
  }

  /**
   * Updates internal rules and pre-compiles regex patterns for performance.
   */
  public updateRules(
    keywords: string[],
    channels: string[],
    hideShorts: boolean,
    isEnabled: boolean
  ): void {
    this.isEnabled = isEnabled;
    this.hideShorts = hideShorts;
    this.keywords = keywords.map(normalizeText).filter(Boolean);
    this.channels = channels.map(normalizeText).filter(Boolean);

    this.normalizedChannels = new Set(this.channels);

    // Compile regexes using word boundary check when possible, or substring boundary
    this.compiledKeywordRegexes = this.keywords.map((kw) => {
      const escaped = escapeRegExp(kw);
      // If keyword consists solely of word characters, check word boundaries \b
      // Otherwise fallback to escaped substring search
      const pattern = /^\w+$/.test(kw)
        ? `\\b${escaped}\\b`
        : escaped;

      return {
        raw: kw,
        regex: new RegExp(pattern, 'i'),
      };
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

    // 1. Check Shorts toggle
    if (this.hideShorts && isShort) {
      return {
        shouldHide: true,
        matchedKeyword: 'Shorts',
        matchedType: 'shorts',
      };
    }

    const normTitle = normalizeText(title);
    const normChannel = normalizeText(channel);

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
