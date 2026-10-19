import {useEffect,useState} from 'react';

export default function usePublicNotices() {
  const [notices,setNotices]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError(false);
    fetch('/api/notices/public',{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{if(!controller.signal.aborted)setNotices(data);}).catch(e=>{if(e.name!=='AbortError')setError(true);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[attempt]);
  return {notices,loading,error,retry:()=>setAttempt(n=>n+1)};
}
