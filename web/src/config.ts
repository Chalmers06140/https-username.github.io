declare global {interface Window {SVEAB_CONFIG?:{apiBase?:string}}}
const apiBase=window.SVEAB_CONFIG?.apiBase?.trim().replace(/\/$/,'')??'';
export const groupServiceReady=!!apiBase;
export function siteUrl(path:string){return new URL(path,new URL('../',import.meta.url)).href}
export function apiUrl(path:string){
  if(!apiBase)throw new Error('Group assignment is not set up yet. Ask the TA for the emergency link.');
  return apiBase+path;
}
