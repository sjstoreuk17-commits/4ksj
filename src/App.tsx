/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal, 
  Search, 
  Download, 
  Film, 
  Tv, 
  Activity, 
  Home, 
  Cpu, 
  Monitor, 
  Skull, 
  Eye, 
  ChevronRight,
  Loader2,
  RefreshCcw,
  Zap,
  Filter,
  Lock,
  User,
  Globe,
  ArrowRight,
  BarChart3,
  Clock,
  Layers,
  Bell,
  Radio,
  Image as ImageIcon,
  ExternalLink,
  Shield,
  ShieldCheck,
  ShieldAlert,
  FileWarning,
  Database,
  X,
  Copy,
  QrCode,
  Key,
  Plus,
  FileText,
  ChevronLeft,
  Type
} from 'lucide-react';
import { XtreamService } from './lib/xtreamService';
import { XtreamAuth, XtreamCategory, XtreamStream, XtreamSeries, XtreamSeriesInfo, XtreamEpisode, M3UEntry, M3UPlaylist } from './types';
import { copyToClipboard, parseM3U } from './lib/m3uParser';
import { fetchApiData } from './services/proxyEngine';
import { MergerService, MergedSeriesItem } from './services/mergerService';
import { PosterGenerator } from './services/posterGenerator';
import { MasterSyncService, SyncReport } from './services/masterSyncService';
import { auth as fbAuth, db } from './lib/firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, addDoc, getDocs, query, where, deleteDoc, serverTimestamp } from 'firebase/firestore';

import { HackingLoader } from './components/HackingLoader';

type AuthMode = 'gateway' | 'xtream' | 'm3u' | 'admin' | 'master';

export default function App() {
  const [authMode, setAuthMode] = useState<AuthMode>('gateway');
  const [adminPass, setAdminPass] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [adminKeys, setAdminKeys] = useState<{id: string, key: string, createdAt: any}[]>([]);
  
  const [auth, setAuth] = useState<XtreamAuth>({ 
    url: '', 
    username: '', 
    password: '' 
  });

  const [exportAuth] = useState<XtreamAuth>({
    url: 'https://sjstorestar4k.store',
    username: 'mXoK4b6xEf',
    password: 'immaculate5visit'
  });

  const adminAuth: XtreamAuth = {
    url: 'https://sjstorestar4k.store',
    username: '928373838', 
    password: '827338833'
  };

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginProgress, setLoginProgress] = useState(0);
  const [loadingStep, setLoadingStep] = useState('');
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [customKeyName, setCustomKeyName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [vodCats, setVodCats] = useState<XtreamCategory[]>([]);
  const [seriesCats, setSeriesCats] = useState<XtreamCategory[]>([]);
  const [currentStreams, setCurrentStreams] = useState<XtreamStream[]>([]);
  const [currentSeries, setCurrentSeries] = useState<XtreamSeries[]>([]);
  
  const [currentView, setCurrentView] = useState<'home' | 'movies' | 'series' | 'admin_panel'>('home');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [logs, setLogs] = useState<string[]>(['[SYS] NEURAL INTERFACE ONLINE...']);
  const [renderLimit, setRenderLimit] = useState(100);
  const [showMobileCats, setShowMobileCats] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  const [selectedSeriesForDetail, setSelectedSeriesForDetail] = useState<XtreamSeries | null>(null);
  const [sortBy, setSortBy] = useState<'top_added' | 'old_added' | 'alphabetical'>('top_added');

  // M3U Data Mode State
  const [isM3UMode, setIsM3UMode] = useState(false);
  const [m3uPlaylist, setM3uPlaylist] = useState<M3UPlaylist | null>(null);

  // Multi-Series Merger State
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<Map<number, XtreamSeries>>(new Map());
  const [episodeRegistry, setEpisodeRegistry] = useState<Map<number, number>>(new Map());
  const [iconRegistry, setIconRegistry] = useState<Map<number, string>>(new Map());
  const [showMergerModal, setShowMergerModal] = useState(false);

  // Global Sync Results
  const [activeSyncReport, setActiveSyncReport] = useState<{ report: SyncReport, name: string } | null>(null);
  const [syncProgress, setSyncProgress] = useState<{ active: boolean; step: string; details: string; name: string }>({ active: false, step: '', details: '', name: '' });

  const simulateProgress = async (steps: { msg: string, delay: number, weight: number }[]) => {
    let current = loginProgress;
    for (const step of steps) {
      setLoadingStep(step.msg);
      const iterations = Math.max(1, step.delay / 20);
      const inc = step.weight / iterations;

      for (let i = 0; i < iterations; i++) {
        current += inc;
        setLoginProgress(Math.min(Math.round(current), 95));
        await new Promise(r => setTimeout(r, 20));
      }
    }
  };

  const finalizeLoading = async () => {
    setLoadingStep('SYSTEM_READY_INITIALIZING');
    setLoginProgress(100);
    await new Promise(r => setTimeout(r, 1200)); 
    setLoading(false);
  };

  const xtream = useMemo(() => {
    if (!isLoggedIn || isM3UMode) return null;
    // Only use exportAuth override if we are in gateway mode (Admin Root Access)
    const m3uAuthOverride = authMode === 'gateway' ? exportAuth : undefined;
    return new XtreamService(auth, m3uAuthOverride);
  }, [isLoggedIn, auth, exportAuth, isM3UMode, authMode]);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 30));
  }, []);

  const checkAccessKey = async () => {
    if (!accessKey) {
      setError('ACCESS_DENIED: TERMINAL_KEY_REQUIRED');
      addLog('SECURITY_ALERT: ACCESS_KEY_MISSING');
      return false;
    }
    
    try {
      const q = query(collection(db, 'license_keys'), where('key', '==', accessKey));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError('ACCESS_DENIED: INVALID_TERMINAL_KEY');
        addLog('SECURITY_ALERT: FRAUDULENT_KEY_DETECTED');
        return false;
      }
      addLog('TERMINAL_KEY_VALIDATED. SECURITY_SHIELD_READY.');
      return true;
    } catch (e: any) {
      setError('ACCESS_DENIED: SECURITY_SERVICE_OFFLINE');
      return false;
    }
  };

  const handleM3ULogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!m3uUrl) return;

    setLoading(true);
    setLoginProgress(0);
    setError(null);
    addLog('INITIATING M3U DATA PIPELINE...');

    try {
      setLoadingStep('INITIATING_GATEWAY_HANDSHAKE');
      await simulateProgress([
        { msg: 'REMOTE_SOURCE_CONNECT', delay: 1000, weight: 15 },
        { msg: 'PARSING_DATA_DIRECTIVES', delay: 1200, weight: 25 },
        { msg: 'MAP_RECONSTRUCTION', delay: 800, weight: 20 },
      ]);

      // 1. Try Xtream Tunneling first (standard Xtream M3U links have creds in params)
      try {
        const urlObj = new URL(m3uUrl);
        const username = urlObj.searchParams.get('username');
        const password = urlObj.searchParams.get('password');
        const serverUrl = `${urlObj.protocol}//${urlObj.host}`;

        if (username && password) {
          addLog('XTREAM_CREDENTIALS DETECTED. UPGRADING SESSION...');
          const newAuth = { url: serverUrl, username, password };
          setAuth(newAuth);
          await handleLogin(newAuth);
          return;
        }
      } catch (urlErr) {
        // Not a standard URL or parsing failed, fallback to raw fetch
      }

      // 2. Raw M3U Fallback (Standard M3U files)
      addLog('RAW_M3U DETECTED. ANALYZING DATA STRUCTURE...');
      // Using fetchApiData instead of direct fetch to /api/proxy
      const content = await fetchApiData(m3uUrl, false);
      
      const playlist = parseM3U(typeof content === 'string' ? content : JSON.stringify(content));
      
      setM3uPlaylist(playlist);
      setIsM3UMode(true);
      setCurrentView('home');
      setIsLoggedIn(true);
      
      const movieCats: XtreamCategory[] = playlist.categories
        .filter(c => playlist.entries.some(e => e.group === c && (e.type === 'movie' || (playlist.entries.filter(x => x.type !== 'unknown').length === 0 && e.type === 'unknown'))))
        .map(c => ({ category_id: c, category_name: c, parent_id: 0 }));
      setVodCats(movieCats);

      const seriesCats: XtreamCategory[] = playlist.categories
        .filter(c => playlist.entries.some(e => e.group === c && e.type === 'series'))
        .map(c => ({ category_id: c, category_name: c, parent_id: 0 }));
      setSeriesCats(seriesCats);

      const movies: XtreamStream[] = playlist.entries
        .filter(e => e.type === 'movie' || (playlist.entries.filter(x => x.type !== 'unknown').length === 0 && e.type === 'unknown'))
        .map((e, i) => ({
          num: i + 1,
          name: e.name,
          stream_type: 'movie',
          stream_id: e.id,
          stream_icon: e.logo || '',
          category_id: e.group,
          container_extension: 'ts',
          direct_source: e.url,
          rating: '', rating_5_0: 0, added: '',
          custom_sid: ''
        }));
      setCurrentStreams(movies);

      // Map & GROUP Series for M3U to enable EXTRACT_EPISODES for raw playlists
      const seriesEntries = playlist.entries.filter(e => e.type === 'series');
      const seriesMap = new Map<string, XtreamSeries & { localEpisodes?: XtreamEpisode[] }>();

      seriesEntries.forEach(e => {
        // Group by base name to treat individual M3U lines as one series
        // Remove Season/Episode tags but keep language info in brackets
        const baseName = e.name.replace(/\s*[sS]\d+\s*[eE]\d+|\s*[sS]eason\s*\d+\s*[eE]pisode\s*\d+/i, '').trim() || e.name;
        
        if (!seriesMap.has(baseName)) {
          seriesMap.set(baseName, {
            num: 0,
            name: baseName,
            series_id: Math.floor(Math.random() * 1000000),
            cover: e.logo || '',
            plot: 'M3U_SYNTHETIC_GROUP',
            cast: '', director: '', genre: e.group, releaseDate: '', last_modified: '', rating: '', rating_5_0: 0,
            backdrop_path: [], youtube_trailer: '', episode_run_time: '',
            category_id: e.group,
            localEpisodes: []
          });
        }
        
        const series = seriesMap.get(baseName)!;
        const epMatch = e.name.match(/[eE](\d+)/);
        const epNum = epMatch ? parseInt(epMatch[1]) : series.localEpisodes!.length + 1;
        
        series.localEpisodes!.push({
          id: e.id,
          episode_num: epNum,
          season: 1,
          title: e.name,
          container_extension: 'ts',
          info: { duration: '', movie_image: e.logo || '', plot: '', rating: '', release_date: '' },
          raw_url: e.url // Custom field for M3U direct playback
        } as any);
      });

      setCurrentSeries(Array.from(seriesMap.values()));
      addLog(`M3U_PIPELINE_COMPLETE: ${playlist.entries.length} ITEMS EXTRACTED.`);
      
      await finalizeLoading();
    } catch (err: any) {
      setError(`Login failed: ${err.message}`);
      addLog(`ERR: M3U_TUNNEL_FAILURE - ${err.message}`);
      setLoading(false);
    }
  };

  const handleMasterAccess = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!accessKey) return;

    setLoading(true);
    setLoginProgress(0);
    setError(null);
    
    try {
      setLoadingStep('VALIDATING_MASTER_KEY');
      const isValid = await checkAccessKey();
      if (!isValid) {
        setLoading(false);
        return;
      }

      await simulateProgress([
        { msg: 'CONNECTING_TO_ROOT_NODE', delay: 1200, weight: 15 },
        { msg: 'OVERRIDING_SECURITY_PROTOCOLS', delay: 1500, weight: 25 },
        { msg: 'DECRYPTING_CLOUD_REPOSITORIES', delay: 1200, weight: 25 },
        { msg: 'MOUNTING_MASTER_FILESYSTEM', delay: 1000, weight: 15 },
      ]);

      const masterAuth = { url: "https://4ksj.store", username: "webplayer44", password: "62246624" };
      setAuth(masterAuth);
      await handleLogin(masterAuth);
    } catch (err: any) {
      setError(`MASTER_ACCESS_FAILED: ${err.message}`);
      addLog(`ERR: MASTER_AUTH_LINK_FAILURE`);
      setLoading(false);
    }
  };

  const fetchAdminKeys = async () => {
    try {
      addLog("FETCHING_KEYS...");
      const q = query(collection(db, 'license_keys'));
      const snapshot = await getDocs(q);
      const keys = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setAdminKeys(keys);
      addLog(`FETCH_COMPLETE: ${keys.length} KEYS_FOUND`);
    } catch (e: any) {
      console.error("Failed to fetch keys", e);
      addLog(`ERR: FETCH_KEYS_FAILED [${e.message.substring(0, 30)}]`);
    }
  };

  const generateNewKey = async () => {
    if (isGeneratingKey) return;
    
    const keyName = customKeyName.trim();
    if (keyName && keyName.length < 5) {
      addLog('ERR: NAME_TOO_SHORT (MIN 5 CHARS)');
      return;
    }

    setIsGeneratingKey(true);
    addLog("INIT_SECURE_GENERATION...");
    
    // Use custom name if provided, else generate random
    const newKey = keyName 
      ? keyName.toUpperCase()
      : Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Math.random().toString(36).substring(2, 10).toUpperCase();

    try {
      const colRef = collection(db, 'license_keys');
      
      addLog("CONNECTING_TO_DATABASE...");
      
      // Add a timeout to the firestore operation
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("FIREBASE_TIMEOUT: NO_RESPONSE_FROM_SERVER")), 10000)
      );

      await Promise.race([
        addDoc(colRef, {
          key: newKey,
          createdAt: new Date().toISOString() // Use ISO string as fallback if serverTimestamp hangs
        }),
        timeoutPromise
      ]);

      await fetchAdminKeys();
      setCustomKeyName('');
      addLog(`SUCCESS: KEY_REGISTERED [${newKey}]`);
    } catch (e: any) {
      console.error(e);
      addLog(`ERR: ${e.message.includes('permission') ? 'PERM_DENIED: ENABLE ANALYTICS/AUTH' : 'GENERATION_FAILED'}`);
      if (e.message.includes('TIMEOUT')) {
        addLog('HINT: REFRESH_PAGE OR ENABLE_ANONYMOUS_AUTH');
      }
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const deleteKey = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'license_keys', id));
      fetchAdminKeys();
      addLog('KEY_TERMINATED_SUCCESSFULLY');
    } catch (e) {
      addLog('ERR: KEY_REMOVAL_FAILED');
    }
  };

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginProgress(0);
    try {
      await simulateProgress([
        { msg: 'ADMIN_CHALLENGE_INVOKED', delay: 800, weight: 20 },
        { msg: 'KEY_INTERSECT_ANALYSIS', delay: 1000, weight: 30 },
        { msg: 'ELEVATING_PRIVILEGES', delay: 800, weight: 20 },
      ]);
      
      if (adminPass === 'sajid122') {
        setAuth(adminAuth);
        await fetchAdminKeys();
        handleLogin(adminAuth);
      } else {
        setError('ACCESS_DENIED: INVALID_MAINFRAME_KEY');
        addLog('AUTH_FAILURE: UNAUTHORIZED_ADMIN_ATTEMPT_DETECTED');
        setLoading(false);
      }
    } catch (err: any) {
      setError('ADMIN_LINK_ERR: ' + err.message);
      setLoading(false);
    }
  };

  const handleLogin = useCallback(async (providedAuth?: XtreamAuth) => {
    const targetAuth = providedAuth || auth;
    if (!targetAuth.url || !targetAuth.username || !targetAuth.password) {
      return;
    }
    
    setLoading(true);
    setLoginProgress(0);
    setError(null);
    addLog('HANDSHAKE INITIATED With REMOTE SERVER...');

    try {
      await simulateProgress([
        { msg: 'ESTABLISHING_TLS_HANDSHAKE', delay: 1000, weight: 15 },
        { msg: 'RECOGNIZING_API_PATTERN', delay: 1200, weight: 15 },
        { msg: 'SYNCING_USER_PROFILE', delay: 800, weight: 10 },
      ]);
      
      const service = new XtreamService(targetAuth, exportAuth);
      setLoadingStep('BYPASSING_SECURITY_FIREWALL');
      await service.testConnection();
      
      addLog('ACCESS GRANTED. FETCHING SCHEMAS...');
      setLoadingStep('EXTRACTING_CATEGORY_DATA');
      const [vCats, sCats] = await Promise.all([
        service.getVodCategories(),
        service.getSeriesCategories()
      ]);

      setVodCats(vCats);
      setSeriesCats(sCats);
      setLoginProgress(75);
      
      addLog('FETCHING ENTIRE CONTENT DATABASE...');
      setLoadingStep('SYNCHRONIZING_DATABASE_CHUNKS');
      const [streams, series] = await Promise.all([
        service.getVodStreams(),
        service.getSeries()
      ]);
      
      setCurrentStreams(streams);
      setCurrentSeries(series);
      setIsDataLoaded(true);
      setIsLoggedIn(true);
      setIsM3UMode(false);
      
      addLog('CONNECTION SECURE. CORE DATA SYNCED.');
      await finalizeLoading();
    } catch (err: any) {
      addLog(`ERR: CONNECTION_REJECTED - ${err.message}`);
      setError('Invalid credentials or Server Unreachable');
      setLoading(false);
    }
  }, [auth, exportAuth, addLog]);

  const toggleSelection = (s: any) => {
    const id = s.series_id || s.stream_id;
    setSelectedSeries(prev => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.set(id, s);
      }
      return next;
    });
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setAuthMode('gateway');
    setIsM3UMode(false);
    setM3uPlaylist(null);
    setVodCats([]);
    setSeriesCats([]);
    setCurrentStreams([]);
    setCurrentSeries([]);
    setAuth({ url: '', username: '', password: '' });
    localStorage.removeItem('xtream_auth_active');
    addLog('SESSION TERMINATED.');
  };

  // Derived dashboard data
  const recentlyAddedMovies = useMemo(() => {
    return [...currentStreams].sort((a, b) => {
      const timeA = !isNaN(Number(a.added)) ? Number(a.added) : new Date(a.added).getTime() / 1000;
      const timeB = !isNaN(Number(b.added)) ? Number(b.added) : new Date(b.added).getTime() / 1000;
      return (timeB || 0) - (timeA || 0);
    });
  }, [currentStreams]);

  const recentlyAddedSeries = useMemo(() => {
    return [...currentSeries].sort((a, b) => {
      const timeA = !isNaN(Number(a.last_modified)) ? Number(a.last_modified) : new Date(a.last_modified).getTime() / 1000;
      const timeB = !isNaN(Number(b.last_modified)) ? Number(b.last_modified) : new Date(b.last_modified).getTime() / 1000;
      return (timeB || 0) - (timeA || 0);
    });
  }, [currentSeries]);

  const onCheckOnMaster = async (series: XtreamSeries) => {
    setSyncProgress({ active: true, step: 'INITIALIZING', details: 'Establishing secure link to Master Cloud...', name: series.name });
    addLog(`MASTER_SYNC_INITIATED: SCANNING [${series.name}]...`);
    
    try {
      const xtreamSvc = new XtreamService(auth); 
      
      setSyncProgress(p => ({ ...p, step: 'METADATA_FETCH', details: `Fetching local episode map for ${series.name}...` }));
      const info = await xtreamSvc.getSeriesInfo(series.series_id);
      const allEpisodes = Object.values(info.episodes).flat() as XtreamEpisode[];
      
      setSyncProgress(p => ({ ...p, step: 'MASTER_HANDSHAKE', details: 'Connecting to Master server [4ksj.store]...' }));
      const syncService = new MasterSyncService();
      
      setSyncProgress(p => ({ ...p, step: 'CROSS_COMPARISON', details: `Analyzing ${allEpisodes.length} packets against master library...` }));
      const report = await syncService.checkSeriesSync(series.name, allEpisodes, xtreamSvc);
      
      setSyncProgress(p => ({ ...p, active: false }));
      setActiveSyncReport({ report, name: series.name });
      
      if (report.found) {
        if (report.missingEpisodes.length > 0) {
          addLog(`SYNC_SCAN_COMPLETE: [${series.name}] FOUND. ${report.missingEpisodes.length} PACKETS MISSED.`);
        } else {
          addLog(`SYNC_SCAN_COMPLETE: [${series.name}] SYNCHRONIZED.`);
        }
      } else {
        addLog(`SYNC_SCAN_COMPLETE: [${series.name}] NOT ON MASTER.`);
      }
    } catch (e) {
      setSyncProgress(p => ({ ...p, active: false }));
      addLog('ERR: MASTER_SYNC_UNAVAILABLE');
    }
  };

  const displayList = useMemo(() => {
    const list = currentView === 'movies' ? currentStreams : currentSeries;
    let items = [...list];
    
    if (selectedCategory === 'recently_added') {
      if (currentView === 'movies') {
        items = recentlyAddedMovies;
      } else {
        items = recentlyAddedSeries;
      }
    } else if (selectedCategory === 'all') {
      // Identity mapping for 'all' category
      items = [...list];
    } else if (selectedCategory) {
      items = list.filter(i => i.category_id === selectedCategory);
      
      // Apply Sorting for other categories
      items.sort((a, b) => {
        if (sortBy === 'top_added' || sortBy === 'old_added') {
          // Determine time based on item type
          const getTime = (item: any) => {
            const val = item.added || item.last_modified;
            if (!val) return 0;
            return !isNaN(Number(val)) ? Number(val) : new Date(val).getTime() / 1000;
          };
          
          const timeA = getTime(a);
          const timeB = getTime(b);
          
          return sortBy === 'top_added' ? (timeB || 0) - (timeA || 0) : (timeA || 0) - (timeB || 0);
        } else if (sortBy === 'alphabetical') {
          return a.name.localeCompare(b.name);
        }
        return 0;
      });
    }

    const filtered = items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return filtered.slice(0, renderLimit);
  }, [currentStreams, currentSeries, currentView, searchQuery, renderLimit, selectedCategory, recentlyAddedMovies, recentlyAddedSeries, sortBy]);

  const [categorySelection, setCategorySelection] = useState<{ id: string, name: string } | null>(null);

  const downloadFullCategory = async (catId: string, catName: string) => {
    if (!xtream && !isM3UMode) return;
    addLog(`DUMP_INITIATED: CATEGORY [${catName}]...`);
    setLoading(true);
    
    try {
      const items = selectedCategory === 'recently_added' 
        ? (currentView === 'movies' ? recentlyAddedMovies : recentlyAddedSeries) 
        : (selectedCategory === 'all' 
          ? (currentView === 'movies' ? currentStreams : currentSeries)
          : (currentView === 'movies' ? currentStreams.filter(s => s.category_id === catId) : currentSeries.filter(s => s.category_id === catId))
        );
      
      let m3u = "";
      if (isM3UMode) {
        m3u = "#EXTM3U\r\n";
        items.forEach(item => {
          const icon = 'stream_icon' in item ? item.stream_icon : item.cover;
          const url = (item as any).direct_source || '';
          // Force http for extraction compatibility as requested by user
          const forcedUrl = url.replace(/https:\/\//g, 'http://');
          m3u += `#EXTINF:-1 tvg-id="" tvg-name="${item.name}" tvg-logo="${icon}" group-title="${catName}",${item.name}\r\n${forcedUrl}\r\n`;
        });
      } else if (xtream) {
        if (currentView === 'series' && items.length > 0) {
          addLog(`PREPARING_SERIES_METADATA [${items.length} SHOWS]...`);
          m3u = await xtream.getBatchSeriesEpisodes(items as XtreamSeries[]);
        } else {
          m3u = xtream.generateCategoryM3U(items, 'movie');
        }
      }
      
      if (!m3u) throw new Error("Empty Payload");

      // Final safety check to ensure all links in M3U are http
      const finalM3u = m3u.replace(/https:\/\//g, 'http://');

      const blob = new Blob([finalM3u], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Use standard category name for filename
      const cleanName = catName.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
      a.download = `${cleanName}.m3u`;
      a.click();
      URL.revokeObjectURL(url);
      addLog(`DUMP_COMPLETE: ${catName} EXPORTED SUCCESSFULLY.`);
    } catch (e) {
      addLog(`ERR: EXPORT_FAILED [${catName}]`);
    } finally {
      setLoading(false);
    }
  };

  const augmentedVodCats = useMemo(() => [
    { category_id: 'all', category_name: '★ ALL MOVIES' },
    { category_id: 'recently_added', category_name: '★ RECENTLY ADDED 100' },
    ...vodCats
  ], [vodCats]);

  const augmentedSeriesCats = useMemo(() => [
    { category_id: 'all', category_name: '★ ALL WEB SERIES' },
    { category_id: 'recently_added', category_name: '★ RECENTLY ADDED 50' },
    ...seriesCats
  ], [seriesCats]);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#00FF00] font-mono flex items-center justify-center p-4 relative overflow-hidden">
        {/* Hacker Aesthetic Background Layers */}
        <MatrixRain />
        <TerminalBootLog />
        
        {/* Scanning Line Effect */}
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
          <div className="w-full h-[100px] bg-gradient-to-b from-transparent via-[#00FF00]/10 to-transparent absolute animate-[scan_6s_linear_infinite]" />
        </div>
        
        {/* CRT Flicker Overlay */}
        <div className="absolute inset-0 pointer-events-none z-20 opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />

        <div className="max-w-md w-full space-y-12 relative z-30">
          <div className="text-center space-y-4">
            <motion.div
              initial={{ scale: 0.5, opacity: 0, filter: 'blur(10px)' }}
              animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
              transition={{ type: "spring", stiffness: 100, bounce: 0.5 }}
              className="relative inline-block"
            >
              <Skull className="w-24 h-24 mx-auto mb-2 text-[#00FF00] drop-shadow-[0_0_20px_rgba(0,255,0,0.6)] animate-pulse" />
              <div className="absolute -inset-4 border border-[#00FF00]/20 rounded-full animate-[spin_10s_linear_infinite] border-dashed" />
              <div className="absolute -inset-8 border border-[#00FF00]/10 rounded-full animate-[spin_15s_linear_reverse_infinite] border-dotted" />
            </motion.div>
            
            <div className="space-y-1">
              <h1 className="text-5xl font-black tracking-[0.5em] glow-text uppercase relative">
                <span className="relative z-10">NEURAL-SHIELD</span>
                <span className="absolute inset-0 text-red-500 opacity-20 blur-[2px] animate-[glitch_2s_infinite]">NEURAL-SHIELD</span>
                <span className="absolute inset-0 text-blue-500 opacity-20 blur-[2px] animate-[glitch_2.5s_infinite_reverse]">NEURAL-SHIELD</span>
              </h1>
              <div className="flex items-center justify-center gap-2">
                <div className="h-[1px] w-8 bg-[#00FF00]/40" />
                <p className="text-[10px] opacity-40 uppercase tracking-[0.4em] font-black">CORTEX_OS // v3.4.1_SECURE</p>
                <div className="h-[1px] w-8 bg-[#00FF00]/40" />
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {authMode === 'gateway' && (
              <motion.div 
                key="gateway"
                initial={{ opacity: 0, filter: 'blur(20px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
                className="grid gap-6"
              >
                {[
                  { id: 'xtream', icon: QrCode, label: 'Login with Xtream', sub: 'SYNC_API_INTERFACE' },
                  { id: 'm3u', icon: FileText, label: 'Login with M3U', sub: 'EXTRACT_PAYLOAD_CONFIG' },
                  { id: 'master', icon: ShieldCheck, label: 'Master Sync Cloud', sub: 'ROOT_SERVER_ACCESS' }
                ].map((btn, idx) => (
                  <motion.button 
                    key={btn.id}
                    initial={{ x: idx % 2 === 0 ? -50 : 50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.2 + idx * 0.1 }}
                    onClick={() => setAuthMode(btn.id as any)}
                    className="w-full group hacker-border-next bg-black/60 p-6 flex items-center gap-6 hover:bg-[#00FF00]/10 transition-all border-[#00FF00]/20 hover:border-[#00FF00] overflow-hidden relative"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00FF00]/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    
                    <div className="p-4 bg-[#00FF00]/5 border border-[#00FF00]/20 rounded group-hover:bg-[#00FF00]/20 transition-all group-hover:scale-110">
                      <btn.icon className="w-8 h-8" />
                    </div>
                    <div className="text-left relative z-10">
                      <div className="text-sm font-black uppercase tracking-[0.2em]">{btn.label}</div>
                      <div className="text-[9px] opacity-30 font-bold uppercase mt-1 tracking-widest">{btn.sub}</div>
                    </div>
                    <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex gap-1">
                        <div className="w-1 h-1 bg-[#00FF00] animate-pulse" />
                        <div className="w-1 h-1 bg-[#00FF00] animate-pulse [animation-delay:0.2s]" />
                        <div className="w-1 h-1 bg-[#00FF00] animate-pulse [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </motion.button>
                ))}

                <div className="pt-8 text-center">
                  <motion.button 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    whileHover={{ opacity: 1, scale: 1.05 }}
                    onClick={() => { setAuthMode('admin'); setError(null); }}
                    className="flex items-center gap-2 mx-auto text-[10px] uppercase font-black tracking-widest px-4 py-2 border border-[#00FF00]/10 hover:border-[#00FF00]/40 transition-all"
                  >
                    <Shield className="w-3 h-3 text-red-500" /> [ROOT_TERMINAL_ACCESS]
                  </motion.button>
                </div>
              </motion.div>
            )}

            {authMode === 'xtream' && (
              <motion.div 
                key="xtream"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
              >
                <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="hacker-border bg-black/40 p-8 space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => setAuthMode('gateway')} className="p-2 hover:bg-[#00FF00]/10 rounded-full transition-colors">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-xs uppercase font-black tracking-widest">Xtream Configuration</span>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase opacity-50 flex items-center gap-2 px-1">
                        <Globe className="w-3 h-3" /> Server Protocol
                      </label>
                      <input 
                        type="url" 
                        value={auth.url} 
                        onChange={e => setAuth({...auth, url: e.target.value})}
                        placeholder="https://server.url:port"
                        className="w-full bg-black/60 border border-[#00FF00]/20 p-3 text-xs outline-none focus:border-[#00FF00] transition-all"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase opacity-50 flex items-center gap-2 px-1">
                        <User className="w-3 h-3" /> Identity Code
                      </label>
                      <input 
                        type="text" 
                        value={auth.username} 
                        onChange={e => setAuth({...auth, username: e.target.value})}
                        placeholder="Username"
                        className="w-full bg-black/60 border border-[#00FF00]/20 p-3 text-xs outline-none focus:border-[#00FF00] transition-all"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase opacity-50 flex items-center gap-2 px-1">
                        <Lock className="w-3 h-3" /> Decryption Key
                      </label>
                      <input 
                        type="password" 
                        value={auth.password} 
                        onChange={e => setAuth({...auth, password: e.target.value})}
                        placeholder="Password"
                        className="w-full bg-black/60 border border-[#00FF00]/20 p-3 text-xs outline-none focus:border-[#00FF00] transition-all"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase opacity-50 flex items-center gap-2 px-1">
                        <Zap className="w-3 h-3 text-yellow-500" /> Terminal Access Key
                      </label>
                      <input 
                        type="text" 
                        value={accessKey} 
                        onChange={e => setAccessKey(e.target.value)}
                        placeholder="XXXX-XXXX-XXXX-XXXX"
                        className="w-full bg-black/60 border border-yellow-500/20 p-3 text-xs outline-none focus:border-yellow-500 transition-all"
                        required
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full btn-hacker flex items-center justify-center gap-2 py-4 group"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Key className="w-5 h-5" />}
                    {loading ? 'BYPASSING_SECURITY...' : 'INITIALIZE_SYNC'}
                  </button>

                  {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-500 text-[10px] text-center uppercase font-bold mt-2">
                       ACCESS_ERROR: {error}
                    </motion.div>
                  )}
                </form>
              </motion.div>
            )}

            {authMode === 'm3u' && (
              <motion.div 
                key="m3u"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
              >
                <form onSubmit={handleM3ULogin} className="hacker-border bg-black/40 p-8 space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => setAuthMode('gateway')} className="p-2 hover:bg-[#00FF00]/10 rounded-full transition-colors">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-xs uppercase font-black tracking-widest">M3U Data Tunneling</span>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase opacity-50 flex items-center gap-2 px-1">
                        <Globe className="w-3 h-3" /> M3U URL / SOURCE
                      </label>
                      <input 
                        type="url" 
                        value={m3uUrl} 
                        onChange={e => setM3uUrl(e.target.value)}
                        placeholder="https://iptv.provider/playlist.m3u"
                        className="w-full bg-black/60 border border-[#00FF00]/20 p-3 text-xs outline-none focus:border-[#00FF00] transition-all"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase opacity-50 flex items-center gap-2 px-1">
                        <Zap className="w-3 h-3 text-yellow-500" /> Terminal Access Key
                      </label>
                      <input 
                        type="text" 
                        value={accessKey} 
                        onChange={e => setAccessKey(e.target.value)}
                        placeholder="XXXX-XXXX-XXXX-XXXX"
                        className="w-full bg-black/60 border border-yellow-500/20 p-3 text-xs outline-none focus:border-yellow-500 transition-all"
                        required
                      />
                    </div>

                    <p className="text-[8px] opacity-30 uppercase text-center leading-relaxed">
                      Provider must support CORS extraction. If blocked, local file injection is required.
                    </p>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full btn-hacker flex items-center justify-center gap-2 py-4 group"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5" />}
                    {loading ? 'EXTRACTING_PAYLOAD...' : 'START_EXTRACTION'}
                  </button>

                  {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-500 text-[10px] text-center uppercase font-bold mt-2">
                       PAYLOAD_ERROR: {error}
                    </motion.div>
                  )}
                </form>
              </motion.div>
            )}

            {authMode === 'master' && (
              <motion.div 
                key="master"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
              >
                <div className="hacker-border bg-black/40 p-8 space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => setAuthMode('gateway')} className="p-2 hover:bg-[#00FF00]/10 rounded-full transition-colors">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-xs uppercase font-black tracking-widest text-[#00FF00]">MASTER_SYNC // CLOUD_ACCESS</span>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-[#00FF00]/5 border border-[#00FF00]/20 text-center">
                       <ShieldCheck className="w-12 h-12 text-[#00FF00] mx-auto mb-2 animate-pulse" />
                       <p className="text-[10px] opacity-60 uppercase">System requires a valid authorization key to bypass server security.</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase opacity-50 flex items-center gap-2 px-1">
                        <Key className="w-3 h-3 text-[#00FF00]" /> CRYPTOGRAPHIC_ACCESS_KEY
                      </label>
                      <input 
                        type="text" 
                        value={accessKey}
                        onChange={e => setAccessKey(e.target.value)}
                        placeholder="ENTER_MASTER_KEY"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleMasterAccess();
                        }}
                        className="w-full bg-black/60 border border-[#00FF00]/40 p-4 text-sm font-black tracking-widest outline-none focus:border-[#00FF00] transition-all text-center placeholder:opacity-20"
                        autoFocus
                      />
                    </div>

                    <button 
                      onClick={() => handleMasterAccess()}
                      disabled={loading || !accessKey}
                      className="w-full py-4 bg-[#00FF00] text-black font-black uppercase tracking-[0.2em] text-xs hover:bg-[#00FF00]/90 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Cpu className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                          SYSTEM_ENTER
                        </>
                      )}
                    </button>
                    
                    <p className="text-[8px] opacity-20 uppercase text-center mt-4">
                      AUTHORIZED PERSONNEL ONLY. ALL ATTEMPTS LOGGED.
                    </p>
                  </div>

                  {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-500 text-[10px] text-center uppercase font-bold mt-2">
                       {error}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {authMode === 'admin' && (
              <motion.div 
                key="admin"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
              >
                <form onSubmit={handleAdminAuth} className="hacker-border bg-black/40 p-8 space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => setAuthMode('gateway')} className="p-2 hover:bg-[#00FF00]/10 rounded-full transition-colors">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-xs uppercase font-black tracking-widest text-red-500">ROOT // ADMIN CRYPT</span>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase opacity-50 flex items-center gap-2 px-1">
                        <ShieldAlert className="w-3 h-3 text-red-500" /> Administrative Keypad
                      </label>
                      <input 
                        type="password" 
                        value={adminPass} 
                        onChange={e => setAdminPass(e.target.value)}
                        placeholder="ENTER_ROOT_KEY"
                        className="w-full bg-black/60 border border-red-500/20 p-3 text-xs outline-none focus:border-red-500 transition-all text-red-500"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full border border-red-500/40 bg-red-500/10 hover:bg-red-500 hover:text-black text-red-500 font-black uppercase text-xs transition-all flex items-center justify-center gap-2 py-4"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
                    {loading ? 'OVERRIDING_PROTOCOL...' : 'EXECUTE_ROOT_ACCESS'}
                  </button>

                  {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-500 text-[10px] text-center uppercase font-bold mt-2">
                       ACCESS_DENIED: {error}
                    </motion.div>
                  )}
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {loading && (
            <HackingLoader 
              progress={loginProgress} 
              step={loadingStep} 
            />
          )}

          <footer className="text-center opacity-20 text-[9px] uppercase tracking-tighter">
            Neural Tunnel Status: {loading ? 'DIVERGING' : 'STANDBY'} // Protocol: SECURE
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020202] text-[#00FF00] font-mono flex flex-col pb-16 lg:pb-0">
      {/* Top Header */}
      <header className="h-16 border-b border-[#00FF00]/10 px-4 lg:px-6 flex items-center justify-between bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3 lg:gap-4">
          <Terminal className="w-5 h-5 lg:w-6 h-6 text-[#00FF00]" />
          <div>
            <h2 className="text-[10px] lg:text-sm font-black uppercase tracking-widest glow-text">NEURAL // COMMAND</h2>
            <div className="flex items-center gap-2 text-[7px] lg:text-[8px] opacity-40 uppercase tracking-widest">
              SYSTEM: ONLINE | SESSION: {auth.username.toUpperCase()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 lg:gap-6">
          <div className="hidden lg:flex items-center gap-4 border-l border-[#00FF00]/10 pl-6">
            <Stat label="STATUS" val="CONNECTED" />
            <Stat label="CORE" val="STABLE" />
          </div>
          <button 
            onClick={handleLogout}
            className="text-[8px] lg:text-[10px] uppercase font-bold border border-red-500/30 px-2 lg:px-3 py-1 hover:bg-red-500 hover:text-black transition-all"
          >
            Kill Session
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Navigation Rail (Desktop Only) */}
        <aside className="hidden lg:flex w-20 lg:w-64 border-r border-[#00FF00]/10 flex-col bg-black/40">
          <div className="flex-1 py-6 flex flex-col gap-2">
            <SidebarBtn 
              icon={<Home />} 
              label="Overview" 
              active={currentView === 'home'} 
              onClick={() => { setCurrentView('home'); setSelectedCategory(null); }} 
            />
            <SidebarBtn 
              icon={<Film />} 
              label="Movie Archive" 
              active={currentView === 'movies'} 
              onClick={() => { setCurrentView('movies'); setSelectedCategory(null); }} 
            />
            <SidebarBtn 
              icon={<Tv />} 
              label="Series Vault" 
              active={currentView === 'series'} 
              onClick={() => { setCurrentView('series'); setSelectedCategory(null); }} 
            />

            {auth.username === adminAuth.username && (
              <SidebarBtn 
                icon={<Shield className="text-red-500" />} 
                label="Key Control" 
                active={currentView === 'admin_panel'} 
                onClick={() => { setCurrentView('admin_panel'); setSelectedCategory(null); }} 
              />
            )}

            <div className="my-6 px-6">
              <div className="h-[1px] bg-[#00FF00]/10 w-full" />
            </div>

            <div className="px-6 mb-4 flex items-center justify-between">
              <span className="text-[9px] uppercase opacity-40 font-bold tracking-tighter">DATA_SCHEMAS</span>
              {selectedCategory && (
                <button onClick={() => downloadFullCategory(selectedCategory, "Category")} className="text-[#00FF00] hover:scale-110 transition-transform">
                  <Download className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 space-y-1 custom-scrollbar">
              {(currentView === 'movies' ? augmentedVodCats : augmentedSeriesCats).map(cat => (
                <button
                  key={cat.category_id}
                  onClick={() => setCategorySelection({ id: cat.category_id, name: cat.category_name })}
                  className={`w-full text-left text-[10px] p-2 hover:bg-[#00FF00]/5 transition-all truncate uppercase ${
                    selectedCategory === cat.category_id ? 'bg-[#00FF00] text-black font-bold' : 'opacity-60'
                  }`}
                >
                  &gt; {cat.category_name}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 border-t border-[#00FF00]/10 bg-black/60 h-40 overflow-hidden hidden lg:block">
             <div className="flex items-center gap-2 text-[9px] opacity-40 uppercase mb-2">
               <Activity className="w-3 h-3" /> Live Feed
             </div>
             <div className="space-y-1 text-[8px] opacity-30 font-mono">
               {logs.map((log, i) => <div key={i} className="truncate">{log}</div>)}
             </div>
          </div>
        </aside>

        {/* Mobile Categories Overlay */}
        <AnimatePresence>
          {showMobileCats && (
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="lg:hidden fixed inset-y-0 left-0 w-4/5 max-w-xs bg-[#050505] z-50 p-6 flex flex-col hacker-border border-r border-[#00FF00]/30 shadow-[0_0_20px_rgba(0,255,0,0.2)]"
            >
               <div className="flex items-center justify-between mb-8">
                 <h3 className="text-sm font-black uppercase tracking-widest text-[#00FF00]">Categories</h3>
                 <button onClick={() => setShowMobileCats(false)} className="text-[#00FF00]/40"><RefreshCcw className="w-5 h-5 rotate-45" /></button>
               </div>

               <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                 {(currentView === 'movies' ? augmentedVodCats : augmentedSeriesCats).map(cat => (
                    <button
                      key={cat.category_id}
                      onClick={() => setCategorySelection({ id: cat.category_id, name: cat.category_name })}
                      className={`w-full text-left text-[11px] p-3 border transition-all truncate uppercase ${
                        selectedCategory === cat.category_id ? 'border-[#00FF00] bg-[#00FF00]/10 text-[#00FF00] font-bold' : 'border-[#00FF00]/10 opacity-60'
                      }`}
                    >
                      {cat.category_name}
                    </button>
                 ))}
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Console */}
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#0a0a0a] to-black">
          <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8 lg:space-y-12">
            
            {loading ? (
              <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-12 h-12 text-[#00FF00] animate-spin" />
                <p className="text-xs uppercase tracking-[0.5em] animate-pulse">Synchronizing Neural Path...</p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentView + selectedCategory}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  {currentView === 'admin_panel' ? (
                    <div className="space-y-8">
                       <header className="border-b border-red-500/20 pb-6 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                         <div className="flex items-center gap-4">
                           <Shield className="w-8 h-8 text-red-500 flex-shrink-0" />
                           <div>
                             <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-red-500">Terminal Access Control</h2>
                             <p className="text-[10px] opacity-40 uppercase font-black">Generate & Manage Secure Extraction Keys</p>
                           </div>
                         </div>
                         
                         <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                           <div className="relative group flex-1 xl:w-64">
                             <input 
                               type="text"
                               value={customKeyName}
                               onChange={(e) => setCustomKeyName(e.target.value)}
                               placeholder="ENTER_CUSTOM_NAME_OR_LEAVE_BLANK"
                               className="w-full bg-black border border-red-500/30 p-3 text-[10px] uppercase font-bold outline-none focus:border-red-500 transition-all placeholder:opacity-20"
                             />
                             <div className="absolute top-0 right-3 h-full flex items-center pointer-events-none">
                               <Key className="w-3 h-3 opacity-20" />
                             </div>
                           </div>
                           <button 
                             onClick={generateNewKey}
                             disabled={isGeneratingKey}
                             className="bg-red-500 text-black px-8 py-3 font-black uppercase text-xs hover:bg-red-600 transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
                           >
                             {isGeneratingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                             {isGeneratingKey ? 'DIVERGING...' : 'CREATE_LICENSE_KEY'}
                           </button>
                         </div>
                       </header>

                       <div className="grid gap-4">
                         {adminKeys.length === 0 ? (
                           <div className="h-64 border border-dashed border-white/10 flex items-center justify-center opacity-20 uppercase text-xs italic tracking-widest">
                             No_Active_Keys_In_Database
                           </div>
                         ) : (
                           adminKeys.map(k => (
                             <div key={k.id} className="hacker-border bg-black/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                               <div className="flex items-center gap-4 md:gap-6">
                                 <div className="w-10 h-10 bg-red-500/10 border border-red-500/20 rounded flex items-center justify-center flex-shrink-0">
                                   <Zap className="w-5 h-5 text-yellow-500" />
                                 </div>
                                 <div className="space-y-1 min-w-0">
                                   <div className="text-sm md:text-lg font-black tracking-[0.2em] text-white truncate">[{k.key}]</div>
                                   <div className="text-[8px] opacity-30 uppercase font-bold tracking-widest truncate">UID: {k.id} // SECURE_ACCESS_LICENSE</div>
                                 </div>
                               </div>
                               <div className="flex items-center gap-3 justify-end">
                                 <button 
                                   onClick={() => copyToClipboard(k.key)}
                                   className="p-2 border border-white/10 hover:border-white/40 opacity-40 hover:opacity-100 transition-all"
                                 >
                                   <Copy className="w-4 h-4" />
                                 </button>
                                 <button 
                                   onClick={() => deleteKey(k.id)}
                                   className="p-2 border border-red-500/20 hover:border-red-500 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-black transition-all"
                                 >
                                   <Lock className="w-4 h-4" />
                                 </button>
                               </div>
                             </div>
                           ))
                         )}
                       </div>
                    </div>
                  ) : currentView === 'home' ? (
                    <div className="grid grid-cols-1 gap-8 lg:gap-12">
                      <div className="space-y-6">
                        <header className="flex items-center justify-between border-b border-[#00FF00]/20 pb-4">
                          <div className="flex items-center gap-3">
                            <Zap className="w-5 h-5 lg:w-6 lg:h-6 text-yellow-400" />
                            <h3 className="text-sm lg:text-xl font-bold uppercase italic tracking-tighter">Recently Cracked Movies (Unlimited)</h3>
                          </div>
                          <button 
                            onClick={() => {
                              setCurrentView('movies');
                              setCategorySelection({ id: 'recently_added', name: 'Recently Cracked Movies' });
                            }} 
                            className="text-[8px] lg:text-[10px] uppercase font-bold opacity-40 hover:opacity-100 flex items-center gap-2"
                          >
                             Full Archive <ChevronRight className="w-3 h-3" />
                          </button>
                        </header>
                        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 lg:gap-4">
                          {recentlyAddedMovies.slice(0, 100).map(item => (
                            <React.Fragment key={item.stream_id}>
                              <ContentCard 
                                item={item} 
                                type="movie" 
                                xtream={xtream!} 
                                addLog={addLog} 
                                categories={vodCats}
                                episodeRegistry={episodeRegistry}
                                setEpisodeRegistry={setEpisodeRegistry}
                                iconRegistry={iconRegistry}
                                setIconRegistry={setIconRegistry}
                                isM3UMode={isM3UMode}
                              />
                            </React.Fragment>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-6">
                        <header className="flex items-center justify-between border-b border-[#00FF00]/20 pb-4 text-blue-400">
                          <div className="flex items-center gap-3">
                            <BarChart3 className="w-5 h-5 lg:w-6 lg:h-6" />
                            <h3 className="text-sm lg:text-xl font-bold uppercase italic tracking-tighter">Recently Added Web Series (Unlimited)</h3>
                          </div>
                          <button 
                            onClick={() => {
                              setCurrentView('series');
                              setCategorySelection({ id: 'recently_added', name: 'Recently Added Web Series' });
                            }} 
                            className="text-[8px] lg:text-[10px] uppercase font-bold opacity-40 hover:opacity-100 flex items-center gap-2"
                          >
                             Full Archive <ChevronRight className="w-3 h-3" />
                          </button>
                        </header>
                        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 lg:gap-4">
                          {recentlyAddedSeries.slice(0, 100).map(item => (
                            <React.Fragment key={item.series_id}>
                              <ContentCard 
                                item={item} 
                                type="series" 
                                xtream={xtream!} 
                                addLog={addLog} 
                                categories={seriesCats}
                                episodeRegistry={episodeRegistry}
                                setEpisodeRegistry={setEpisodeRegistry}
                                iconRegistry={iconRegistry}
                                setIconRegistry={setIconRegistry}
                                onOpenSeries={(s) => setSelectedSeriesForDetail(s)}
                                onCheckOnMaster={onCheckOnMaster}
                                isM3UMode={isM3UMode}
                              />
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6 lg:space-y-8">
                      {!selectedCategory ? (
                        <div className="space-y-8">
                          <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#00FF00]/20 pb-4 gap-4">
                            <h3 className="text-lg lg:text-2xl font-black uppercase italic tracking-tight glow-text flex items-center gap-4">
                              <Database className="w-5 h-5 lg:w-6 lg:h-6" />
                              Select {currentView === 'movies' ? 'Movie' : 'Series'} Category
                            </h3>
                            
                            <div className="relative hacker-border px-3 py-1 bg-black/40 flex items-center gap-2">
                              <Filter className="w-3 h-3 opacity-40 text-[#00FF00]" />
                              <input 
                                value={categorySearchQuery}
                                onChange={e => setCategorySearchQuery(e.target.value)}
                                placeholder="FILTER_CATEGORIES..."
                                className="bg-transparent border-none outline-none text-[9px] lg:text-[10px] uppercase w-full lg:w-48 text-[#00FF00]"
                              />
                            </div>
                          </header>

                          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 lg:gap-4">
                            {(currentView === 'movies' ? augmentedVodCats : augmentedSeriesCats)
                              .filter(cat => cat.category_name.toLowerCase().includes(categorySearchQuery.toLowerCase()))
                              .map(cat => (
                                <button
                                  key={cat.category_id}
                                  onClick={() => {
                                    setCategorySelection({ id: cat.category_id, name: cat.category_name });
                                    setCategorySearchQuery(''); // Reset search when category selection is initiated
                                  }}
                                className="hacker-border bg-black/40 hover:bg-[#00FF00]/10 p-6 flex flex-col items-center justify-center text-center group transition-all"
                              >
                                {cat.category_id === 'recently_added' ? (
                                  <Zap className="w-8 h-8 mb-3 text-yellow-500 group-hover:scale-125 transition-transform" />
                                ) : (
                                  <Layers className="w-8 h-8 mb-3 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all text-[#00FF00]" />
                                )}
                                <span className="text-[10px] font-black uppercase tracking-tight line-clamp-2">{cat.category_name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <>
                          <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#00FF00]/20 pb-4 gap-4">
                            <div className="flex items-center gap-4">
                              <button 
                                onClick={() => setSelectedCategory(null)}
                                className="text-[#00FF00]/40 hover:text-[#00FF00] flex items-center gap-2 text-[10px] uppercase font-black"
                              >
                                &lt; BACK
                              </button>
                              <div className="h-6 w-[1px] bg-[#00FF00]/10 mx-2" />
                              <Database className="w-5 h-5 lg:w-6 lg:h-6" />
                              <h3 className="text-lg lg:text-2xl font-black uppercase italic tracking-tight glow-text">
                                {(currentView === 'movies' ? augmentedVodCats : augmentedSeriesCats).find(c => c.category_id === selectedCategory)?.category_name}
                              </h3>
                            </div>
                               <div className="flex flex-wrap items-center gap-2 lg:gap-4">
                               {(currentView === 'series' || currentView === 'movies') && selectedCategory && (
                                  <button 
                                    onClick={() => {
                                      setSelectionMode(!selectionMode);
                                      if (selectionMode) setSelectedSeries(new Map());
                                    }}
                                    className={`btn-hacker py-1 px-3 text-[8px] lg:text-[10px] flex items-center gap-2 whitespace-nowrap ${selectionMode ? 'bg-[#00FF00] text-black border-[#00FF00]' : 'opacity-60'}`}
                                  >
                                    <Layers className="w-3 h-3" /> {selectionMode ? 'CANCEL' : 'MULTI_SELECT'}
                                  </button>
                               )}
                               {selectionMode && selectedSeries.size > 0 && (
                                 <button 
                                   onClick={() => setShowMergerModal(true)}
                                   className="btn-hacker py-1 px-3 text-[8px] lg:text-[10px] flex items-center gap-2 bg-blue-500 text-white border-blue-400 hover:bg-blue-600 animate-pulse transition-all shadow-[0_0_15px_rgba(59,130,246,0.5)] whitespace-nowrap"
                                 >
                                   <Zap className="w-3 h-3" /> EXPORT_{selectedSeries.size}
                                 </button>
                               )}
                               {selectedCategory && selectedCategory !== 'all' && selectedCategory !== 'recently_added' && (
                                 <div className="relative hacker-border px-3 py-1 bg-black/40 flex items-center gap-2 whitespace-nowrap">
                                   <Filter className="w-3 h-3 opacity-40 text-[#00FF00]" />
                                   <select 
                                     value={sortBy}
                                     onChange={(e) => setSortBy(e.target.value as any)}
                                     className="bg-transparent border-none outline-none text-[9px] lg:text-[10px] uppercase text-[#00FF00] cursor-pointer appearance-none px-1"
                                   >
                                     <option value="top_added" className="bg-black text-[#00FF00]">TOP ADDED</option>
                                     <option value="old_added" className="bg-black text-[#00FF00]">OLD ADDED</option>
                                     <option value="alphabetical" className="bg-black text-[#00FF00]">ALPHABETICAL</option>
                                   </select>
                                 </div>
                               )}
                               <div className="relative flex-1 min-w-[150px] hacker-border px-3 py-2 bg-black/40 flex items-center gap-2">
                                 <Search className="w-3 h-3 opacity-40" />
                                 <input 
                                   value={searchQuery}
                                   onChange={e => setSearchQuery(e.target.value)}
                                   placeholder="SEARCH..."
                                   className="bg-transparent border-none outline-none text-[9px] lg:text-[10px] uppercase w-full"
                                 />
                               </div>
                               <button 
                                 onClick={() => {
                                   const catName = (currentView === 'movies' ? augmentedVodCats : augmentedSeriesCats).find(c => c.category_id === selectedCategory)?.category_name || "Category";
                                   downloadFullCategory(selectedCategory!, catName);
                                 }} 
                                 className="btn-hacker py-1 px-3 text-[8px] lg:text-[10px] flex items-center gap-2 whitespace-nowrap ml-auto lg:ml-0"
                               >
                                 <Download className="w-3 h-3" /> DUMP
                               </button>
                            </div>
                          </header>

                          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 lg:gap-4">
                            {displayList.map(item => (
                                <React.Fragment key={(item as any).stream_id || (item as any).series_id}>
                                  <ContentCard 
                                    item={item} 
                                    type={currentView === 'movies' ? 'movie' : 'series'} 
                                    xtream={xtream!} 
                                    addLog={addLog} 
                                    categories={currentView === 'movies' ? vodCats : seriesCats}
                                    episodeRegistry={episodeRegistry}
                                    setEpisodeRegistry={setEpisodeRegistry}
                                    iconRegistry={iconRegistry}
                                    setIconRegistry={setIconRegistry}
                                    onOpenSeries={(s) => setSelectedSeriesForDetail(s)}
                                    onCheckOnMaster={onCheckOnMaster}
                                    isM3UMode={isM3UMode}
                                    isSelectionMode={selectionMode}
                                    isSelected={selectedSeries.has((item as any).series_id || (item as any).stream_id)}
                                    onToggleSelection={() => toggleSelection(item as any)}
                                  />
                                </React.Fragment>
                              ))
                            }
                          </div>

                          {(displayList.length >= 100) && (
                            <div className="flex justify-center pt-8">
                              <button 
                                onClick={() => setRenderLimit(prev => prev + 100)}
                                className="btn-hacker py-3 flex items-center gap-2 group"
                              >
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                LOAD_MORE_PACKETS
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
            
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-black border-t border-[#00FF00]/20 flex items-center justify-around px-2 z-[60] backdrop-blur-lg">
         <MobileNavBtn 
           active={currentView === 'home'} 
           icon={<Home className="w-5 h-5" />} 
           label="Home" 
           onClick={() => { setCurrentView('home'); setSelectedCategory(null); }} 
         />
         <MobileNavBtn 
           active={currentView === 'movies'} 
           icon={<Film className="w-5 h-5" />} 
           label="Movies" 
           onClick={() => { setCurrentView('movies'); setSelectedCategory(null); }} 
         />
         <MobileNavBtn 
           active={currentView === 'series'} 
           icon={<Tv className="w-5 h-5" />} 
           label="Series" 
           onClick={() => { setCurrentView('series'); setSelectedCategory(null); }} 
         />
         <MobileNavBtn 
           active={showMobileCats} 
           icon={<Filter className="w-5 h-5" />} 
           label="Filter" 
           onClick={() => setShowMobileCats(!showMobileCats)} 
           disabled={currentView === 'home' || currentView === 'admin_panel'}
         />
         {auth.username === adminAuth.username && (
           <MobileNavBtn 
             active={currentView === 'admin_panel'} 
             icon={<Shield className="w-5 h-5 text-red-500" />} 
             label="Keys" 
             onClick={() => { setCurrentView('admin_panel'); setSelectedCategory(null); }} 
           />
         )}
      </nav>

      {/* Category Action Prompt Modal */}
      <AnimatePresence>
        {categorySelection && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm hacker-border bg-[#0a0a0a] p-8 space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="text-[10px] uppercase opacity-40 font-black tracking-[0.3em] overflow-hidden truncate px-4">{categorySelection.name}</div>
                <h3 className="text-sm font-black uppercase text-[#00FF00]">Choose Action</h3>
              </div>

              <div className="grid gap-3">
                <button 
                  onClick={() => {
                    setSelectedCategory(categorySelection.id);
                    setCategorySelection(null);
                    setShowMobileCats(false);
                  }}
                  className="w-full btn-hacker flex items-center justify-center gap-3 py-4 group"
                >
                  <Eye className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span>OPEN_CATEGORY</span>
                </button>
                
                <button 
                  onClick={() => {
                    downloadFullCategory(categorySelection.id, categorySelection.name);
                    setCategorySelection(null);
                    setShowMobileCats(false);
                  }}
                  className="w-full border border-[#00FF00]/40 bg-[#00FF00]/5 hover:bg-[#00FF00] hover:text-black py-4 font-black uppercase text-xs flex items-center justify-center gap-3 transition-all"
                >
                  <Download className="w-5 h-5" />
                  <span>DOWNLOAD_ALL_M3U</span>
                </button>

                <button 
                  onClick={() => setCategorySelection(null)}
                  className="w-full py-3 text-[10px] uppercase font-black opacity-30 hover:opacity-100 transition-opacity"
                >
                  [ CANCEL_OPERATION ]
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedSeriesForDetail && (
          <SeriesDetailModal 
            series={selectedSeriesForDetail} 
            xtream={xtream!} 
            onClose={() => setSelectedSeriesForDetail(null)} 
            addLog={addLog}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showMergerModal && (
          <BulkExporterModal
            selectedItems={Array.from(selectedSeries.values())}
            type={currentView === 'movies' ? 'movie' : 'series'}
            xtream={xtream!}
            episodeRegistry={episodeRegistry}
            iconRegistry={iconRegistry}
            categories={currentView === 'movies' ? vodCats : seriesCats}
            onClose={() => setShowMergerModal(false)}
            addLog={addLog}
            onComplete={() => {
              setShowMergerModal(false);
              setSelectionMode(false);
              setSelectedSeries(new Map());
            }}
          />
        )}
        {activeSyncReport && (
          <SyncResultsModal 
            report={activeSyncReport.report} 
            seriesName={activeSyncReport.name} 
            onClose={() => setActiveSyncReport(null)} 
            addLog={addLog}
          />
        )}
        {syncProgress.active && (
          <SyncProcessingModal 
            step={syncProgress.step}
            details={syncProgress.details}
            name={syncProgress.name}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const MobileNavBtn = ({ active, icon, label, onClick, disabled }: { active: boolean, icon: any, label: string, onClick: () => void, disabled?: boolean }) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={`flex flex-col items-center justify-center gap-1 transition-all flex-1 relative ${
      disabled ? 'opacity-10' : (active ? 'text-[#00FF00]' : 'text-[#00FF00]/30')
    }`}
  >
    {icon}
    <span className="text-[8px] uppercase font-bold tracking-widest">{label}</span>
    {active && <div className="absolute top-0 w-8 h-[1px] bg-[#00FF00] shadow-[0_0_5px_#00FF00]" />}
  </button>
);

const Stat = ({ label, val }: { label: string, val: string }) => (
  <div className="flex flex-col items-end">
    <span className="text-[8px] opacity-30 font-bold uppercase tracking-widest">{label}</span>
    <span className="text-[10px] font-black">{val}</span>
  </div>
);

const TerminalBootLog = () => {
  const [lines, setLines] = useState<string[]>([]);
  const allLines = [
    "> INITIALIZING_NEURAL_LINK...",
    "> BYPASSING_FIREWALLS...",
    "> HARVESTING_PACKETS...",
    "> DECRYPTING_XTREAM_V3...",
    "> CORTEX_SYSTEM_ONLINE.",
    "> WAITING_FOR_AUTH_TOKEN..."
  ];

  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      if (current < allLines.length) {
        setLines(prev => [...prev, allLines[current]]);
        current++;
      } else {
        clearInterval(interval);
      }
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute top-4 left-4 font-mono text-[8px] text-[#00FF00]/40 space-y-1 pointer-events-none z-40 hidden lg:block">
      {lines.map((line, i) => (
        <motion.div 
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
        >
          {line}
        </motion.div>
      ))}
    </div>
  );
};

const MatrixRain = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()*&^%';
    const fontSize = 14;
    const columns = Math.floor(width / fontSize);
    const drops: number[] = Array(columns).fill(1);

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#0F0';
      ctx.font = fontSize + 'px monospace';

      for (let i = 0; i < drops.length; i++) {
        const text = letters.charAt(Math.floor(Math.random() * letters.length));
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 33);
    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 z-0 opacity-20 pointer-events-none" />;
};

const openM3UTextInTab = (m3uContent: string, title: string) => {
  // Downgrade https for extraction as requested
  let processed = m3uContent.replace(/https:\/\//g, 'http://');
  
  // ONLY inject :80 if it's the specific admin domain and no port is specified
  processed = processed.replace(/(http:\/\/sjstorestar4k\.store)([^\/\s\r\n]*)?/g, (match, origin, path) => {
    if (!origin.includes(':', 7) && !(path && path.startsWith(':'))) {
      return origin + ':80' + (path || '');
    }
    return match;
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>TERMINAL // M3U_EXTRACTOR // ${title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap');
        
        :root {
          --neon: #00FF00;
          --neon-dim: rgba(0, 255, 0, 0.2);
          --bg: #050505;
        }

        body { 
          background: var(--bg); 
          color: var(--neon); 
          font-family: 'JetBrains Mono', monospace; 
          padding: 40px; 
          font-size: 13px; 
          line-height: 1.5; 
          margin: 0; 
          overflow-x: hidden;
          background-image: 
            radial-gradient(circle at 2px 2px, rgba(0, 255, 0, 0.05) 1px, transparent 0);
          background-size: 40px 40px;
        }

        /* Matrix Rain Effect Simple */
        canvas {
          position: fixed;
          top: 0;
          left: 0;
          z-index: -1;
          opacity: 0.15;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }

        .header { 
          border-left: 4px solid var(--neon); 
          padding-left: 20px; 
          margin-bottom: 30px;
          position: relative;
          animation: slideIn 0.5s cubic-bezier(0.23, 1, 0.32, 1);
        }

        @keyframes slideIn {
          from { transform: translateX(-50px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        .meta { 
          font-size: 10px; 
          opacity: 0.5; 
          letter-spacing: 3px; 
          font-weight: 800; 
          margin-bottom: 8px;
          text-shadow: 0 0 5px var(--neon);
        }

        .title { 
          font-weight: 800; 
          letter-spacing: 1px; 
          text-transform: uppercase; 
          font-size: 24px;
          margin: 0;
        }

        .toolbar {
          display: flex;
          gap: 15px;
          margin-bottom: 20px;
          animation: fadeIn 1s ease 0.3s both;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .btn {
          background: transparent;
          border: 1px solid var(--neon);
          color: var(--neon);
          padding: 10px 20px;
          font-family: inherit;
          font-weight: 800;
          font-size: 11px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
          letter-spacing: 1px;
          position: relative;
          overflow: hidden;
        }

        .btn:hover {
          background: var(--neon);
          color: black;
          box-shadow: 0 0 20px var(--neon-dim);
        }

        .btn:active {
          transform: scale(0.95);
        }

        .btn.copy-btn {
          background: var(--neon-dim);
        }

        .btn::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(45deg, transparent, rgba(0,255,0,0.1), transparent);
          transform: rotate(45deg);
          transition: 0.5s;
        }

        .btn:hover::after {
          left: 100%;
        }

        .code-wrapper {
          position: relative;
          animation: expandUp 0.6s cubic-bezier(0.23, 1, 0.32, 1) 0.1s both;
        }

        @keyframes expandUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        pre { 
          background: rgba(0, 10, 0, 0.8); 
          padding: 30px; 
          border: 1px solid rgba(0, 255, 0, 0.3); 
          white-space: pre; 
          overflow-x: auto; 
          cursor: text;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
          max-height: 70vh;
          scrollbar-width: thin;
          scrollbar-color: var(--neon) transparent;
        }

        pre::-webkit-scrollbar { width: 6px; height: 6px; }
        pre::-webkit-scrollbar-thumb { background: var(--neon); }

        .toast {
          position: fixed;
          top: 20px;
          right: 20px;
          background: var(--neon);
          color: black;
          padding: 12px 25px;
          font-weight: 800;
          font-size: 12px;
          transform: translateY(-100px);
          transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          z-index: 1000;
          box-shadow: 0 0 30px var(--neon);
        }

        .toast.active { transform: translateY(0); }

        .footer { 
          margin-top: 30px; 
          font-size: 9px; 
          opacity: 0.3; 
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .pulse {
          width: 8px;
          height: 8px;
          background: var(--neon);
          border-radius: 50%;
          display: inline-block;
          margin-right: 10px;
          animation: pulse-glow 2s infinite;
        }

        @keyframes pulse-glow {
          0% { box-shadow: 0 0 0 0px rgba(0, 255, 0, 0.7); }
          100% { box-shadow: 0 0 0 10px rgba(0, 255, 0, 0); }
        }
      </style>
    </head>
    <body>
      <canvas id="matrix"></canvas>
      <div id="toast" class="toast">LINK_BATCH_COPIED_TO_CLIPBOARD</div>

      <div class="container">
        <div class="header">
          <div class="meta">XTREAM_CORE // SYSTEM_DUMP // R-TYPE: M3U_PLAYLIST</div>
          <h1 class="title">${title}</h1>
        </div>

        <div class="toolbar">
          <button class="btn copy-btn" onclick="copyAll()">
            <span class="pulse"></span>
            COPY_ALL_DATA
          </button>
          <button class="btn" onclick="window.close()">
            TERMINATE_SESSION
          </button>
        </div>

        <div class="code-wrapper">
          <pre id="m3u-content">${processed}</pre>
        </div>

        <div class="footer">
          <span>ENCRYPTED STREAM LINKS - AUTHENTICATION ATTACHED - (C) 2026 NEURAL COMMAND</span>
          <span>OS_VERSION: 9.2.0-STABLE // BUILD: 0X8273F</span>
        </div>
      </div>

      <script>
        const canvas = document.getElementById('matrix');
        const ctx = canvas.getContext('2d');

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()*&^%';
        const fontSize = 14;
        const columns = canvas.width / fontSize;
        const drops = Array(Math.floor(columns)).fill(1);

        function draw() {
          ctx.fillStyle = 'rgba(5, 5, 5, 0.05)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#0F0';
          ctx.font = fontSize + 'px monospace';

          for (let i = 0; i < drops.length; i++) {
            const text = letters.charAt(Math.floor(Math.random() * letters.length));
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);
            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
              drops[i] = 0;
            }
            drops[i]++;
          }
        }

        setInterval(draw, 33);

        function copyAll() {
          const content = document.getElementById('m3u-content').innerText;
          navigator.clipboard.writeText(content).then(() => {
            const toast = document.getElementById('toast');
            toast.classList.add('active');
            setTimeout(() => toast.classList.remove('active'), 2500);
          });
        }

        window.onresize = () => {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
        };
      </script>
    </body>
    </html>
  `;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
};

const BulkExporterModal = ({ 
  selectedItems, 
  type,
  xtream, 
  episodeRegistry,
  iconRegistry,
  categories,
  onClose, 
  addLog, 
  onComplete 
}: { 
  selectedItems: (any)[], 
  type: 'movie' | 'series',
  xtream: XtreamService, 
  episodeRegistry: Map<number, number>,
  iconRegistry: Map<number, string>,
  categories: XtreamCategory[],
  onClose: () => void, 
  addLog: (m: string) => void,
  onComplete: () => void
}) => {
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleExport = async (mode: 'download' | 'text' | 'frame') => {
    setIsProcessing(true);
    addLog(`INITIATING_BULK_EXPORT: PROCESSING ${selectedItems.length} ITEMS...`);

    try {
      if (mode === 'frame') {
        addLog("POSTER_FRAME: FETCHING METADATA SYNC...");
        
        // Sync enriched metadata from registry and category list into the items being passed to generator
        const enrichedItems = selectedItems.map(item => {
          const sid = item.series_id || item.stream_id;
          const regCount = episodeRegistry.get(Number(sid));
          const cachedIcon = iconRegistry.get(Number(sid));
          const cat = categories.find(c => String(c.category_id) === String(item.category_id));
          
          return { 
            ...item, 
            cover: cachedIcon || item.cover,
            stream_icon: cachedIcon || item.stream_icon,
            final_episode_count: regCount,
            total_episodes: regCount,
            category_name: cat ? cat.category_name : ''
          };
        });

        addLog("POSTER_FRAME: GENERATING LUXURY COLLAGE...");
        const dataUrl = await PosterGenerator.generateCollage(enrichedItems, type, (msg) => addLog(msg));
        const a = document.createElement('a');
        a.href = dataUrl;
        const fileName = `${selectedItems[0].name.replace(/\s+/g, '_')}_POSTER_FRAME.jpg`;
        a.download = fileName;
        a.click();
        addLog(`POSTER_FRAME: DOWNLOADED AS [${fileName}].`);
        setIsProcessing(false);
        return;
      }

      if (type === 'movie') {
        // Simple Movie M3U Export
        let m3u = "#EXTM3U\r\n";
        selectedItems.forEach(movie => {
          const url = xtream.generateM3ULink(movie.stream_id, movie.container_extension || 'mp4', 'movie');
          m3u += `#EXTINF:-1 tvg-id="" tvg-name="${movie.name}" tvg-logo="${movie.stream_icon}" group-title="${movie.name}",${movie.name}\r\n${url}\r\n`;
        });

        if (mode === 'download') {
          // Force http for extraction compatibility as requested by user
          const blob = new Blob([m3u.replace(/https:\/\//g, 'http://')], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const fileName = selectedItems[0].name.replace(/\s+/g, '_');
          a.download = `${fileName}.m3u`;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          openM3UTextInTab(m3u, `${selectedItems[0].name} + ${selectedItems.length - 1} OTHER MOVIES`);
        }
      } else {
        const merger = new MergerService(xtream);
        const items: MergedSeriesItem[] = selectedItems.map(s => ({
          series: s,
          language: ""
        }));

        const m3u = await merger.generateMergedM3U("Bulk_Export", items, addLog);
        
        if (mode === 'download') {
          // Force http for extraction compatibility as requested by user
          const blob = new Blob([m3u.replace(/https:\/\//g, 'http://')], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const fileName = selectedItems[0].name.replace(/\s+/g, '_');
          a.download = `${fileName}.m3u`;
          a.click();
          URL.revokeObjectURL(url);
          addLog(`EXPORT_COMPLETE: DOWNLOADED AS [${fileName}.m3u].`);
        } else {
          openM3UTextInTab(m3u, `${selectedItems[0].name} + ${selectedItems.length - 1} OTHER SERIES`);
          addLog(`EXPORT_COMPLETE: OPENED TERMINAL VIEW.`);
        }
      }
      
      onComplete();
    } catch (err) {
      addLog("ERR: BULK_EXPORT_FAILED");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md"
    >
      <div className="w-full max-w-2xl hacker-border bg-[#050505] p-6 lg:p-10 space-y-8 overflow-y-auto max-h-[90vh]">
        <div className="space-y-2 border-b border-[#00FF00]/20 pb-6 text-center">
          <h2 className="text-xl font-black uppercase text-[#00FF00] glow-text flex items-center justify-center gap-3 text-2xl">
             <Zap className="w-8 h-8" /> BULK_ITEM_MACHINE
          </h2>
          <p className="text-[10px] opacity-40 uppercase font-black tracking-[0.3em] mt-2">Selected Matrix: {selectedItems.length} Components</p>
        </div>

        <div className="space-y-8">
           <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
             {selectedItems.map((s, idx) => (
               <div key={idx} className="aspect-square hacker-border overflow-hidden relative group">
                 <img src={s.cover || s.stream_icon} className="w-full h-full object-cover opacity-80" referrerPolicy="no-referrer" />
                 <div className="absolute inset-0 bg-[#00FF00]/10" />
               </div>
             ))}
           </div>
        </div>

        <div className="flex flex-col gap-6 pt-6">
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <button 
                onClick={() => handleExport('download')}
                disabled={isProcessing}
                className="btn-hacker py-6 flex items-center justify-center gap-3 bg-blue-600 text-white border-blue-400 group transition-all hover:scale-[1.02]"
             >
               {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Download className="w-6 h-6 group-hover:scale-125 transition-transform" />}
               <span className="font-black text-sm">DOWNLOAD_M3U_FILE</span>
             </button>

             <button 
                onClick={() => handleExport('text')}
                disabled={isProcessing}
                className="btn-hacker py-6 flex items-center justify-center gap-3 bg-[#00FF00] text-black border-[#00FF00] group transition-all hover:scale-[1.02]"
             >
               {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <ExternalLink className="w-6 h-6 group-hover:scale-125 transition-transform" />}
               <span className="font-black text-sm">OPEN_M3U_TEXT</span>
             </button>

             <button 
                onClick={() => handleExport('frame')}
                disabled={isProcessing}
                className="col-span-1 sm:col-span-2 btn-hacker py-6 flex items-center justify-center gap-3 bg-purple-600 text-white border-purple-400 group transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(168,85,247,0.3)]"
             >
               {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImageIcon className="w-6 h-6 group-hover:scale-125 transition-transform" />}
               <span className="font-black text-sm">GENERATE_POSTER_FRAME</span>
             </button>
           </div>

           <button 
             onClick={onClose}
             className="w-full py-4 text-[12px] uppercase font-black opacity-30 hover:opacity-100 transition-opacity tracking-[0.5em]"
           >
             [ ABORT_OPERATION ]
           </button>
        </div>
      </div>
    </motion.div>
  );
};

const SeriesDetailModal = ({ series, xtream, onClose, addLog }: { series: XtreamSeries & { localEpisodes?: any[] }, xtream: XtreamService | null, onClose: () => void, addLog: (m: string) => void }) => {
  const [info, setInfo] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSeason, setActiveSeason] = useState<string | null>(null);

  useEffect(() => {
    const fetchInfo = async () => {
      if (series.localEpisodes) {
        setInfo({
          info: { ...series },
          episodes: { "1": series.localEpisodes }
        });
        setActiveSeason("1");
        setLoading(false);
        return;
      }
      
      if (!xtream) return;
      
      try {
        const data = await xtream.getSeriesInfo(series.series_id);
        setInfo(data);
        const seasons = Object.keys(data.episodes);
        if (seasons.length > 0) setActiveSeason(seasons[0]);
      } catch (err) {
        addLog('ERR: FETCH_SERIES_INFO_FAILED');
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
  }, [series]);

  const copyEpisode = (ep: any) => {
    let link = "";
    if (ep.raw_url) {
      link = ep.raw_url;
    } else if (xtream) {
      link = xtream.generateM3ULink(ep.id, ep.container_extension, 'series');
    }
    
    if (!link) return;
    
    const m3u = `#EXTM3U\r\n#EXTINF:-1 tvg-id="" tvg-name="${ep.title}" tvg-logo="${series.cover}" group-title="${series.name}",${ep.title}\r\n${link}\r\n`;
    copyToClipboard(m3u);
    addLog(`EPISODE_LINK_COPIED: ${ep.title.substring(0, 20)}...`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-12 bg-black/90 backdrop-blur-xl"
    >
      <div className="w-full max-w-5xl h-full lg:h-auto lg:max-h-[85vh] bg-[#050505] border border-[#00FF00]/40 flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,255,0,0.1)]">
        {/* Header */}
        <div className="p-4 lg:p-6 border-b border-[#00FF00]/20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-2 hover:bg-[#00FF00]/10 text-[#00FF00]/60 hover:text-[#00FF00]">
              <ChevronRight className="w-6 h-6 rotate-180" />
            </button>
            <h2 className="text-sm lg:text-xl font-black uppercase tracking-widest glow-text line-clamp-1">{series.name}</h2>
          </div>
          <button onClick={onClose} className="text-[10px] font-black uppercase opacity-40 hover:opacity-100 px-3 py-1 border border-white/20 hover:border-red-500 hover:text-red-500 transition-all">
            Close_Link
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* Cover & Info Sidebar */}
          <div className="w-full lg:w-72 p-6 border-r border-[#00FF00]/10 flex flex-col gap-4 overflow-y-auto hidden lg:flex">
            <img src={series.cover} className="w-full aspect-[2/3] object-cover hacker-border shadow-lg" referrerPolicy="no-referrer" />
            
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[8px] uppercase opacity-40 font-black">GENRE</span>
                <p className="text-[10px] font-bold uppercase">{series.genre || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[8px] uppercase opacity-40 font-black">RATING</span>
                <p className="text-[10px] font-bold text-yellow-500">{series.rating || 'N/A'}</p>
              </div>
              <div className="space-y-2">
                <span className="text-[8px] uppercase opacity-40 font-black">STORY_PATH</span>
                <p className="text-[10px] opacity-70 leading-relaxed text-justify h-32 overflow-y-auto custom-scrollbar pr-2">{series.plot}</p>
              </div>
              <button 
                onClick={() => { copyToClipboard(series.cover); addLog(`POSTER_URL_COPIED: ${series.name.substring(0, 15)}...`); }}
                className="w-full flex items-center justify-center gap-2 p-2 border border-[#00FF00]/20 hover:border-[#00FF00] hover:bg-[#00FF00]/5 transition-all"
              >
                <ImageIcon className="w-3 h-3" />
                <span className="text-[8px] font-black uppercase tracking-tighter">Copy_Poster_URL</span>
              </button>
            </div>
          </div>

          {/* Episode Browser */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-[#00FF00]" />
                <span className="text-[10px] uppercase animate-pulse">DECRYPTING_EPISODES...</span>
              </div>
            ) : info && (
               <>
                 {/* Season Selector */}
                 <div className="flex gap-2 p-4 overflow-x-auto custom-scrollbar border-b border-[#00FF00]/10 bg-black/40">
                    {Object.keys(info.episodes).map(s => (
                       <button 
                         key={s}
                         onClick={() => setActiveSeason(s)}
                         className={`px-4 py-2 text-[10px] font-black uppercase border transition-all whitespace-nowrap ${activeSeason === s ? 'bg-[#00FF00] text-black border-[#00FF00]' : 'border-white/10 hover:border-[#00FF00]/40'}`}
                       >
                         Season {s}
                       </button>
                    ))}
                 </div>
                 
                 {/* Episode List */}
                 <div className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar">
                    <div className="space-y-3">
                      {activeSeason && info.episodes[activeSeason].map(ep => (
                        <div 
                          key={ep.id}
                          className="flex items-center justify-between p-3 lg:p-4 bg-[#00FF00]/5 border border-[#00FF00]/10 hover:border-[#00FF00]/40 group transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-black opacity-20 group-hover:opacity-100 transition-all">#{ep.episode_num}</span>
                            <div className="flex flex-col">
                              <span className="text-[10px] lg:text-xs font-bold uppercase tracking-wide group-hover:text-[#00FF00] transition-all">{ep.title}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] opacity-40 uppercase">EXT: {ep.container_extension}</span>
                                {ep.info?.duration && (
                                  <>
                                    <span className="text-[8px] opacity-20">|</span>
                                    <span className="text-[8px] opacity-40 uppercase flex items-center gap-1">
                                      <Clock className="w-2 h-2" /> {ep.info.duration}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                             <button 
                               onClick={() => copyEpisode(ep)}
                               className="px-4 py-2 bg-[#00FF00]/10 hover:bg-[#00FF00] hover:text-black border border-[#00FF00]/20 transition-all group/btn flex items-center gap-2"
                               title="Copy Episode M3U"
                             >
                               <Copy className="w-3 h-3" />
                               <span className="text-[8px] font-black uppercase">Copy_M3U</span>
                             </button>
                          </div>
                        </div>
                      ))}
                    </div>
                 </div>
               </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const SyncProcessingModal = ({ step, details, name }: { step: string; details: string; name: string }) => (
  <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="w-full max-w-md bg-[#050505] border border-[#00FF00]/40 p-8 flex flex-col items-center text-center shadow-[0_0_100px_rgba(0,255,0,0.1)] hacker-border"
    >
      <div className="relative mb-8">
        <div className="w-24 h-24 border-4 border-[#00FF00]/10 rounded-full" />
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 w-24 h-24 border-4 border-t-[#00FF00] border-r-transparent border-b-transparent border-l-transparent rounded-full shadow-[0_0_20px_rgba(0,255,0,0.4)]"
        />
        <Shield className="absolute inset-0 m-auto w-8 h-8 text-[#00FF00] animate-pulse" />
      </div>

      <div className="space-y-4 w-full">
        <div className="space-y-1">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-[#00FF00] glow-text">Master_Link_Syncing</h2>
          <p className="text-[10px] font-bold opacity-60 uppercase">{name}</p>
        </div>

        <div className="py-4 border-y border-white/5 space-y-2">
          <div className="flex justify-between items-center text-[7px] font-black uppercase tracking-tighter opacity-40">
            <span>Current_Phase</span>
            <span className="text-[#00FF00]">{step}</span>
          </div>
          <div className="text-[9px] font-mono text-[#00FF00]/80 h-8 flex items-center justify-center bg-white/5 px-4 mt-2">
            {details}
          </div>
        </div>

        <div className="flex items-center gap-1 justify-center">
          {[...Array(5)].map((_, i) => (
            <motion.div 
              key={i}
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}
              className="w-1.5 h-1.5 bg-[#00FF00]/80 rounded-full"
            />
          ))}
        </div>
      </div>
    </motion.div>
  </div>
);

const SyncResultsModal = ({ report, onClose, seriesName, addLog }: { report: SyncReport, onClose: () => void, seriesName: string, addLog: (m: string) => void }) => {
  const [copiedAll, setCopiedAll] = useState(false);

  const handleCopyAll = () => {
    copyToClipboard(report.missingM3U);
    setCopiedAll(true);
    addLog(`MASTER_SYNC: ${seriesName} M3U_MANIFEST_COPIED`);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleDownloadM3U = () => {
    const blob = new Blob([report.missingM3U], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${seriesName}_MASTER_SYNC.m3u`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addLog(`MASTER_SYNC: ${seriesName} M3U_DOWNLOAD_STARTED`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-2xl bg-[#090909] border border-[#00FF00]/30 shadow-[0_0_50px_rgba(0,255,0,0.2)] flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-[#00FF00]/20 flex items-center justify-between bg-black/40">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[#00FF00] drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]">Sync_Manifest // {seriesName}</h2>
            <p className="text-[8px] opacity-40 uppercase tracking-widest mt-1">Found on Master: {report.found ? 'TRUE' : 'FALSE'} | Status: {report.found ? (report.missingEpisodes.length > 0 ? 'BEHIND_MASTER' : 'SYNCHRONIZED') : 'NOT_FOUND_ON_MASTER'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 transition-colors">
            <X className="w-5 h-5 text-red-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {report.found ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-3 bg-white/5 border border-white/10 flex flex-col items-center">
                  <span className="text-[7px] opacity-40 uppercase mb-1">Match_Count</span>
                  <span className="text-sm font-black text-[#00FF00]">{report.matchCount}</span>
                </div>
                <div className="p-3 bg-white/5 border border-white/10 flex flex-col items-center">
                  <span className="text-[7px] opacity-40 uppercase mb-1">Master_Total</span>
                  <span className="text-sm font-black">{report.totalMasterEpisodes}</span>
                </div>
                <div className="p-3 bg-white/5 border border-white/10 flex flex-col items-center">
                  <span className="text-[7px] opacity-40 uppercase mb-1">Current_Total</span>
                  <span className="text-sm font-black">{report.totalCurrentEpisodes}</span>
                </div>
                <div className="p-3 bg-white/5 border border-white/10 flex flex-col items-center">
                  <span className="text-[7px] opacity-40 uppercase mb-1">Missing_Items</span>
                  <span className={`text-sm font-black ${report.missingEpisodes.length > 0 ? 'text-red-500' : 'text-[#00FF00]'}`}>
                    {report.missingEpisodes.length}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Database className="w-3 h-3 text-[#00FF00]" />
                  Seasons_Sector_Breakdown
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {report.seasonsReport.map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-black border border-[#00FF00]/10 hover:border-[#00FF00]/40 transition-colors group">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black opacity-40">S{s.season.padStart(2, '0')}</span>
                        <div className={`w-1 h-4 ${s.status === 'match' ? 'bg-[#00FF00]' : s.status === 'missing' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                      </div>
                      <div className="text-right">
                        <div className="text-[8px] font-bold opacity-60">EP: {s.currentCount} / {s.masterCount}</div>
                        <div className={`text-[7px] font-black uppercase ${s.status === 'match' ? 'text-[#00FF00]' : 'text-red-500'}`}>{s.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {report.missingEpisodes.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                      <FileWarning className="w-3 h-3 text-red-500" />
                      Detected_Miss_Packets
                    </h3>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={handleDownloadM3U}
                        className="flex items-center gap-2 px-3 py-1 bg-[#00FF00]/10 border border-[#00FF00]/30 hover:bg-[#00FF00] hover:text-black transition-all text-[8px] font-black"
                      >
                        <Download className="w-3 h-3" />
                        DOWNLOAD_M3U
                      </button>
                      <button 
                        onClick={handleCopyAll}
                        className="flex items-center gap-2 px-3 py-1 bg-[#00FF00]/10 border border-[#00FF00]/30 hover:bg-[#00FF00] hover:text-black transition-all text-[8px] font-black"
                      >
                        <Copy className="w-3 h-3" />
                        {copiedAll ? 'COPIED' : 'COPY_M3U'}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {report.missingEpisodes.map((ep, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-white/5 hover:bg-white/10 border border-white/5 transition-colors group">
                        <div className="flex items-center gap-4">
                          <span className="text-[8px] font-mono opacity-40 group-hover:opacity-100 transition-opacity">S{String(ep.season).padStart(2, '0')} E{String(ep.episode).padStart(2, '0')}</span>
                          <span className="text-[9px] font-black uppercase text-red-500 truncate max-w-[200px] sm:max-w-md">{ep.title}</span>
                        </div>
                        <button 
                          onClick={() => { copyToClipboard(`S${ep.season}E${ep.episode} - ${ep.title}`); addLog('EPISODE_METADATA_COPIED'); }}
                          className="p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-[#00FF00]"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShieldAlert className="w-16 h-16 text-red-600 mb-4 animate-bounce" />
              <h3 className="text-xl font-black uppercase tracking-widest text-red-500 mb-2 underline">NOT FOUND ANY WEB SERIES</h3>
              <p className="text-[10px] opacity-40 uppercase max-w-sm mb-8">The series entity [${seriesName}] was not detected in the master cloud repository. Synchronization is currently impossible.</p>
              
              <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                <button 
                  onClick={handleCopyAll}
                  className="flex flex-col items-center gap-3 p-6 bg-[#00FF00]/5 border border-[#00FF00]/20 hover:border-[#00FF00] hover:bg-[#00FF00]/10 transition-all group"
                >
                  <Copy className="w-8 h-8 text-[#00FF00] group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Copy_Complete_Series</span>
                </button>
                <button 
                  onClick={handleDownloadM3U}
                  className="flex flex-col items-center gap-3 p-6 bg-blue-500/5 border border-blue-500/20 hover:border-blue-500 hover:bg-blue-500/10 transition-all group"
                >
                  <Download className="w-8 h-8 text-blue-500 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Download_Complete_M3U</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-[#00FF00]/20 bg-black/40 flex justify-end">
          <button 
            onClick={onClose}
            className="px-8 py-2 border border-[#00FF00]/40 text-[#00FF00] font-black uppercase tracking-widest text-[10px] hover:bg-[#00FF00] hover:text-black transition-all hover:shadow-[0_0_20px_rgba(0,255,0,0.3)]"
          >
            Acknowledge_Link
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const SidebarBtn = ({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }): React.ReactElement => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-4 px-6 py-4 border-l-2 transition-all relative group ${
      active ? 'border-[#00FF00] bg-[#00FF00]/5 text-[#00FF00]' : 'border-transparent text-[#00FF00]/40 hover:text-[#00FF00]'
    }`}
  >
    <div className={`transition-all duration-300 ${active ? 'scale-110 drop-shadow-[0_0_8px_rgba(0,255,0,0.5)]' : 'group-hover:scale-110'}`}>
      {icon}
    </div>
    <span className="hidden lg:inline text-[11px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

const ContentCard = ({ 
  item, 
  type, 
  xtream, 
  addLog, 
  categories, 
  episodeRegistry,
  setEpisodeRegistry,
  iconRegistry,
  setIconRegistry,
  onOpenSeries, 
  onCheckOnMaster,
  isM3UMode,
  isSelectionMode,
  isSelected,
  onToggleSelection
}: { 
  item: XtreamStream | XtreamSeries, 
  type: 'movie' | 'series', 
  xtream: XtreamService | null, 
  addLog: (m: string) => void, 
  categories: XtreamCategory[], 
  episodeRegistry: Map<number, number>,
  setEpisodeRegistry: React.Dispatch<React.SetStateAction<Map<number, number>>>,
  iconRegistry?: Map<number, string>,
  setIconRegistry?: React.Dispatch<React.SetStateAction<Map<number, string>>>,
  onOpenSeries?: (s: XtreamSeries) => void,
  onCheckOnMaster?: (s: XtreamSeries) => void,
  isM3UMode?: boolean,
  isSelectionMode?: boolean,
  isSelected?: boolean,
  onToggleSelection?: () => void
}): React.ReactElement => {
  const [copied, setCopied] = useState(false);
  const [copiedName, setCopiedName] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showRangeSelector, setShowRangeSelector] = useState(false);
  const [availableEpisodes, setAvailableEpisodes] = useState<XtreamEpisode[]>([]);
  const [startRange, setStartRange] = useState(1);
  const [endRange, setEndRange] = useState(1);
  
  const name = item.name;
  const movie = item as any;
  const initialIcon = movie.stream_icon || movie.movie_image || movie.icon || movie.cover || (type === 'series' ? (item as XtreamSeries).cover : '');
  const [icon, setIcon] = useState(initialIcon);
  const id = 'stream_id' in item ? item.stream_id : item.series_id;
  const numId = Number(id);

  // Sync with registry on mount
  useEffect(() => {
    const cached = iconRegistry?.get(numId);
    if (cached && cached !== icon) {
      setIcon(cached);
    }
  }, [numId, iconRegistry]);

  const extension = 'container_extension' in item ? item.container_extension : 'mp4';
  const categoryName = categories.find(c => c.category_id === item.category_id)?.category_name || 'UNKNOWN_SECTOR';

  const streamUrl = isM3UMode ? (item as any).direct_source : (xtream ? xtream.generateM3ULink(id, extension, type) : '');

  const [episodeCount, setEpisodeCount] = useState<number | null>(null);
  const [movieDuration, setMovieDuration] = useState<string | null>(null);

  useEffect(() => {
    setIcon(initialIcon);
  }, [initialIcon]);

  const duration = useMemo(() => {
    if (type === 'series') {
      const series = item as any;
      const count = episodeCount || series.total_episodes || series.episodes_count || series.episode_count || series.num_episodes || series.total_eps;
      if (count) return `${count} EPISODES`;
      return null;
    }
    
    // Movie Runtime Logic
    const movie = item as any;
    const durRaw = movieDuration || movie.duration || movie.info?.duration || movie.duration_secs || movie.run_time || movie.runtime;
    
    if (!durRaw) return null;
    
    // Check if it's a number (seconds/minutes)
    const num = Number(durRaw);
    if (!isNaN(num) && num > 0) {
      if (num > 500) { // Likely seconds
        const h = Math.floor(num / 3600);
        const m = Math.floor((num % 3600) / 60);
        return h > 0 ? `${h}H ${m}M` : `${m}M`;
      } else { // Likely minutes
        const h = Math.floor(num / 60);
        const m = num % 60;
        return h > 0 ? `${h}H ${m}M` : `${m}M`;
      }
    }
    
    const strDur = String(durRaw).toUpperCase();
    if (strDur === '0' || strDur === '00:00:00' || strDur === 'NULL') return null;
    return strDur;
  }, [item, type, episodeCount, movieDuration]);

  useEffect(() => {
    if (xtream && !isM3UMode) {
      if (type === 'series' && !episodeCount) {
        const series = item as any;
        const sid = Number(series.series_id);
        const existingCount = series.total_episodes || series.episodes_count || series.episode_count || series.num_episodes || series.total_eps;
        
        if (existingCount) {
          setEpisodeCount(Number(existingCount));
          setEpisodeRegistry(prev => new Map(prev).set(sid, Number(existingCount)));
        } else {
          xtream.getSeriesInfo(sid).then(info => {
            const count = Object.values(info.episodes).flat().length;
            setEpisodeCount(count);
            setEpisodeRegistry(prev => new Map(prev).set(sid, count));
          }).catch(() => {});
        }
      } else if (type === 'movie') {
        const movieObj = item as any;
        const needsDuration = !movieDuration && (!movieObj.duration || movieObj.duration === '0' || movieObj.duration === '00:00:00');
        const needsIcon = !icon || icon === '';

        if (needsDuration || needsIcon) {
          const streamId = Number((item as XtreamStream).stream_id);
          if (!isNaN(streamId)) {
            xtream.getVodInfo(streamId).then(info => {
              // Priority for icon
              const fetchedIcon = info.movie_data?.movie_image || info.info?.movie_image || info.movie_data?.stream_icon || info.info?.stream_icon;
              if (fetchedIcon && !icon) {
                setIcon(fetchedIcon);
                setIconRegistry?.(prev => new Map(prev).set(numId, fetchedIcon));
              }

              // Priority for duration
              const fetchedDur = info.movie_data?.duration || info.info?.duration || info.duration;
              if (fetchedDur && needsDuration) setMovieDuration(fetchedDur);
            }).catch(() => {});
          }
        }
      }
    }
  }, [type, item, xtream, isM3UMode, episodeCount, movieDuration, icon]);

  const handleCopyPoster = () => {
    if (icon) {
      copyToClipboard(icon);
      addLog(`POSTER_URL_COPIED: ${name.substring(0, 15)}...`);
    }
  };

  const handleViewM3U = async () => {
    if (type === 'series' && !showRangeSelector) {
      const series = item as any;
      if (series.localEpisodes) {
        // Raw M3U grouped mode
        setAvailableEpisodes(series.localEpisodes);
        setStartRange(1);
        setEndRange(series.localEpisodes.length);
        setShowRangeSelector(true);
        return;
      } else if (!isM3UMode && xtream) {
        // Xtream Mode
        addLog(`PREPARING_RANGE_SELECTOR: [${name}]...`);
        try {
          setExporting(true);
          const info = await xtream.getSeriesInfo((item as XtreamSeries).series_id);
          const allEpisodes = Object.values(info.episodes).flat().sort((a, b) => {
            if (a.season !== b.season) return a.season - b.season;
            return a.episode_num - b.episode_num;
          });
          setAvailableEpisodes(allEpisodes);
          setStartRange(1);
          setEndRange(allEpisodes.length);
          setShowRangeSelector(true);
        } catch (e) {
          addLog(`ERR: EPISODE_FETCH_FAILED [${name}]`);
        } finally {
          setExporting(false);
        }
        return;
      }
    }

    let m3u = "";
    if (type === 'series' && !isM3UMode) {
      m3u = `#EXTM3U\r\n#EXTINF:-1 tvg-id="" tvg-name="${name}" tvg-logo="${icon}" group-title="${categoryName}",${name}\r\n${streamUrl}\r\n`;
    } else {
      m3u = `#EXTM3U\r\n#EXTINF:-1 tvg-id="" tvg-name="${name}" tvg-logo="${icon}" group-title="${categoryName}",${name}\r\n${streamUrl}\r\n`;
      addLog(`VIEW_INITIATED: ${name.substring(0, 15)}...`);
    }

    if (m3u) openM3UTextInTab(m3u, name);
  };

  const handleRangeExport = (mode: 'all' | 'range') => {
    let episodesToExport = availableEpisodes;
    if (mode === 'range') {
      episodesToExport = availableEpisodes.slice(startRange - 1, endRange);
    }
    
    let m3uContent = "";
    if (isM3UMode) {
      m3uContent = "#EXTM3U\r\n";
      episodesToExport.forEach(ep => {
        const url = (ep as any).raw_url || streamUrl;
        const seasonPrefix = ep.season < 10 ? `S0${ep.season}` : `S${ep.season}`;
        const episodePrefix = ep.episode_num < 10 ? `E0${ep.episode_num}` : `E${ep.episode_num}`;
        const epName = `${name} ${seasonPrefix}${episodePrefix}`;
        m3uContent += `#EXTINF:-1 tvg-id="" tvg-name="${epName}" tvg-logo="${icon}" group-title="${name}",${epName}\r\n${url}\r\n`;
      });
    } else if (xtream) {
      m3uContent = xtream.generateSeriesM3U(name, icon, episodesToExport);
    }
    
    if (!m3uContent) return;
    
    addLog(`DUMP_COMPLETE: ${mode === 'all' ? 'ALL' : 'RANGE'} EXPORTED [${episodesToExport.length} EPs]`);
    openM3UTextInTab(m3uContent, `${name} (${mode === 'all' ? 'ALL' : `EP ${startRange}-${endRange}`})`);
    setShowRangeSelector(false);
  };

  const handleCopyName = () => {
    copyToClipboard(name);
    setCopiedName(true);
    addLog(`TITLE_COPIED: ${name}`);
    setTimeout(() => setCopiedName(false), 2000);
  };

  const handleCopy = async () => {
    if (type === 'series' && !isM3UMode) {
      try {
        setExporting(true);
        addLog(`EXTRACTING EPISODES: ${name.substring(0, 15)}...`);
        if (!xtream) return;
        const info = await xtream.getSeriesInfo((item as XtreamSeries).series_id);
        const allEpisodes = Object.values(info.episodes).flat();
        const m3u = xtream.generateSeriesM3U(name, icon, allEpisodes);
        copyToClipboard(m3u);
        setCopied(true);
        addLog(`DUMP_COMPLETE: ALL_EPISODES [${name}] COPIED.`);
      } catch (e) {
        addLog(`ERR: EXTRACTION_FAILED [${name}]`);
      } finally {
        setExporting(false);
        setTimeout(() => setCopied(false), 2000);
      }
    } else {
      copyToClipboard(streamUrl);
      setCopied(true);
      addLog(`PACKET_COPIED: ${name.substring(0, 15)}...`);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async () => {
    if (type === 'series' && !isM3UMode) {
      try {
        setExporting(true);
        addLog(`EXTRACTING EPISODES: ${name.substring(0, 15)}...`);
        if (!xtream) return;
        const info = await xtream.getSeriesInfo((item as XtreamSeries).series_id);
        const allEpisodes = Object.values(info.episodes).flat();
        const m3u = xtream.generateSeriesM3U(name, icon, allEpisodes).replace(/https:\/\//g, 'http://');
        
        const blob = new Blob([m3u], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name.replace(/\s+/g, '_')}_all_episodes.m3u`;
        a.click();
        URL.revokeObjectURL(url);
        addLog(`DUMP_COMPLETE: ALL_EPISODES [${name}] DOWNLOADED.`);
      } catch (e) {
        addLog(`ERR: EXTRACTION_FAILED [${name}]`);
      } finally {
        setExporting(false);
      }
    } else {
      const m3u = `#EXTM3U\r\n#EXTINF:-1 tvg-id="" tvg-name="${name}" tvg-logo="${icon}" group-title="${categoryName}",${name}\r\n${streamUrl.replace(/https:\/\//g, 'http://')}\r\n`;
      const blob = new Blob([m3u], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_')}.m3u`;
      a.click();
      URL.revokeObjectURL(url);
      addLog(`DUMP_INITIATED: ${name.substring(0, 15)}...`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => isSelectionMode && onToggleSelection?.()}
      className={`hacker-border aspect-[2/3] group relative overflow-hidden flex flex-col cursor-pointer transition-all ${
        isSelected ? 'border-[#00FF00] scale-95 shadow-[0_0_20px_rgba(0,255,0,0.3)] bg-[#00FF00]/10' : 'bg-gray-900'
      }`}
    >
      {isSelectionMode && (
        <div className="absolute top-2 right-2 z-50">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
            isSelected ? 'bg-[#00FF00] border-[#00FF00]' : 'bg-black/50 border-white/40'
          }`}>
            {isSelected && <Zap className="w-3 h-3 text-black" />}
          </div>
        </div>
      )}
      <div className={`absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all z-10 ${isSelected ? 'bg-black/40' : ''}`} />
      
      {icon ? (
        <img src={icon} alt={name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center opacity-20">
          <Database className="w-12 h-12 mb-2" />
          <span className="text-[8px] uppercase">NO_VISUAL_CORE</span>
        </div>
      )}

      {/* Persistent Title Overlay - Always Visible */}
      <div className="absolute inset-x-0 bottom-0 pt-10 pb-3 px-2 sm:px-3 bg-gradient-to-t from-black via-black/80 to-transparent z-20 pointer-events-none group-hover:opacity-0 transition-opacity duration-300">
        <div className="relative">
          <div className="absolute -left-1 top-0 bottom-0 w-[2.5px] bg-[#00FF00] shadow-[0_0_10px_rgba(0,255,0,0.5)]" />
          <h4 className="text-[9px] sm:text-[11px] font-black uppercase line-clamp-2 leading-tight tracking-[0.05em] pl-2 text-[#00FF00] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {name}
          </h4>
        </div>
      </div>

      {/* Hover Overlay */}
      <div className="absolute inset-x-0 bottom-0 p-2 sm:p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-20 bg-black/95 border-t border-[#00FF00]/40 backdrop-blur-md overflow-y-auto max-h-[85%]">
        {showRangeSelector ? (
          <div className="space-y-2 py-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black italic glow-text">RANGE_SELECT</span>
              <button onClick={() => setShowRangeSelector(false)} className="text-[#00FF00]/60 hover:text-[#00FF00]">
                <Skull className="w-3 h-3 rotate-45" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-1.5">
              <div className="space-y-1">
                <label className="text-[5px] uppercase opacity-50 block">Start</label>
                <input 
                  type="number" 
                  value={startRange}
                  onChange={(e) => setStartRange(Number(e.target.value))}
                  className="w-full bg-black border border-[#00FF00]/30 text-[#00FF00] text-[9px] p-1 focus:border-[#00FF00] outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[5px] uppercase opacity-50 block">End</label>
                <input 
                  type="number" 
                  value={endRange}
                  onChange={(e) => setEndRange(Number(e.target.value))}
                  className="w-full bg-black border border-[#00FF00]/30 text-[#00FF00] text-[9px] p-1 focus:border-[#00FF00] outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1 pt-1">
              <button 
                onClick={() => handleRangeExport('all')}
                className="flex items-center justify-center gap-2 p-1.5 bg-[#00FF00]/10 hover:bg-[#00FF00] hover:text-black border border-[#00FF00]/20 transition-all font-black text-[7.5px]"
              >
                OPEN_ALL
              </button>
              <button 
                onClick={() => handleRangeExport('range')}
                className="flex items-center justify-center gap-2 p-1.5 bg-[#00FF00] text-black hover:bg-[#00FF00]/80 transition-all font-black text-[7.5px]"
              >
                EXTRACT_{startRange}-{endRange}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button 
              onClick={handleCopyName}
              className="col-span-2 flex items-center justify-center gap-2 py-1.5 px-1 bg-[#00FF00]/20 hover:bg-[#00FF00] hover:text-black transition-all mb-0.5 border border-[#00FF00]/30"
            >
              <Type className="w-2.5 h-2.5" />
              <span className="text-[7.5px] font-black tracking-widest uppercase">{copiedName ? 'NAME_COPIED' : 'COPY_TITLE_NAME'}</span>
            </button>

            {type === 'series' && !isM3UMode && (
              <>
                <button 
                  onClick={() => onOpenSeries?.(item as XtreamSeries)}
                  className="col-span-2 flex items-center justify-center gap-2 py-1.5 px-1 bg-[#00FF00]/10 hover:bg-[#00FF00] hover:text-black transition-all mb-0.5 shadow-[0_0_10px_rgba(0,255,0,0.05)] text-[7.5px] font-bold tracking-widest uppercase"
                >
                  <Monitor className="w-2.5 h-2.5" />
                  OPEN_SERIES
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onCheckOnMaster?.(item as XtreamSeries); }}
                  className="col-span-2 flex items-center justify-center gap-2 py-1.5 px-1 bg-blue-500/10 hover:bg-blue-500 hover:text-white border border-blue-500/30 transition-all text-[7.5px] font-black tracking-widest uppercase"
                >
                  <ShieldCheck className="w-2.5 h-2.5" />
                  CHECK_ON_MASTER
                </button>
              </>
            )}
            <button 
              onClick={handleCopy}
              disabled={exporting}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 bg-[#00FF00]/10 hover:bg-[#00FF00] hover:text-black transition-all disabled:opacity-50 ${type === 'movie' ? 'col-span-2 py-2.5' : ''}`}
            >
              {exporting ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : (copied ? <RefreshCcw className="w-2.5 h-2.5 animate-spin" /> : <Copy className="w-2.5 h-2.5" />)}
              <span className="text-[7px] font-bold uppercase">{exporting ? 'SYNC...' : (copied ? 'COPIED' : 'COPY')}</span>
            </button>
            
            {type === 'series' && (
              <>
                <button 
                  onClick={handleDownload}
                  disabled={exporting}
                  className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 bg-[#00FF00]/10 hover:bg-[#00FF00] hover:text-black transition-all disabled:opacity-50"
                >
                  {exporting ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Download className="w-2.5 h-2.5" />}
                  <span className="text-[7px] font-bold uppercase">{exporting ? 'SYNC...' : 'DUMP'}</span>
                </button>
                <button 
                  onClick={handleViewM3U}
                  disabled={exporting}
                  className="col-span-2 flex items-center justify-center gap-1.5 py-1.5 px-1 mt-0.5 border border-[#00FF00]/40 hover:bg-[#00FF00] hover:text-black transition-all disabled:opacity-50"
                >
                  {exporting ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <ExternalLink className="w-2.5 h-2.5" />}
                  <span className="text-[7.5px] font-black tracking-widest uppercase truncate">EXTRACT_EPISODES</span>
                </button>
              </>
            )}

            <button 
              onClick={handleCopyPoster}
              className="col-span-2 flex items-center justify-center gap-1 py-1 border border-dashed border-[#00FF00]/20 hover:border-[#00FF00] hover:bg-[#00FF00]/5 transition-all text-[6.5px]"
            >
              <ImageIcon className="w-2 h-2" />
              <span className="font-black tracking-widest uppercase truncate">Copy_Poster_URL</span>
            </button>
          </div>
        )}
      </div>
      
      {/* Corner Badges */}
      <div className="absolute top-2 left-2 z-20 flex flex-col gap-1 items-start group-hover:opacity-0 transition-opacity duration-300">
         <div className="text-[6px] px-1 py-0.5 border border-white/20 text-white/60 font-black uppercase bg-black/80 max-w-[80px] truncate shadow-sm">
           {categoryName}
         </div>
         {duration && (
           <div className="text-[6px] px-1 py-0.5 border border-[#00FF00]/40 text-[#00FF00] font-bold uppercase bg-black/95 flex items-center gap-1 shadow-[0_0_5px_rgba(0,255,0,0.2)]">
             {type === 'series' ? <Layers className="w-2 h-2" /> : <Clock className="w-2 h-2" />}
             {duration}
           </div>
         )}
      </div>
    </motion.div>
  );
};
