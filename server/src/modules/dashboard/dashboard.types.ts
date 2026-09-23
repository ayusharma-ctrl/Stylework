export interface DashboardMetric {key:string;label:string;value:number|null;format:'number'|'percent';description:string;}
export interface DashboardSnapshot {
 generatedAt:string;timezone:string;catalogVersion:number;revision:string;
 metrics:DashboardMetric[];
 statuses:{id:string;label:string;color:string;value:number;archived:boolean;isDefault:boolean}[];
 trend:{date:string;label:string;value:number}[];
}
