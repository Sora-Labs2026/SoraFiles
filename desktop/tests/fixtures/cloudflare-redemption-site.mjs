// Synthetic site's same-origin boundary, with no binding in production config.
import {desktopRedemptionRequest} from '../../../src/lib/desktop/redemption-edge.js';
export default {async fetch(request,env){
 // Miniflare protects its own local bridge from remote Origin headers. Recreate
 // the synthetic browser header after that bridge, before the production code.
 const headers=new Headers(request.headers);headers.set('Origin',headers.get('X-Test-Origin')||'');headers.delete('X-Test-Origin');
 return await desktopRedemptionRequest(new Request(request,{headers}),env)||new Response(null,{status:404});
}};
