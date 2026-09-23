import {useEffect,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {useDashboard} from '../lib/dashboard';
import {Button} from './ui/button';
export function RefreshNotice({refresh}:{refresh:()=>Promise<unknown>}){const {data}=useDashboard(),[revision,setRevision]=useState(data?.revision),[busy,setBusy]=useState(false);useEffect(()=>{if(!revision&&data)setRevision(data.revision);},[data,revision]);if(!data||data.revision===revision)return null;return <div className="refresh-notice"><span>Your workspace has new activity.</span><Button size="sm" variant="ghost" disabled={busy} onClick={async()=>{setBusy(true);try{await refresh();setRevision(data.revision);}finally{setBusy(false);}}}><RefreshCw size={13}/>Refresh view</Button></div>;}
