import { browser } from '$app/environment';
import { isAvailableLanguageTag, setLanguageTag, sourceLanguageTag, type AvailableLanguageTag } from '$i18n/runtime';
import { derived, writable } from 'svelte/store';

const localeCharSubsetMap = new Map<AvailableLanguageTag, string[]>([['en', ['latin', 'latin-ext']]]);

const LocalStorageLocaleKey = 'locale';

const { subscribe, set } = writable<AvailableLanguageTag>();

export const locale = {
  subscribe,
  set(locale: AvailableLanguageTag) {
    setLanguageTag(locale);
    localStorage.setItem(LocalStorageLocaleKey, locale);
    set(locale);
  },
};

export const localeCharSubset = derived(locale, $locale => localeCharSubsetMap.get($locale));

export function initLocaleStore() {
  function initLocale(locale: AvailableLanguageTag) {
    setLanguageTag(locale);
    set(locale);
  }

  if (browser) {
    let localeTag: string | null = localStorage.getItem(LocalStorageLocaleKey);
    if (isAvailableLanguageTag(localeTag)) {
      initLocale(localeTag);
      return;
    }

    for (const lang of navigator.languages) {
      const intl = new Intl.Locale(lang);
      if (isAvailableLanguageTag(intl.language)) {
        initLocale(intl.language);
        return;
      }
    }
  }

  initLocale(sourceLanguageTag);
}
