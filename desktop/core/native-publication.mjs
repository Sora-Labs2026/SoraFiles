import {AsyncLocalStorage} from 'node:async_hooks';
// Installed only by the private native pipe, never by renderer options.
const publication=new AsyncLocalStorage();
export const withOutputPublisher=(publisher,run)=>publication.run(publisher,run);
export const currentOutputPublisher=()=>publication.getStore();
