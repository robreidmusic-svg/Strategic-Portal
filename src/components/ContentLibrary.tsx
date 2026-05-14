import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  FolderPlus, 
  Plus, 
  ChevronRight, 
  Library, 
  Search, 
  MoreVertical, 
  ChevronLeft,
  FileText,
  Youtube,
  Archive,
  ArrowRight,
  Link as LinkIcon,
  ExternalLink,
  Trash2,
  AlertCircle,
  ShieldAlert
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  onSnapshot, 
  orderBy,
  Timestamp,
  serverTimestamp,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface LibraryItem {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: any;
  createdBy: string;
  type: 'folder' | 'industry' | 'training' | 'youtube' | 'random' | 'link' | 'file';
  url?: string;
  description?: string;
}

export function ContentLibrary() {
  const { adminMode, portalUser, setAdminMode } = useApp();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [currentPath, setCurrentPath] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showNewAssetModal, setShowNewAssetModal] = useState(false);
  
  // Form States
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newType, setNewType] = useState<'folder' | 'link'>('folder');

  const currentFolderId = currentPath.length > 0 ? currentPath[currentPath.length - 1].id : null;

  useEffect(() => {
    const q = query(
      collection(db, 'content_library'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LibraryItem[];
      
      setItems(itemList);
      
      // Auto-initialize base folders if empty
      if (snapshot.empty && adminMode) {
        initializeBaseFolders();
      }
      
      setLoading(false);
    }, (error) => {
      console.error('Firestore subscription error:', error);
      toast.error('Failed to load library items. Check permissions.');
    });

    return () => unsubscribe();
  }, [adminMode]);

  const initializeBaseFolders = async () => {
    const baseFolders = [
      { name: 'Industry Reports', type: 'industry' },
      { name: 'Training Materials', type: 'training' },
      { name: 'YouTube Links', type: 'youtube' },
      { name: 'Random', type: 'random' }
    ];

    try {
      for (const folder of baseFolders) {
        await addDoc(collection(db, 'content_library'), {
          ...folder,
          parentId: null,
          createdAt: serverTimestamp(),
          createdBy: portalUser?.uid || 'system'
        });
      }
      toast.success('Library initialized with standard sectors.');
    } catch (error) {
      console.error('Initialization error:', error);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const payload: any = {
        name: newName.trim(),
        parentId: currentFolderId,
        type: newType,
        createdAt: serverTimestamp(),
        createdBy: portalUser?.uid || 'unknown'
      };

      if (newType === 'link' && newUrl) {
        payload.url = newUrl.startsWith('http') ? newUrl : `https://${newUrl}`;
        // Auto-detect YouTube
        if (payload.url.includes('youtube.com') || payload.url.includes('youtu.be')) {
          payload.type = 'youtube';
        }
      }

      await addDoc(collection(db, 'content_library'), payload);
      
      setNewName('');
      setNewUrl('');
      setShowNewFolderModal(false);
      setShowNewAssetModal(false);
      toast.success(`${newType === 'folder' ? 'Folder' : 'Asset'} created successfully.`);
    } catch (error) {
      toast.error('Failed to create item.');
    }
  };

  const handleDeleteItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to remove this item?')) return;
    
    try {
      await deleteDoc(doc(db, 'content_library', id));
      toast.success('Item removed.');
    } catch (error) {
      toast.error('Failed to remove item.');
    }
  };

  const navigateTo = (item: LibraryItem) => {
    if (item.type === 'link' || item.type === 'youtube') {
      if (item.url) window.open(item.url, '_blank');
      return;
    }
    setCurrentPath(prev => [...prev, item]);
  };

  const navigateBack = (index: number) => {
    if (index === -1) {
      setCurrentPath([]);
    } else {
      setCurrentPath(prev => prev.slice(0, index + 1));
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'industry': return <FileText className="text-archival-terracotta" size={18} />;
      case 'training': return <Library className="text-archival-sage" size={18} />;
      case 'youtube': return <Youtube className="text-red-500" size={18} />;
      case 'random': return <Archive className="text-archival-oxide" size={18} />;
      case 'link': return <LinkIcon className="text-blue-500" size={18} />;
      default: return <Folder className="text-archival-terracotta/60" size={18} />;
    }
  };

  const currentLevelItems = items.filter(f => f.parentId === currentFolderId);
  const filteredItems = currentLevelItems.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-archival-terracotta/10 rounded-xl flex items-center justify-center border border-archival-terracotta/20">
              <Library className="text-archival-terracotta" size={20} />
            </div>
            <h2 className="text-2xl font-friendly font-black tracking-tight text-archival-ink uppercase">Strategic Library</h2>
          </div>
          <p className="text-xs text-archival-oxide tracking-widest uppercase font-black font-mono">
            Archival Repository for Intelligence & Materials
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-archival-oxide group-hover:text-archival-terracotta transition-colors" size={14} />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-6 py-3 bg-archival-parchment/50 border border-archival-parchment rounded-full text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-archival-terracotta/20 focus:border-archival-terracotta/40 min-w-[240px] transition-all"
            />
          </div>
          
          {adminMode ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setNewType('folder');
                  setShowNewFolderModal(true);
                }}
                className="flex items-center gap-2 px-6 py-3 bg-white border border-archival-parchment text-archival-ink rounded-full text-[10px] font-black uppercase tracking-widest hover:border-archival-terracotta transition-all shadow-sm"
              >
                <FolderPlus size={14} />
                New Folder
              </button>
              <button
                onClick={() => {
                  setNewType('link');
                  setShowNewAssetModal(true);
                }}
                className="flex items-center gap-2 px-6 py-3 bg-archival-terracotta text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-archival-terracotta/90 transition-all shadow-lg shadow-archival-terracotta/20"
              >
                <Plus size={14} />
                Add Asset
              </button>
            </div>
          ) : (
             <div className="flex items-center gap-2 px-4 py-2 bg-archival-parchment/30 rounded-full border border-archival-parchment text-[8px] font-black uppercase tracking-widest text-archival-oxide">
               <ShieldAlert size={12} className="mr-1" />
               Admin Privileges Required to Modify Library
             </div>
          )}
        </div>
      </div>

      {/* Admin Mode Nudge */}
      {!adminMode && portalUser?.role === 'admin' && (
        <div className="p-4 bg-archival-terracotta/5 border border-archival-terracotta/20 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle size={16} className="text-archival-terracotta" />
            <p className="text-[10px] font-black uppercase tracking-widest text-archival-terracotta/80">
              Switch to **Archival Admin** mode in the sidebar to create folders or add files.
            </p>
          </div>
          <button 
            onClick={() => setAdminMode(true)}
            className="text-[10px] font-black uppercase tracking-widest text-archival-terracotta hover:underline"
          >
            Enable Now
          </button>
        </div>
      )}

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase font-mono text-archival-oxide/60 bg-archival-parchment/30 p-4 rounded-xl border border-archival-parchment/50">
        <button 
          onClick={() => navigateBack(-1)}
          className={cn(
            "hover:text-archival-terracotta transition-colors",
            currentPath.length === 0 && "text-archival-terracotta"
          )}
        >
          ROOT
        </button>
        {currentPath.map((item, i) => (
          <React.Fragment key={item.id}>
            <ChevronRight size={12} className="opacity-40" />
            <button 
              onClick={() => navigateBack(i)}
              className={cn(
                "hover:text-archival-terracotta transition-colors",
                i === currentPath.length - 1 && "text-archival-terracotta"
              )}
            >
              {item.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-archival-parchment/20 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigateTo(item)}
              className="group relative flex flex-col items-start p-6 bg-white border border-archival-parchment rounded-[24px] hover:border-archival-terracotta/40 hover:shadow-xl transition-all duration-500 text-left overflow-hidden"
            >
              <div className="absolute inset-0 paper-texture opacity-[0.03] pointer-events-none" />
              
              <div className="flex items-center justify-between w-full mb-6">
                <div className="w-12 h-12 rounded-2xl bg-archival-parchment flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  {getIcon(item.type)}
                </div>
                {adminMode && (
                  <button 
                    onClick={(e) => handleDeleteItem(e, item.id)}
                    className="p-2 opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity text-archival-oxide hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <h3 className="text-xs font-black font-friendly text-archival-ink uppercase tracking-wider mb-2 group-hover:text-archival-terracotta transition-colors line-clamp-2">
                {item.name}
              </h3>
              
              <div className="flex items-center gap-2 mt-auto">
                {item.type === 'link' || item.type === 'youtube' ? (
                  <div className="flex items-center gap-1.5">
                    <ExternalLink size={10} className="text-archival-terracotta" />
                    <span className="text-[8px] font-black font-mono text-archival-terracotta uppercase tracking-widest">Open External</span>
                  </div>
                ) : (
                  <>
                    <div className="h-1 w-8 bg-archival-parchment rounded-full overflow-hidden">
                      <div className="h-full bg-archival-terracotta/20 group-hover:bg-archival-terracotta transition-all duration-700 w-1/3" />
                    </div>
                    <span className="text-[8px] font-black font-mono text-archival-oxide/40 uppercase tracking-widest">
                      {item.type === 'folder' ? 'Sub-Archive' : 'Root Archive'}
                    </span>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-archival-parchment/20 rounded-[32px] border-2 border-dashed border-archival-parchment">
          <Folder className="text-archival-parchment mb-4" size={48} />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-archival-oxide/60">
            No assets found in this sector
          </p>
        </div>
      )}

      {/* New Folder/Asset Modal */}
      {(showNewFolderModal || showNewAssetModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-archival-ink/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-archival-canvas rounded-[32px] shadow-2xl border border-archival-parchment overflow-hidden">
            <div className="p-8 border-b border-archival-parchment flex items-center justify-between">
              <div className="flex items-center gap-3">
                {newType === 'folder' ? <FolderPlus className="text-archival-terracotta" size={20} /> : <LinkIcon className="text-archival-terracotta" size={20} />}
                <h3 className="text-xl font-friendly font-black uppercase tracking-tight">
                  {newType === 'folder' ? 'Establish Archive' : 'Integrate Asset'}
                </h3>
              </div>
              <button onClick={() => { setShowNewFolderModal(false); setShowNewAssetModal(false); }} className="text-archival-oxide hover:text-archival-ink">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateItem} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-archival-oxide">Display Name</label>
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={newType === 'folder' ? "e.g. Q4 Competitor Analysis" : "e.g. Strategic Onboarding Video"}
                  className="w-full px-6 py-4 bg-archival-parchment rounded-2xl border border-archival-parchment focus:border-archival-terracotta/40 focus:ring-4 focus:ring-archival-terracotta/5 outline-none transition-all font-friendly text-sm"
                />
              </div>

              {newType === 'link' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-archival-oxide">Resource URL</label>
                  <input
                    type="text"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://youtube.com/..."
                    className="w-full px-6 py-4 bg-archival-parchment rounded-2xl border border-archival-parchment focus:border-archival-terracotta/40 focus:ring-4 focus:ring-archival-terracotta/5 outline-none transition-all font-friendly text-sm"
                  />
                </div>
              )}
              
              <div className="flex items-center gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowNewFolderModal(false); setShowNewAssetModal(false); }}
                  className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-archival-oxide hover:bg-archival-parchment rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 bg-archival-ink text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-archival-terracotta transition-all shadow-xl shadow-black/20"
                >
                  Commit to Archive
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function X({ size }: { size: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
