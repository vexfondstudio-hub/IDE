import React, { useState, useEffect } from "react";
import { getFirestore, collection, getDocs, limit, query } from "firebase/firestore";
import { Database, Table, RefreshCcw as RefreshCw, Search } from "lucide-react";

export const DatabaseView = () => {
  const [collections, setCollections] = useState<string[]>(["arena_scripts", "users", "settings"]); // Mock or common ones
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const db = getFirestore();

  const fetchCollectionData = async (collName: string) => {
    setLoading(true);
    setSelectedCollection(collName);
    try {
      const q = query(collection(db, collName), limit(50));
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setData(docs);
    } catch (err: any) {
      console.error("Error fetching Firestore data:", err);
      setData([{ error: "Failed to fetch data or Permission Denied." }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // In a real app we might try to list collections, but Firestore Web SDK doesn't support listCollections()
    // So we use common ones or allow user to type
  }, []);

  const filteredData = data.filter(item => 
    JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full h-full flex flex-col bg-[#0F111A] text-slate-300">
      <div className="h-10 border-b border-white/5 flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-purple-400" />
          <h2 className="text-sm font-medium text-slate-400">Database Viewer (Firestore)</h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => selectedCollection && fetchCollectionData(selectedCollection)}
            className="p-1.5 hover:bg-white/5 rounded-md transition-colors text-slate-500 hover:text-white"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Collections Sidebar */}
        <div className="w-48 border-r border-white/5 flex flex-col shrink-0">
          <div className="p-2">
             <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 mb-2">Collections</div>
             <div className="flex flex-col gap-0.5">
               {collections.map(coll => (
                 <button 
                   key={coll}
                   onClick={() => fetchCollectionData(coll)}
                   className={`text-left px-2 py-1.5 rounded text-xs transition-all ${selectedCollection === coll ? 'bg-blue-600/20 text-blue-400 font-medium' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                 >
                   <Table size={14} className="inline mr-2" />
                   {coll}
                 </button>
               ))}
               <button 
                 onClick={() => {
                   const name = prompt("Enter collection name:");
                   if (name) {
                     setCollections(prev => Array.from(new Set([...prev, name])));
                     fetchCollectionData(name);
                   }
                 }}
                 className="text-left px-2 py-1.5 rounded text-xs text-slate-600 hover:text-slate-400 hover:bg-white/5 italic"
               >
                 + Add custom...
               </button>
             </div>
          </div>
        </div>

        {/* Data View */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-2 border-b border-white/5 bg-black/20">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search in records..."
                className="w-full bg-[#1e1e1e] border border-white/5 rounded-md pl-9 pr-4 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500/50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-auto p-2">
            {selectedCollection ? (
              <div className="flex flex-col gap-2">
                {filteredData.length > 0 ? (
                  filteredData.map((item, idx) => (
                    <div key={item.id || idx} className="bg-[#1e1e2e] border border-white/5 rounded-lg p-3 font-mono text-[11px] hover:border-blue-500/30 transition-all">
                      <div className="text-blue-400 mb-1 font-bold">ID: {item.id}</div>
                      <pre className="text-slate-400 whitespace-pre-wrap">{JSON.stringify(item, null, 2)}</pre>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-slate-500 text-xs italic">
                    {loading ? "Loading data..." : "No records found in this collection."}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-600">
                <Database size={48} className="mb-4 opacity-10" />
                <p className="text-xs">Select a collection to view its data</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
