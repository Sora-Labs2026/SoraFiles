import catalogs from './locales/menu.json' with {type:'json'};
export function translateMenu(locale,source){return Object.hasOwn(catalogs,locale)&&Object.hasOwn(catalogs[locale],source)?catalogs[locale][source]:source;}
export function localizeNativeActions(actions,locale){return actions.map(action=>({...action,name:translateMenu(locale,action.name),label:translateMenu(locale,action.label)}));}
