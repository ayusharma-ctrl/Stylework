import {infiniteQueryOptions,queryOptions} from '@tanstack/react-query';
import {api,graphql} from './api';
import type {Activity,Connection,Lead,Profile} from './types';
export const meOptions=queryOptions({queryKey:['me'],queryFn:({signal})=>api<Profile>('/me',{signal})});
export const leadFields='id fullName email phone company campaign version createdAt status { id name color archivedAt }';
const pageFields='pageInfo { startCursor endCursor hasNextPage hasPreviousPage }';
type Cursor={after?:string;before?:string};
export function leadsOptions(filters:Record<string,unknown>={}){return infiniteQueryOptions({queryKey:['leads',filters],initialPageParam:{} as Cursor,maxPages:20,staleTime:Infinity,
 queryFn:async({pageParam,signal})=>(await graphql<{leads:Connection<Lead>}>(`query Leads($input:LeadQueryInput){leads(input:$input){nodes{${leadFields}} ${pageFields}}}`,{input:{...filters,...pageParam,...(pageParam.before?{last:50}:{first:50})}},signal)).leads,
 getNextPageParam:(last):Cursor|undefined=>last.pageInfo.hasNextPage?{after:last.pageInfo.endCursor!}:undefined,
 getPreviousPageParam:(first):Cursor|undefined=>first.pageInfo.hasPreviousPage?{before:first.pageInfo.startCursor!}:undefined,
 });}
export const leadOptions=(id:string)=>queryOptions({queryKey:['lead',id],queryFn:async({signal})=>(await graphql<{lead:Lead}>(`query Lead($id:ID!){lead(id:$id){${leadFields} updatedAt source externalId sourceVersion metadata}}`,{id},signal)).lead});
export function activitiesOptions(filters:Record<string,unknown>={}){return infiniteQueryOptions({queryKey:['activities',filters],initialPageParam:{} as Cursor,maxPages:20,staleTime:Infinity,
 queryFn:async({pageParam,signal})=>(await graphql<{activities:Connection<Activity>}>(`query Activities($input:ActivityQueryInput){activities(input:$input){nodes{id leadId type summary actor before after requestId createdAt} ${pageFields}}}`,{input:{...filters,...pageParam,...(pageParam.before?{last:25}:{first:25})}},signal)).activities,
 getNextPageParam:(last):Cursor|undefined=>last.pageInfo.hasNextPage?{after:last.pageInfo.endCursor!}:undefined,
 getPreviousPageParam:(first):Cursor|undefined=>first.pageInfo.hasPreviousPage?{before:first.pageInfo.startCursor!}:undefined,
 });}
