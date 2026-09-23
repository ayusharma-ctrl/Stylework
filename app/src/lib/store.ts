import {create} from 'zustand';
import {createJSONStorage,persist} from 'zustand/middleware';
import type {Theme,Tokens} from './types';
export const useSession=create<{tokens:Tokens|null;setTokens:(tokens:Tokens|null)=>void}>()(persist((set)=>({tokens:null,setTokens:tokens=>set({tokens})}),{name:'stylework-session',storage:createJSONStorage(()=>sessionStorage),partialize:state=>({tokens:state.tokens})}));
interface Preferences {theme:Theme;users:Record<string,{compact:boolean}>;setTheme:(theme:Theme)=>void;setCompact:(id:string,compact:boolean)=>void;}
export const usePreferences=create(persist<Preferences>((set)=>({theme:'system',users:{},setTheme:theme=>set({theme}),setCompact:(id,compact)=>set(state=>({users:{...state.users,[id]:{compact}}}))}),{name:'stylework-preferences',version:1}));
