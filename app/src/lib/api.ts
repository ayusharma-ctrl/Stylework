import {QueryClient} from '@tanstack/react-query';
import {useSession} from './store';
export const API=(import.meta.env.VITE_API_URL||'http://localhost:3000').replace(/\/$/,'');
export class ApiError extends Error {constructor(message:string,public status:number,public requestId?:string){super(message);}}
export const queryClient=new QueryClient({defaultOptions:{queries:{staleTime:30000,gcTime:300000,refetchOnWindowFocus:false,retry:(count,error)=>count<2&&(!(error instanceof ApiError)||error.status>=500)},mutations:{retry:false}}});
export function authHeaders():Record<string,string>{const tokens=useSession.getState().tokens;return tokens?{Authorization:'Bearer '+tokens.accessToken,'X-Refresh-Token':tokens.refreshToken}:{};}
export function renew(response:Response){const accessToken=response.headers.get('X-Access-Token'),accessExpiresAt=response.headers.get('X-Access-Token-Expires-At'),tokens=useSession.getState().tokens;if(tokens&&accessToken&&accessExpiresAt&&accessExpiresAt>=tokens.accessExpiresAt)useSession.getState().setTokens({...tokens,accessToken,accessExpiresAt});}
export function clearSession(){useSession.getState().setTokens(null);queryClient.clear();}
async function request(path:string,options:RequestInit={}){
 const headers=new Headers({'Content-Type':'application/json',...authHeaders()});new Headers(options.headers).forEach((value,key)=>headers.set(key,value));
 const response=await fetch(API+path,{...options,headers,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
 renew(response);const body=await response.json();
 if(!response.ok){if(response.status===401)clearSession();throw new ApiError(body.error?.message||body.errors?.[0]?.message||'Request failed. Please try again.',response.status,body.meta?.requestId||response.headers.get('X-Request-ID')||undefined);}
 return body;
}
export async function api<T>(path:string,options:RequestInit={}):Promise<T>{return (await request(path,options)).data;}
export async function graphql<T>(query:string,variables:Record<string,unknown>,signal?:AbortSignal):Promise<T>{const body=await request('/graphql',{method:'POST',body:JSON.stringify({query,variables}),signal});if(body.errors?.length){const error=body.errors[0];const status=error.extensions?.http?.status||400;if(status===401)clearSession();throw new ApiError(error.message,status,body.extensions?.requestId);}return body.data;}
export const json=(value:unknown)=>JSON.stringify(value);
