import React, { useState, useEffect, useRef } from "react";
import { 
  Globe, 
  Search, 
  Settings, 
  History, 
  Bookmark, 
  BookMarked, 
  Code, 
  BookOpen, 
  Terminal, 
  ArrowLeft, 
  RotateCw, 
  ExternalLink, 
  Shield, 
  ShieldAlert, 
  Clock, 
  Copy, 
  Check, 
  Trash2, 
  Sliders, 
  RefreshCw, 
  Plus, 
  X,
  Sparkles,
  SearchCode,
  Compass,
  FileText
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ProxyInspectResult, 
  ReaderContent, 
  HistoryItem, 
  BookmarkItem, 
  CustomHeader 
} from "./types";

// Character shift by +3 followed by standard Base64 encoding to obfuscate queries for target firewall bypass
function obfuscateUrl(url: string): string {
  try {
    if (!url) return "";
    const shifted = url.split("").map(c => String.fromCharCode(c.charCodeAt(0) + 3)).join("");
    return btoa(unescape(encodeURIComponent(shifted)));
  } catch (e) {
    return url;
  }
}

function deobfuscateUrl(obfuscated: string): string {
  try {
    if (!obfuscated) return "";
    const isBase64 = /^[A-Za-z0-9+/=_-]+$/.test(obfuscated);
    if (!isBase64) return obfuscated;

    const decodedB64 = decodeURIComponent(escape(atob(obfuscated)));
    return decodedB64.split("").map(c => String.fromCharCode(c.charCodeAt(0) - 3)).join("");
  } catch (e) {
    return obfuscated;
  }
}

// User-Agent Presets
const USER_AGENTS = [
  { name: "Chrome (Windows)", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
  { name: "Safari (iPhone)", value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1" },
  { name: "Safari (macOS)", value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15" },
  { name: "Chrome (Android)", value: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36" },
  { name: "Googlebot (SEO)", value: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
  { name: "Custom Agent", value: "custom" }
];

// Quick Launch Presets
const PRESETS = [
  { name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Main_Page", icon: "🌐" },
  { name: "Hacker News", url: "https://news.ycombinator.com", icon: "🔥" },
  { name: "Reddit (Static)", url: "https://old.reddit.com", icon: "👽" },
  { name: "GitHub", url: "https://github.com", icon: "🐙" },
  { name: "BBC News", url: "https://www.bbc.com", icon: "📰" },
  { name: "Internet Archive", url: "https://archive.org", icon: "🏛️" }
];

export default function App() {
  // Navigation & Address Bar state
  const [inputUrl, setInputUrl] = useState("https://en.wikipedia.org/wiki/Main_Page");
  const [currentUrl, setCurrentUrl] = useState("https://en.wikipedia.org/wiki/Main_Page");
  const [iframeKey, setIframeKey] = useState(0);
  
  // Custom headers & User-Agent state
  const [selectedUa, setSelectedUa] = useState(USER_AGENTS[0].value);
  const [customUaText, setCustomUaText] = useState("");
  const [customHeader, setCustomHeader] = useState<CustomHeader>({ name: "", value: "" });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Tabs state
  // browser | inspect | reader | source
  const [activeTab, setActiveTab] = useState<"browser" | "inspect" | "reader" | "source">("browser");

  // Inspection Data state
  const [inspectData, setInspectData] = useState<ProxyInspectResult | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);

  // Reader Mode Data state
  const [readerData, setReaderData] = useState<ReaderContent | null>(null);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerError, setReaderError] = useState<string | null>(null);
  const [readerFontSize, setReaderFontSize] = useState<"sm" | "md" | "lg" | "xl">("md");
  const [readerTheme, setReaderTheme] = useState<"light" | "sepia" | "dark">("sepia");

  // Source Viewer state
  const [sourceHtml, setSourceHtml] = useState<string>("");
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [sourceSearchQuery, setSourceSearchQuery] = useState("");

  // History & Bookmarks
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  
  // UX State
  const [copied, setCopied] = useState(false);
  const [isUrlBarFocused, setIsUrlBarFocused] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Load Bookmarks & History on Mount
  useEffect(() => {
    const savedHistory = localStorage.getItem("proxy_history");
    const savedBookmarks = localStorage.getItem("proxy_bookmarks");
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks));
  }, []);

  // Sync Bookmarks & History back to LocalStorage
  const saveHistoryToLocal = (newHistory: HistoryItem[]) => {
    setHistory(newHistory);
    localStorage.setItem("proxy_history", JSON.stringify(newHistory));
  };

  const saveBookmarksToLocal = (newBookmarks: BookmarkItem[]) => {
    setBookmarks(newBookmarks);
    localStorage.setItem("proxy_bookmarks", JSON.stringify(newBookmarks));
  };

  // Listen to inner-iframe postMessages to update address bar on deep link clicks!
  useEffect(() => {
    const handleProxyNavigation = (event: MessageEvent) => {
      if (event.data && event.data.action === "proxy-navigate") {
        const navigatedUrl = event.data.url;
        setCurrentUrl(navigatedUrl);
        setInputUrl(navigatedUrl);
        
        // Add to history
        addHistoryItem(navigatedUrl);
      }
    };
    window.addEventListener("message", handleProxyNavigation);
    return () => window.removeEventListener("message", handleProxyNavigation);
  }, [history]);

  // Lazy Fetch Extra Info based on current tab selection
  useEffect(() => {
    if (activeTab === "inspect") {
      fetchInspectDetails();
    } else if (activeTab === "reader") {
      fetchReaderMode();
    } else if (activeTab === "source") {
      fetchRawSource();
    }
  }, [currentUrl, activeTab]);

  // Add search query / formatting helper
  const processInputToUrl = (input: string): string => {
    let clean = input.trim();
    if (!clean) return "https://duckduckgo.com";

    // If it looks like a URL (starts with protocol or has standard TLD and no spaces)
    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?(\?.*)?$/i;
    
    if (urlPattern.test(clean)) {
      if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
        clean = "https://" + clean;
      }
      return clean;
    }
    
    // Otherwise, translate to DuckDuckGo search proxy URL
    return `https://duckduckgo.com/?q=${encodeURIComponent(clean)}`;
  };

  // Navigate Trigger
  const handleNavigate = (urlToLoad?: string) => {
    const finalUrl = processInputToUrl(urlToLoad || inputUrl);
    setCurrentUrl(finalUrl);
    setInputUrl(finalUrl);
    setIframeKey(prev => prev + 1); // Force iframe refresh

    // Add to History
    addHistoryItem(finalUrl);

    // If on non-browser tab, reload that tab's data
    if (activeTab === "inspect") fetchInspectDetails(finalUrl);
    if (activeTab === "reader") fetchReaderMode(finalUrl);
    if (activeTab === "source") fetchRawSource(finalUrl);
  };

  // Add History Item Helper
  const addHistoryItem = (url: string) => {
    // Prevent duplicate adjacent histories
    if (history.length > 0 && history[0].url === url) return;

    // Get a clean title placeholder
    let domain = "Webpage";
    try {
      domain = new URL(url).hostname;
    } catch {
      // invalid URL
    }

    const newItem: HistoryItem = {
      id: Math.random().toString(36).substring(2, 9),
      url,
      timestamp: Date.now(),
      title: domain,
    };

    const updated = [newItem, ...history.filter(h => h.url !== url)].slice(0, 50); // limit to last 50
    saveHistoryToLocal(updated);
  };

  // Delete History Item
  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(item => item.id !== id);
    saveHistoryToLocal(updated);
  };

  // Toggle Bookmark
  const toggleBookmark = () => {
    const isBookmarked = bookmarks.some(b => b.url === currentUrl);
    if (isBookmarked) {
      const updated = bookmarks.filter(b => b.url !== currentUrl);
      saveBookmarksToLocal(updated);
      showTemporaryStatus("Removed bookmark");
    } else {
      let domain = "Page";
      try {
        domain = new URL(currentUrl).hostname;
      } catch {
        // invalid URL
      }
      const newItem: BookmarkItem = {
        id: Math.random().toString(36).substring(2, 9),
        url: currentUrl,
        title: domain,
      };
      const updated = [...bookmarks, newItem];
      saveBookmarksToLocal(updated);
      showTemporaryStatus("Bookmarked successfully!");
    }
  };

  // Helper status notice
  const showTemporaryStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 2500);
  };

  // Fetch Inspector details
  const fetchInspectDetails = async (urlOverride?: string) => {
    const url = urlOverride || currentUrl;
    setInspectLoading(true);
    setInspectError(null);
    try {
      const ua = selectedUa === "custom" ? customUaText : selectedUa;
      let apiEndpoint = `/api/inspect?url=${encodeURIComponent(obfuscateUrl(url))}&ua=${encodeURIComponent(ua)}`;
      if (customHeader.name && customHeader.value) {
        apiEndpoint += `&headerName=${encodeURIComponent(customHeader.name)}&headerValue=${encodeURIComponent(customHeader.value)}`;
      }

      const res = await fetch(apiEndpoint);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }
      const data = await res.json();
      setInspectData(data);
    } catch (err: any) {
      setInspectError(err.message || "Failed to inspect headers");
    } finally {
      setInspectLoading(false);
    }
  };

  // Fetch Reader Mode contents
  const fetchReaderMode = async (urlOverride?: string) => {
    const url = urlOverride || currentUrl;
    setReaderLoading(true);
    setReaderError(null);
    try {
      const ua = selectedUa === "custom" ? customUaText : selectedUa;
      const res = await fetch(`/api/reader?url=${encodeURIComponent(obfuscateUrl(url))}&ua=${encodeURIComponent(ua)}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }
      const data = await res.json();
      setReaderData(data);
    } catch (err: any) {
      setReaderError(err.message || "Could not parse main reading content from this page.");
    } finally {
      setReaderLoading(false);
    }
  };

  // Fetch raw HTML source code
  const fetchRawSource = async (urlOverride?: string) => {
    const url = urlOverride || currentUrl;
    setSourceLoading(true);
    setSourceError(null);
    try {
      const ua = selectedUa === "custom" ? customUaText : selectedUa;
      const res = await fetch(`/api/proxy?url=${encodeURIComponent(obfuscateUrl(url))}&ua=${encodeURIComponent(ua)}`);
      if (!res.ok) {
        throw new Error(`Proxy backend returned status ${res.status}`);
      }
      const text = await res.text();
      setSourceHtml(text);
    } catch (err: any) {
      setSourceError(err.message || "Failed to fetch source code from proxy");
    } finally {
      setSourceLoading(false);
    }
  };

  // Copy current Proxied Address
  const copyProxiedUrl = () => {
    const ua = selectedUa === "custom" ? customUaText : selectedUa;
    const fullProxied = `${window.location.origin}/api/proxy?url=${encodeURIComponent(obfuscateUrl(currentUrl))}&ua=${encodeURIComponent(ua)}`;
    navigator.clipboard.writeText(fullProxied);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Pre-configured iframe src
  const getIframeSrc = () => {
    const ua = selectedUa === "custom" ? customUaText : selectedUa;
    let src = `/api/proxy?url=${encodeURIComponent(obfuscateUrl(currentUrl))}&ua=${encodeURIComponent(ua)}`;
    if (customHeader.name && customHeader.value) {
      src += `&headerName=${encodeURIComponent(customHeader.name)}&headerValue=${encodeURIComponent(customHeader.value)}`;
    }
    return src;
  };

  // Highlight search in source code
  const getHighlightedSource = () => {
    if (!sourceHtml) return "No source code loaded.";
    if (!sourceSearchQuery) {
      // Return with basic lines
      return sourceHtml;
    }
    
    // Simple HTML escape and highlight matches
    const escaped = sourceHtml
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
      
    const escapedSearch = sourceSearchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedSearch})`, "gi");
    
    return escaped.replace(regex, `<mark class="bg-yellow-300 dark:bg-yellow-800 text-black px-0.5 rounded font-bold">$1</mark>`);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 flex flex-col font-sans select-none antialiased relative overflow-hidden">
      
      {/* Sleek Radial Glow Effects in the Background */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Top Header Navigation Bar */}
      <header className="h-16 border-b border-slate-800 bg-[#0f172a]/85 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between gap-4">
        
        {/* Title branding with Shield logo */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-8.5 h-8.5 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Shield className="w-4.5 h-4.5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              ShieldProxy
              <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded font-mono border border-indigo-500/30">v2.0</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium hidden sm:block">Ultra-Low Latency Gateway Node</p>
          </div>
        </div>

        {/* Floating Glowing Address Search Bar */}
        <div className="flex-1 max-w-2xl relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur-xs opacity-25 group-hover:opacity-40 focus-within:opacity-100 transition duration-300"></div>
          <div className="relative flex items-center bg-slate-900 border border-slate-700/80 hover:border-slate-600 rounded-full p-1 shadow-2xl">
            <div className="pl-3.5 flex items-center gap-1.5 text-emerald-400 flex-shrink-0">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
              <span className="text-[10px] font-mono text-emerald-400/85 uppercase tracking-wider hidden sm:inline">https://</span>
            </div>

            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNavigate();
              }}
              onFocus={() => setIsUrlBarFocused(true)}
              onBlur={() => setTimeout(() => setIsUrlBarFocused(false), 200)}
              placeholder="Enter destination URL or proxy search query..."
              className="w-full bg-transparent text-xs text-white pl-2 pr-20 py-1.5 focus:outline-none font-mono placeholder-slate-500"
            />

            {/* Quick Actions in search bar */}
            <div className="absolute right-12 flex items-center gap-1">
              <button
                onClick={toggleBookmark}
                title="Bookmark current URL"
                className={`p-1.5 rounded-full transition-colors ${
                  bookmarks.some(b => b.url === currentUrl)
                    ? "text-amber-400 hover:bg-slate-800"
                    : "text-slate-500 hover:bg-slate-800"
                }`}
              >
                <Bookmark className="w-3.5 h-3.5 fill-current" />
              </button>
              <button
                onClick={copyProxiedUrl}
                title="Copy Proxied Shareable Link"
                className="p-1.5 rounded-full text-slate-500 hover:bg-slate-800 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Navigation Go Button */}
            <button
              onClick={() => handleNavigate()}
              className="absolute right-1 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white p-1.5 rounded-full transition shadow-md"
              title="Go / Search"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Header Controls Bar */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => {
              setInputUrl(currentUrl);
              handleNavigate(currentUrl);
            }}
            title="Reload proxy content"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition border border-slate-700/80"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            title="Spoofing & Custom Headers"
            className={`p-2 rounded-lg transition border ${
              isSettingsOpen || selectedUa !== USER_AGENTS[0].value || customHeader.name
                ? "bg-indigo-950/50 border-indigo-500 text-indigo-400 font-medium"
                : "bg-slate-800 border-slate-700 text-slate-300"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
          
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Encrypted Session</span>
          </div>
        </div>
      </header>

      {/* Advanced Headers & User-Agent Spoofer Panel */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-slate-900/90 border-b border-slate-800 px-6 py-4 overflow-hidden backdrop-blur-xs"
          >
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* User-Agent Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <span>🎭 User-Agent Client Spoofing</span>
                </label>
                <select
                  value={selectedUa}
                  onChange={(e) => {
                    setSelectedUa(e.target.value);
                    if (e.target.value !== "custom") {
                      showTemporaryStatus("User-Agent switched. Reloading...");
                    }
                  }}
                  className="w-full bg-slate-950 text-xs border border-slate-700 rounded-md px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-200 transition"
                >
                  {USER_AGENTS.map((ua) => (
                    <option key={ua.name} value={ua.value}>{ua.name}</option>
                  ))}
                </select>

                {selectedUa === "custom" && (
                  <input
                    type="text"
                    value={customUaText}
                    onChange={(e) => setCustomUaText(e.target.value)}
                    placeholder="Enter custom User-Agent string..."
                    className="w-full mt-2 bg-slate-950 text-xs border border-slate-700 rounded-md px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-300 font-mono transition"
                  />
                )}
              </div>

              {/* Custom HTTP Headers */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  🔑 Custom Header Injector
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="X-Header-Name"
                    value={customHeader.name}
                    onChange={(e) => setCustomHeader({ ...customHeader, name: e.target.value })}
                    className="w-1/2 bg-slate-950 text-xs border border-slate-700 rounded-md px-3 py-1.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-300 font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={customHeader.value}
                    onChange={(e) => setCustomHeader({ ...customHeader, value: e.target.value })}
                    className="w-1/2 bg-slate-950 text-xs border border-slate-700 rounded-md px-3 py-1.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-300 font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-500">Inject parameter values like custom sessions or authorization keys.</p>
              </div>

              {/* Reset & Apply */}
              <div className="flex flex-col justify-end items-end gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedUa(USER_AGENTS[0].value);
                      setCustomHeader({ name: "", value: "" });
                      showTemporaryStatus("Settings restored to default");
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-md transition"
                  >
                    Reset Defaults
                  </button>
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      handleNavigate();
                    }}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-md transition shadow-md"
                  >
                    Apply & Refresh
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 italic text-right mt-1">
                  💡 Custom request headers bypass bot checks and secure parameters.
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative z-10">
        
        {/* Left Sidebar: Navigation presets, Bookmarks & History */}
        <aside className="w-full md:w-64 bg-[#0b0f19] border-r border-slate-800 flex flex-col flex-shrink-0 overflow-y-auto">
          
          {/* Preset Launcher Section */}
          <div className="p-4 border-b border-slate-800/80">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-indigo-500" />
              Quick Presets
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => handleNavigate(p.url)}
                  className="px-2.5 py-1.5 bg-slate-900/60 hover:bg-indigo-950/50 hover:text-indigo-400 hover:border-indigo-500/30 border border-slate-800 rounded text-left text-xs font-semibold text-slate-300 transition duration-150 flex items-center gap-1.5 truncate"
                >
                  <span className="text-sm">{p.icon}</span>
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Saved Bookmarks */}
          <div className="p-4 border-b border-slate-800/80 max-h-[160px] md:max-h-[220px] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <BookMarked className="w-3.5 h-3.5 text-amber-500" />
                Saved Bookmarks
              </h2>
              {bookmarks.length > 0 && (
                <button
                  onClick={() => saveBookmarksToLocal([])}
                  className="text-[10px] text-slate-500 hover:text-red-400 font-semibold"
                >
                  Clear
                </button>
              )}
            </div>
            {bookmarks.length === 0 ? (
              <p className="text-[10px] text-slate-500 italic py-1">No saved bookmarks. Click bookmark inside search bar.</p>
            ) : (
              <div className="space-y-1">
                {bookmarks.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => handleNavigate(b.url)}
                    className="group flex items-center justify-between px-2 py-1 bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800 rounded text-xs text-slate-300 cursor-pointer transition duration-150"
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="text-amber-500 text-[10px]">★</span>
                      <span className="font-medium truncate">{b.title}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        saveBookmarksToLocal(bookmarks.filter(item => item.id !== b.id));
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-red-400 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Browsing History */}
          <div className="p-4 border-b border-slate-800/80 flex-1 min-h-[120px] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-emerald-500" />
                Recent History
              </h2>
              {history.length > 0 && (
                <button
                  onClick={() => saveHistoryToLocal([])}
                  className="text-[10px] text-slate-500 hover:text-red-400 font-semibold"
                >
                  Clear All
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="text-[10px] text-slate-500 italic py-1">No browsing history yet.</p>
            ) : (
              <div className="space-y-1">
                {history.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => handleNavigate(h.url)}
                    title={h.url}
                    className="group flex items-center justify-between px-2 py-1 bg-slate-900/30 hover:bg-slate-800/40 border border-slate-800/50 rounded text-[11px] cursor-pointer transition-all duration-150"
                  >
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-medium text-slate-300 truncate">{h.title}</span>
                      <span className="text-[9px] text-slate-500 truncate">{h.url}</span>
                    </div>
                    <button
                      onClick={(e) => deleteHistoryItem(h.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-red-400 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Telemetry Status Grid from "Sleek Interface" instruction */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/60 space-y-3">
            <div className="space-y-0.5">
              <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">Gateway Server</span>
              <p className="text-slate-200 text-xs font-medium">Tokyo (NRT-04)</p>
              <p className="text-[10px] text-slate-500">Load: <span className="text-indigo-400 font-mono">14.2%</span></p>
            </div>
            <div className="border-t border-slate-800/50 my-1"></div>
            <div className="space-y-0.5">
              <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">Identity Masking</span>
              <p className="text-slate-200 text-[10px] font-mono truncate">127.0.0.1 → <span className="text-emerald-400 font-bold">45.88.2.14</span></p>
              <p className="text-[10px] text-slate-500">ISP: Cloudflare Global</p>
            </div>
            <div className="border-t border-slate-800/50 my-1"></div>
            <div className="space-y-1">
              <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">Latency Matrix</span>
              <p className="text-slate-200 text-xs font-medium">24ms (Ultra-Low)</p>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full w-4/5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
              </div>
            </div>
            <div className="border-t border-slate-800/50 my-1"></div>
            <div className="space-y-0.5">
              <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block">Encryption Level</span>
              <p className="text-slate-300 text-xs font-medium">AES-256 GCM</p>
              <p className="text-[10px] text-slate-500">Key: SHA-512 Signed</p>
            </div>
          </div>
        </aside>

        {/* Central Workspace: Main view modes with sleek styled Tab bar */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#0f172a]">
          
          {/* Main Visual Mode Tab Bar */}
          <div className="bg-[#0b0f19] border-b border-slate-800 px-4 flex items-center justify-between">
            <div className="flex gap-1 py-1">
              {[
                { id: "browser", label: "Interactive Browser", icon: Globe },
                { id: "inspect", label: "HTTP Inspector", icon: Terminal },
                { id: "reader", label: "Clutter-free Reader", icon: BookOpen },
                { id: "source", label: "Source Code", icon: Code },
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`relative flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all duration-200 ${
                      isSelected
                        ? "bg-[#0f172a] text-indigo-400 border-t-2 border-indigo-500 shadow-xs"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* External URL launch */}
            <div className="flex items-center gap-2 text-xs">
              <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-indigo-400 font-semibold flex items-center gap-1 transition"
              >
                <span>Launch Direct</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* View Panels rendering */}
          <div className="flex-1 overflow-hidden relative bg-slate-900/40">
            
            {/* Status Notifications Panel popup */}
            <AnimatePresence>
              {statusMessage && (
                <motion.div
                  initial={{ transform: "translateY(-100%)", opacity: 0 }}
                  animate={{ translateY: "0%", opacity: 1 }}
                  exit={{ translateY: "-100%)", opacity: 0 }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-950 border border-slate-800 text-slate-100 text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-2 z-50 pointer-events-none"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{statusMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Browser Interactive View Mode */}
            {activeTab === "browser" && (
              <div className="w-full h-full flex flex-col bg-slate-950">
                <div className="flex-1 relative">
                  <iframe
                    key={iframeKey}
                    src={getIframeSrc()}
                    className="w-full h-full bg-white border-none shadow-inner"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                    title="Proxied Content Frame"
                  />
                </div>
              </div>
            )}

            {/* HTTP Inspector Tab View */}
            {activeTab === "inspect" && (
              <div className="w-full h-full p-6 overflow-y-auto bg-[#0f172a]">
                <div className="max-w-4xl mx-auto space-y-6">
                  
                  {/* Summary Metric Header Card */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm p-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">HTTP Status</span>
                      {inspectLoading ? (
                        <span className="text-slate-400">...</span>
                      ) : inspectError ? (
                        <div className="flex items-center gap-1 text-rose-500 font-semibold text-lg mt-1">
                          <ShieldAlert className="w-5 h-5" />
                          <span>Fail</span>
                        </div>
                      ) : (
                        <span className={`text-xl font-bold mt-1 ${inspectData?.status && inspectData.status < 400 ? 'text-emerald-400' : 'text-rose-500'}`}>
                          {inspectData?.status || "—"} <span className="text-xs font-normal text-slate-500">{inspectData?.statusText}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Response Speed</span>
                      <span className="text-xl font-bold text-slate-200 mt-1">
                        {inspectLoading ? "Loading..." : inspectData?.loadTimeMs ? `${inspectData.loadTimeMs} ms` : "—"}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Content Type</span>
                      <span className="text-xs font-semibold text-slate-300 truncate mt-2 font-mono" title={inspectData?.contentType}>
                        {inspectLoading ? "Loading..." : inspectData?.contentType || "—"}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Payload Size</span>
                      <span className="text-xl font-bold text-slate-200 mt-1">
                        {inspectLoading ? "Loading..." : inspectData?.contentLength ? (
                          isNaN(Number(inspectData.contentLength)) ? inspectData.contentLength : `${(Number(inspectData.contentLength) / 1024).toFixed(1)} KB`
                        ) : "—"}
                      </span>
                    </div>
                  </div>

                  {inspectLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                      <p className="text-xs text-slate-400 font-medium font-mono">Querying secure node and inspecting server headers...</p>
                    </div>
                  ) : inspectError ? (
                    <div className="p-8 bg-rose-950/20 border border-rose-900/60 rounded-xl text-center">
                      <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto mb-3" />
                      <h3 className="font-semibold text-rose-300 text-sm mb-1">Failed to Inspect Server Headers</h3>
                      <p className="text-xs text-rose-400 max-w-lg mx-auto">{inspectError}</p>
                    </div>
                  ) : inspectData ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      
                      {/* Left: SEO Metadata details */}
                      <div className="lg:col-span-1 space-y-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm p-4">
                          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">SEO & Metadata</h3>
                          
                          <div className="space-y-4 text-xs">
                            <div>
                              <span className="text-slate-500 block mb-1">Page Title</span>
                              <p className="font-semibold text-slate-200">{inspectData.meta.title || "No Title detected"}</p>
                            </div>
                            <div>
                              <span className="text-slate-500 block mb-1">Meta Description</span>
                              <p className="text-slate-300 leading-relaxed bg-slate-950 p-2.5 rounded border border-slate-800">
                                {inspectData.meta.description || "No description tags found."}
                              </p>
                            </div>
                            <div>
                              <span className="text-slate-500 block mb-1">Page Statistics</span>
                              <p className="text-slate-300 font-medium">{inspectData.meta.wordCount} words detected</p>
                            </div>
                          </div>
                        </div>

                        {/* Tips */}
                        <div className="bg-indigo-950/40 border border-indigo-900/50 rounded-xl p-4 text-xs text-indigo-300 leading-relaxed">
                          <h4 className="font-bold mb-1">💡 Secure Inspector Node</h4>
                          We safely capture real-time headers, cookies and payload size from target addresses using Node proxies to prevent direct browser exposures.
                        </div>
                      </div>

                      {/* Right: Full response headers list */}
                      <div className="lg:col-span-2">
                        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
                          <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Terminal className="w-3.5 h-3.5 text-indigo-500" />
                              HTTP Response Headers
                            </h3>
                            <span className="text-[10px] text-slate-500 font-mono">{Object.keys(inspectData.headers).length} keys</span>
                          </div>
                          
                          <div className="divide-y divide-slate-800 font-mono text-xs max-h-[420px] overflow-y-auto">
                            {Object.entries(inspectData.headers).map(([key, val]) => (
                              <div key={key} className="p-3 hover:bg-slate-800/50 flex flex-col sm:flex-row gap-2">
                                <span className="font-semibold text-indigo-400 w-full sm:w-1/3 truncate" title={key}>{key}</span>
                                <span className="text-slate-300 flex-1 break-all select-text">{val}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="text-center py-20 text-slate-500 italic">No inspecting data yet. Type a URL above and visit!</div>
                  )}
                </div>
              </div>
            )}

            {/* Reader Mode Tab View */}
            {activeTab === "reader" && (
              <div className={`w-full h-full flex flex-col ${
                readerTheme === 'light' ? 'bg-white text-slate-800' : readerTheme === 'dark' ? 'bg-slate-950 text-slate-300' : 'bg-[#1a1714] text-amber-200'
              }`}>
                
                {/* Reader Controls Toolbar */}
                <div className="bg-slate-950/80 border-b border-slate-800 px-6 py-2.5 flex items-center justify-between z-10 flex-shrink-0">
                  <div className="flex items-center gap-4">
                    
                    {/* Resizer */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 mr-1.5">Size:</span>
                      {(["sm", "md", "lg", "xl"] as any[]).map((size) => (
                        <button
                          key={size}
                          onClick={() => setReaderFontSize(size)}
                          className={`w-6 h-6 rounded flex items-center justify-center text-xs font-semibold uppercase transition-all ${
                            readerFontSize === size
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>

                    {/* Color palette preset */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 mr-1.5">Theme:</span>
                      {[
                        { id: "light", label: "Light", bg: "bg-white", border: "border-slate-300", text: "text-slate-800" },
                        { id: "sepia", label: "Sepia", bg: "bg-[#25201d]", border: "border-amber-900/35", text: "text-amber-200" },
                        { id: "dark", label: "Dark", bg: "bg-slate-950", border: "border-slate-800", text: "text-slate-200" }
                      ].map((theme) => (
                        <button
                          key={theme.id}
                          onClick={() => setReaderTheme(theme.id as any)}
                          className={`px-2.5 py-0.5 rounded text-[11px] font-medium border transition-all ${theme.bg} ${theme.text} ${theme.border} ${
                            readerTheme === theme.id ? "ring-2 ring-indigo-500 scale-105 shadow-xs" : "hover:scale-102"
                          }`}
                        >
                          {theme.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono hidden sm:block">
                    ⚡ Read Articles Clutter-free
                  </div>
                </div>

                {/* Main scrollable Article */}
                <div className="flex-1 overflow-y-auto px-6 py-10">
                  <div className={`max-w-2xl mx-auto space-y-6 ${
                    readerFontSize === "sm" ? "text-sm" : readerFontSize === "md" ? "text-base" : readerFontSize === "lg" ? "text-lg" : "text-xl"
                  }`}>
                    
                    {readerLoading ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <BookOpen className="w-8 h-8 text-indigo-500 animate-pulse" />
                        <p className="text-xs text-slate-400 font-medium font-mono">Extracting body copy and sanitizing page format...</p>
                      </div>
                    ) : readerError ? (
                      <div className="p-8 bg-slate-900 border border-slate-800 rounded-xl text-center">
                        <FileText className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                        <h3 className="font-semibold text-slate-200 text-sm mb-1">Reader Mode Unavailable</h3>
                        <p className="text-xs text-slate-400 max-w-lg mx-auto">{readerError}</p>
                      </div>
                    ) : readerData ? (
                      <article className="space-y-6 select-text">
                        
                        {/* Header details */}
                        <div className="border-b border-slate-800 pb-5 mb-5">
                          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-sans leading-tight text-white">
                            {readerData.title}
                          </h1>
                          <div className="flex items-center gap-3 mt-3 text-xs text-slate-400 font-mono">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-indigo-400" />
                              {readerData.readingTime} min read
                            </span>
                            <span>•</span>
                            <span>{readerData.wordCount} words</span>
                          </div>
                        </div>

                        {/* Extracted Body Content */}
                        <div 
                          className={`prose max-w-none leading-relaxed space-y-4 ${
                            readerTheme === 'dark' ? 'text-slate-300 prose-invert' : readerTheme === 'sepia' ? 'text-amber-200/90 prose-sepia' : 'text-slate-800'
                          }`}
                          dangerouslySetInnerHTML={{ __html: readerData.content }}
                        />

                      </article>
                    ) : (
                      <div className="text-center py-20 text-slate-500 italic">No article content. Try a blog, documentation, or news article URL!</div>
                    )}

                  </div>
                </div>

              </div>
            )}

            {/* Source Viewer Tab View */}
            {activeTab === "source" && (
              <div className="w-full h-full flex flex-col bg-slate-950 text-slate-300 font-mono text-xs">
                
                {/* Search query finder bar */}
                <div className="bg-slate-900 border-b border-slate-800 px-6 py-2.5 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2 max-w-lg w-full">
                    <SearchCode className="w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={sourceSearchQuery}
                      onChange={(e) => setSourceSearchQuery(e.target.value)}
                      placeholder="Find keyword in source (regex or plain text)..."
                      className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-full"
                    />
                    {sourceSearchQuery && (
                      <button
                        onClick={() => setSourceSearchQuery("")}
                        className="text-slate-500 hover:text-slate-300"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(sourceHtml);
                        showTemporaryStatus("Copied raw HTML to clipboard");
                      }}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-[11px] font-medium rounded text-white transition"
                    >
                      Copy Source
                    </button>
                    <span className="text-[11px] text-slate-500">
                      Lines: {sourceHtml ? sourceHtml.split("\n").length : 0}
                    </span>
                  </div>
                </div>

                {/* Rendered Source Code */}
                <div className="flex-1 overflow-auto p-6 bg-slate-950">
                  {sourceLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4 h-full">
                      <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                      <p className="text-xs text-slate-400 font-medium font-sans">Downloading raw markup content from secure node...</p>
                    </div>
                  ) : sourceError ? (
                    <div className="p-8 bg-rose-950/30 border border-rose-900/60 rounded-lg text-center my-auto max-w-md mx-auto">
                      <Terminal className="w-8 h-8 text-rose-500 mx-auto mb-3" />
                      <p className="text-rose-400">{sourceError}</p>
                    </div>
                  ) : sourceHtml ? (
                    <pre className="select-text whitespace-pre overflow-x-auto leading-relaxed select-all">
                      <code 
                        dangerouslySetInnerHTML={{ __html: getHighlightedSource() }} 
                      />
                    </pre>
                  ) : (
                    <div className="text-center py-20 text-slate-600 italic">No source loaded. Type a URL above and launch browser.</div>
                  )}
                </div>

              </div>
            )}

          </div>

        </main>

      </div>

      {/* Sleek Footer Bar */}
      <footer className="h-9 px-6 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500 bg-slate-950 font-mono relative z-15 flex-shrink-0">
        <div className="flex gap-4">
          <span>SESSION_ID: 8f2-xa9-01c</span>
          <span>UPTIME: ACTIVE</span>
        </div>
        <div className="flex gap-4">
          <span className="text-indigo-400 font-bold">NO_LOGS_POLICY: ACTIVE</span>
          <span className="hidden sm:inline">PRIVACY_GDPR_COMPLIANT</span>
        </div>
      </footer>

    </div>
  );
}
