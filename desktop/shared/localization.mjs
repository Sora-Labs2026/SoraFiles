import catalogs from './locales/catalogs.json' with {type:'json'};
export function translate(locale,source){return Object.hasOwn(catalogs,locale)&&Object.hasOwn(catalogs[locale],source)?catalogs[locale][source]:source;}
