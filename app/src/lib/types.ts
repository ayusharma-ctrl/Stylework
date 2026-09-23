export interface Status {id:string;name:string;color:string;position:number;version:number;archivedAt:string|null;}
export interface Profile {user:{id:string;email:string;meta:{theme?:Theme}};statuses:Status[];workspace:{defaultStatusId:string;timezone:string;catalogVersion:number};}
export type Theme='light'|'dark'|'system';
export interface Tokens {accessToken:string;refreshToken:string;accessExpiresAt:string;refreshExpiresAt:string;}
export interface Lead {id:string;fullName:string;email:string|null;phone:string|null;company:string|null;campaign:string|null;status:Status;version:number;createdAt:string;updatedAt:string;source:string;externalId:string;sourceVersion:number;metadata:Record<string,unknown>;}
export interface Activity {id:string;leadId:string|null;type:string;summary:string;actor:{kind:string;label:string};before:Record<string,unknown>|null;after:Record<string,unknown>|null;createdAt:string;requestId:string;}
export interface Connection<T>{nodes:T[];pageInfo:{startCursor:string|null;endCursor:string|null;hasNextPage:boolean;hasPreviousPage:boolean};}
export interface Dashboard {revision:string;generatedAt:string;timezone:string;catalogVersion:number;metrics:{key:string;label:string;value:number|null;format:'number'|'percent';description:string}[];statuses:{id:string;label:string;color:string;value:number;archived:boolean;isDefault:boolean}[];trend:{date:string;label:string;value:number}[];}
