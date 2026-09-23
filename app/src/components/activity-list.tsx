import {useMemo,useState} from 'react';
import {useInfiniteQuery} from '@tanstack/react-query';
import {Link,useSearchParams} from 'react-router-dom';
import {ArrowRight,GitBranch,Plus,RefreshCw} from 'lucide-react';
import {activitiesOptions} from '../lib/queries';
import {dateTime} from '../lib/utils';
import type {Activity} from '../lib/types';
import {dateFilters,FilterBar} from './filters';
import {VirtualList} from './virtual-list';
import {Empty,ErrorState,Loading} from './feedback';
import {Modal} from './ui/dialog';
import {Button} from './ui/button';
import {RefreshNotice} from './refresh-notice';
export function ActivityList({leadId}:{leadId?:string}){const [params]=useSearchParams(),[selected,setSelected]=useState<Activity|null>(null);const filters=useMemo(()=>({...dateFilters(params),search:params.get('q')||'',direction:params.get('sort')==='oldest'?'ASC':'DESC',...(params.get('type')?{types:[params.get('type')]}:{}),...(leadId?{leadId}:{})}),[params,leadId]);const query=useInfiniteQuery(activitiesOptions(filters));const rows=useMemo(()=>Array.from(new Map(query.data?.pages.flatMap(p=>p.nodes).map(row=>[row.id,row])).values()),[query.data]);
 return <><FilterBar activity/><RefreshNotice refresh={()=>query.refetch()}/>{query.isPending?<Loading/>:query.error?<ErrorState error={query.error} retry={()=>void query.refetch()}/>:!rows.length?<Empty title="No activity yet" description="Every lead and status change will leave a clear trail here."/>:<VirtualList key={JSON.stringify(filters)} rows={rows} rowHeight={96} label="Activity timeline" hasNext={query.hasNextPage} hasPrevious={query.hasPreviousPage} fetching={query.isFetching} next={()=>query.fetchNextPage()} previous={()=>query.fetchPreviousPage()} renderRow={activity=>{const Icon=activity.type==='LEAD_CREATED'?Plus:activity.type==='LEAD_UPDATED'?RefreshCw:GitBranch;return <button className="activity-row" onClick={()=>setSelected(activity)}><span className={'activity-icon '+(activity.type==='LEAD_CREATED'?'created':'')}><Icon size={17}/></span><span className="min-w-0 flex-1"><strong className="line-clamp-1">{activity.summary}</strong><span className="activity-meta">{activity.actor.label||'System'}<span>·</span>{dateTime(activity.createdAt)}</span></span><ArrowRight size={15}/></button>;}}/>}
 <Modal open={!!selected} onOpenChange={open=>{if(!open)setSelected(null);}} title="Activity details" description={selected?dateTime(selected.createdAt)+' · '+selected.actor.label:''}>{selected&&<><h3 className="mb-4 font-medium">{selected.summary}</h3><div className="space-y-4">{(['before','after'] as const).map(side=><div key={side}><h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{side}</h4><pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-xs">{selected[side]?JSON.stringify(selected[side],null,2):'No previous values'}</pre></div>)}<p className="break-all text-xs text-muted-foreground">Trace: {selected.requestId}</p>{selected.leadId&&!leadId&&<Button asChild variant="outline"><Link to={'/leads/'+selected.leadId}>View lead<ArrowRight size={14}/></Link></Button>}</div></>}</Modal></>;
}
