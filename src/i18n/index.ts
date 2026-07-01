import * as fs from 'fs';
import * as path from 'path';

export type Translations = { [key: string]: string };

let cachedTranslations: Translations | null = null;
let cachedLocale: string | null = null;

/**
 * Load translations for the specified locale.
 * @param locale The locale code (e.g. 'en', 'zh-cn')
 * @returns A translations object (key-value pairs)
 */
export function loadTranslations(locale: string): Translations {
	if (cachedTranslations !== null && cachedLocale === locale) {
		return cachedTranslations;
	}

	const filePath = path.join(__dirname, '..', 'i18n', locale + '.json');
	try {
		const raw = fs.readFileSync(filePath, 'utf8');
		cachedTranslations = JSON.parse(raw);
		cachedLocale = locale;
		return cachedTranslations!;
	} catch (e) {
		// Fallback to English if the locale file can't be loaded
		if (locale !== 'en') {
			return loadTranslations('en');
		}
		// If even English can't load, return empty object
		return {};
	}
}

/**
 * Format a translation string with positional parameters.
 * Example: format('Hello {0}, you have {1} messages', 'John', '5')
 * @param template The translation template with {0}, {1}, etc. placeholders
 * @param args Values to substitute
 * @returns Formatted string
 */
export function format(template: string, ...args: string[]): string {
	return template.replace(/\{(\d+)\}/g, (_, index) => {
		const i = parseInt(index, 10);
		return i < args.length ? args[i] : '?' + index + '?';
	});
}
