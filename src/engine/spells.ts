// Spell recognition system with fuzzy matching

export interface SpellDefinition {
  incantation: string;
  variations?: string[];
  category: 'light' | 'defense' | 'offense' | 'utility' | 'healing' | 'unforgivable' | 'movement' | 'stealth';
}

// All recognized spells in the game
export const SPELLS: Record<string, SpellDefinition> = {
  // Light spells
  'lumos': { incantation: 'lumos', category: 'light' },
  'lumos maxima': { incantation: 'lumos maxima', category: 'light' },
  'nox': { incantation: 'nox', category: 'light' },

  // Defense spells
  'protego': { incantation: 'protego', category: 'defense' },
  'protego maxima': { incantation: 'protego maxima', category: 'defense' },
  'expecto patronum': { incantation: 'expecto patronum', category: 'defense' },
  'salvio hexia': { incantation: 'salvio hexia', category: 'defense' },

  // Offense spells
  'stupefy': { incantation: 'stupefy', category: 'offense' },
  'expelliarmus': { incantation: 'expelliarmus', category: 'offense' },
  'petrificus totalus': { incantation: 'petrificus totalus', category: 'offense' },
  'impedimenta': { incantation: 'impedimenta', category: 'offense' },
  'reducto': { incantation: 'reducto', category: 'offense' },
  'incendio': { incantation: 'incendio', category: 'offense' },
  'confringo': { incantation: 'confringo', category: 'offense' },
  'bombarda': { incantation: 'bombarda', category: 'offense' },
  'diffindo': { incantation: 'diffindo', category: 'offense' },
  'flipendo': { incantation: 'flipendo', category: 'offense' },
  'depulso': { incantation: 'depulso', category: 'offense' },
  'rictusempra': { incantation: 'rictusempra', category: 'offense' },
  'incarcerous': { incantation: 'incarcerous', category: 'offense' },
  'levicorpus': { incantation: 'levicorpus', category: 'offense' },
  'locomotor mortis': { incantation: 'locomotor mortis', category: 'offense' },
  'tarantallegra': { incantation: 'tarantallegra', category: 'offense' },
  'densaugeo': { incantation: 'densaugeo', category: 'offense' },
  'furnunculus': { incantation: 'furnunculus', category: 'offense' },
  'sectumsempra': { incantation: 'sectumsempra', category: 'offense' },

  // Utility spells
  'wingardium leviosa': { incantation: 'wingardium leviosa', category: 'utility' },
  'accio': { incantation: 'accio', category: 'utility' },
  'alohomora': { incantation: 'alohomora', category: 'utility' },
  'reparo': { incantation: 'reparo', category: 'utility' },
  'revelio': { incantation: 'revelio', category: 'utility' },
  'homenum revelio': { incantation: 'homenum revelio', category: 'utility' },
  'finite incantatem': { incantation: 'finite incantatem', category: 'utility' },
  'aguamenti': { incantation: 'aguamenti', category: 'utility' },
  'sonorus': { incantation: 'sonorus', category: 'utility' },
  'quietus': { incantation: 'quietus', category: 'utility' },
  'point me': { incantation: 'point me', category: 'utility' },
  'pack': { incantation: 'pack', category: 'utility' },
  'reducio': { incantation: 'reducio', category: 'utility' },
  'engorgio': { incantation: 'engorgio', category: 'utility' },

  // Mind spells
  'confundo': { incantation: 'confundo', category: 'utility' },
  'obliviate': { incantation: 'obliviate', category: 'utility' },

  // Healing spells
  'episkey': { incantation: 'episkey', category: 'healing' },
  'vulnera sanentur': { incantation: 'vulnera sanentur', category: 'healing' },
  'tergeo': { incantation: 'tergeo', category: 'healing' },

  // Unforgivable curses
  'avada kedavra': { incantation: 'avada kedavra', category: 'unforgivable' },
  'crucio': { incantation: 'crucio', category: 'unforgivable' },
  'imperio': { incantation: 'imperio', category: 'unforgivable' },
};

// Levenshtein distance for fuzzy matching
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

// Match a spell with fuzzy tolerance
export function matchSpell(input: string): { spell: string; exact: boolean } | null {
  const normalized = input.toLowerCase().trim();

  // First try exact match
  if (SPELLS[normalized]) {
    return { spell: normalized, exact: true };
  }

  // Try fuzzy matching with Levenshtein distance of 1-2
  let bestMatch: { spell: string; distance: number } | null = null;

  for (const spellName of Object.keys(SPELLS)) {
    const distance = levenshteinDistance(normalized, spellName);

    // Allow distance of up to 2 for longer spells, 1 for shorter ones
    const maxDistance = spellName.length > 8 ? 2 : 1;

    if (distance <= maxDistance) {
      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { spell: spellName, distance };
      }
    }
  }

  if (bestMatch) {
    return { spell: bestMatch.spell, exact: bestMatch.distance === 0 };
  }

  return null;
}

// Check if input is an unforgivable curse
export function isUnforgivable(input: string): boolean {
  const normalized = input.toLowerCase().trim();
  const match = matchSpell(normalized);
  if (match) {
    return SPELLS[match.spell]?.category === 'unforgivable';
  }
  return false;
}

// Get spell category
export function getSpellCategory(spell: string): string | null {
  return SPELLS[spell]?.category || null;
}
