export type SyntaxTheme = {
  name: string;
};

export class ColorDiff {
  format(input: string): string {
    return input;
  }
}

export class ColorFile {
  format(input: string): string {
    return input;
  }
}

export function getSyntaxTheme(themeName: string): SyntaxTheme {
  return { name: themeName };
}
