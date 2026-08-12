export interface StringLengthStats {
  weightedLength: number;
  characterCount: number;
  chinese: number;
  letters: number;
  numbers: number;
  spaces: number;
  halfWidth: number;
  fullWidth: number;
  lineBreaks: number;
  lineCount: number;
}

const CHINESE_CHARACTER = /\p{Script=Han}/u;
const ASCII_LETTER = /[A-Za-z]/;
const ASCII_NUMBER = /[0-9]/;

function isFullWidthCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0) ?? 0;
  return codePoint === 0x3000 || (codePoint >= 0xff01 && codePoint <= 0xff60) || (codePoint >= 0xffe0 && codePoint <= 0xffe6);
}

export function calculateStringLength(text: string): StringLengthStats {
  const normalized = text.replace(/\r\n?/g, "\n");
  const stats: StringLengthStats = {
    weightedLength: 0,
    characterCount: 0,
    chinese: 0,
    letters: 0,
    numbers: 0,
    spaces: 0,
    halfWidth: 0,
    fullWidth: 0,
    lineBreaks: 0,
    lineCount: 1,
  };

  for (const character of normalized) {
    if (character === "\n") {
      stats.lineBreaks += 1;
      stats.halfWidth += 1;
      continue;
    }

    stats.characterCount += 1;
    if (CHINESE_CHARACTER.test(character)) {
      stats.chinese += 1;
      stats.weightedLength += 2;
    } else if (isFullWidthCharacter(character)) {
      stats.fullWidth += 1;
      stats.weightedLength += 2;
    } else {
      stats.halfWidth += 1;
      stats.weightedLength += 1;
    }

    if (ASCII_LETTER.test(character)) stats.letters += 1;
    if (ASCII_NUMBER.test(character)) stats.numbers += 1;
    if (character === " " || character === "\u00a0" || character === "\u3000") stats.spaces += 1;
  }

  stats.lineCount += stats.lineBreaks;
  return stats;
}