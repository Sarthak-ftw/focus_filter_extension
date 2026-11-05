/**
 * Focus Filter — End-to-End Test Suite
 * Run with: node scripts/test-engine.mjs
 *
 * Tests the core FilterEngine in pure Node.js (no browser required).
 * This runs your business logic in complete isolation from the DOM.
 */

// --- Inline the engine since we can't import TS directly ---

function normalizeText(text) {
  if (!text) return '';
  return text.normalize('NFKC').toLowerCase().trim();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileKeywordPattern(keyword) {
  const escaped = escapeRegExp(keyword);
  if (/^\w+$/.test(keyword)) {
    return new RegExp(`\\b${escaped}(?:s|es|d|ed|ing|ry|r)?\\b|${escaped}`, 'i');
  }
  return new RegExp(escaped, 'i');
}

class FilterEngine {
  constructor(keywords = [], channels = [], allowlist = [], hideShorts = false, isEnabled = true) {
    this.updateRules(keywords, channels, allowlist, hideShorts, isEnabled);
  }

  updateRules(keywords, channels, allowlist, hideShorts, isEnabled) {
    this.isEnabled = isEnabled;
    this.hideShorts = hideShorts;
    this.keywords = keywords.map(normalizeText).filter(Boolean);
    this.channels = channels.map(normalizeText).filter(Boolean);
    this.allowlist = allowlist.map(normalizeText).filter(Boolean);
    this.normalizedChannels = new Set(this.channels);
    this.normalizedAllowlist = new Set(this.allowlist);
    this.compiledKeywordRegexes = this.keywords.map(kw => ({
      raw: kw,
      regex: compileKeywordPattern(kw),
    }));
    this.compiledAllowlistRegexes = this.allowlist.map(kw => ({
      raw: kw,
      regex: compileKeywordPattern(kw),
    }));
  }

  evaluate(title, channel = '', isShort = false) {
    if (!this.isEnabled) return { shouldHide: false };

    const normTitle = normalizeText(title);
    const normChannel = normalizeText(channel);

    if (normChannel && this.normalizedAllowlist.has(normChannel))
      return { shouldHide: false };

    for (const { regex } of this.compiledAllowlistRegexes)
      if (regex.test(normTitle)) return { shouldHide: false };

    if (this.hideShorts && isShort)
      return { shouldHide: true, matchedKeyword: 'Shorts', matchedType: 'shorts' };

    if (normChannel && this.normalizedChannels.has(normChannel))
      return { shouldHide: true, matchedKeyword: channel, matchedType: 'channel' };

    for (const { raw, regex } of this.compiledKeywordRegexes) {
      if (regex.test(normTitle) || normTitle.includes(raw))
        return { shouldHide: true, matchedKeyword: raw, matchedType: 'title' };
    }

    for (const { raw, regex } of this.compiledKeywordRegexes) {
      if (regex.test(normChannel) || normChannel.includes(raw))
        return { shouldHide: true, matchedKeyword: raw, matchedType: 'channel' };
    }

    return { shouldHide: false };
  }
}

// --- Test Framework ---
let passed = 0, failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✅  ${description}`);
    passed++;
  } catch (err) {
    console.log(`  ❌  ${description}`);
    console.log(`      → ${err.message}`);
    failed++;
  }
}

function expect(value) {
  return {
    toBe(expected) {
      if (value !== expected)
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
    },
    toBeTrue() { this.toBe(true); },
    toBeFalse() { this.toBe(false); },
  };
}

// --- TESTS ---

const engine = new FilterEngine(
  ['perfume', 'fragrance', 'gaming', 'cologne'],
  ['FragranceOne', 'GamingHub'],
  ['MIT OpenCourseWare', 'Khan Academy', 'CrashCourse'],
  false, // hideShorts
  true   // isEnabled
);

console.log('\n📋 Focus Filter — FilterEngine Test Suite\n');
console.log('─────────────────────────────────────────');

console.log('\n🔵 Basic Keyword Matching:');
test('Exact keyword in title', () => {
  expect(engine.evaluate('Best Perfume of 2026').shouldHide).toBeTrue();
});
test('Plural form of keyword (perfumes)', () => {
  expect(engine.evaluate('Top 10 Perfumes for Men').shouldHide).toBeTrue();
});
test('Multi-word keyword phrase', () => {
  const e2 = new FilterEngine(['dior sauvage'], [], [], false, true);
  expect(e2.evaluate('Dior Sauvage vs Bleu Review').shouldHide).toBeTrue();
});
test('Case-insensitive matching', () => {
  expect(engine.evaluate('BEST FRAGRANCE REVIEW').shouldHide).toBeTrue();
});
test('Non-distracting video stays visible', () => {
  expect(engine.evaluate('Linear Algebra – MIT Lecture 7').shouldHide).toBeFalse();
});
test('Empty title does not crash', () => {
  expect(engine.evaluate('').shouldHide).toBeFalse();
});
test('Unicode normalized matching', () => {
  expect(engine.evaluate('Réview: Parfúme Collection').shouldHide).toBeFalse(); // "parfume" ≠ "perfume"
});

console.log('\n🔵 Channel Blocking:');
test('Blocked channel name matches exactly', () => {
  expect(engine.evaluate('Video Title', 'FragranceOne').shouldHide).toBeTrue();
});
test('Channel with keyword in name is blocked', () => {
  expect(engine.evaluate('My Vlog', 'GamingHub').shouldHide).toBeTrue();
});
test('Unrelated channel stays visible', () => {
  expect(engine.evaluate('Science Lecture', 'Prof. Smith').shouldHide).toBeFalse();
});

console.log('\n🔵 Allowlist Priority:');
test('Allowlisted channel is never hidden even with keyword in title', () => {
  expect(engine.evaluate('The Chemistry of Perfume Esters', 'MIT OpenCourseWare').shouldHide).toBeFalse();
});
test('Allowlisted keyword in title protects video', () => {
  expect(engine.evaluate('Khan Academy – Math for Beginners').shouldHide).toBeFalse();
});
test('Allowlist channel case-insensitive', () => {
  expect(engine.evaluate('Some Course', 'mit opencourseware').shouldHide).toBeFalse();
});

console.log('\n🔵 Filter Toggle:');
test('Disabled engine never hides anything', () => {
  engine.updateRules(['perfume', 'fragrance', 'gaming'], [], [], false, false);
  expect(engine.evaluate('Best Perfumes 2026').shouldHide).toBeFalse();
  engine.updateRules(['perfume', 'fragrance', 'gaming'], [], [], false, true);
});

console.log('\n🔵 Shorts:');
test('Shorts blocked when hideShorts is true', () => {
  engine.updateRules(['perfume'], [], [], true, true);
  expect(engine.evaluate('Some Random Title', '', true).shouldHide).toBeTrue();
  engine.updateRules(['perfume'], [], [], false, true);
});
test('Shorts NOT blocked when hideShorts is false', () => {
  expect(engine.evaluate('Some Random Title', '', true).shouldHide).toBeFalse();
});

console.log('\n🔵 Edge Cases:');
test('Duplicate keyword matching does not crash', () => {
  const e3 = new FilterEngine(['perfume', 'perfume', 'PERFUME'], [], [], false, true);
  expect(e3.evaluate('Perfume Review').shouldHide).toBeTrue();
});
test('Empty keyword list hides nothing', () => {
  const e4 = new FilterEngine([], [], [], false, true);
  expect(e4.evaluate('Best Perfume of All Time').shouldHide).toBeFalse();
});
test('Very long title does not crash', () => {
  const longTitle = 'A'.repeat(5000);
  expect(engine.evaluate(longTitle).shouldHide).toBeFalse();
});

// Summary
console.log('\n─────────────────────────────────────────');
console.log(`\n🏁 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) process.exit(1);
