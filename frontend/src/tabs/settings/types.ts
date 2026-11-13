import { Theme } from '../../theme/theme';
import { TranslationDict } from '../../utils/translations';

export type Translate = <K extends keyof TranslationDict>(
  key: K,
  replacements?: Record<string, string | number>,
) => TranslationDict[K];

export interface SectionStyleProps {
  styles: any;
  theme: Theme;
  t: Translate;
}
