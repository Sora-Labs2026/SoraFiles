import { defineMiddleware } from 'astro:middleware';
import catalogs from './i18n/desktop-web.json';
import {translateDesktopHtml} from './i18n/desktop-html.mjs';
import {localizedRoutePaths} from './i18n/config';

// All language routes are explicit; never redirect based on browser language.
// Desktop translations change text/link ranges in the shared rendered prototype.
export const onRequest = defineMiddleware(async(context,next) => {
 const response=await next();
 const match=context.url.pathname.match(/^\/([^/]+)\/desktop(?:\/|$)/);
 if(!match||!Object.hasOwn(catalogs,match[1])||!response.headers.get('content-type')?.includes('text/html'))return response;
 const html=translateDesktopHtml(await response.text(),match[1],catalogs[match[1] as keyof typeof catalogs],localizedRoutePaths);
 const headers=new Headers(response.headers);headers.delete('content-length');
 return new Response(html,{status:response.status,statusText:response.statusText,headers});
});
