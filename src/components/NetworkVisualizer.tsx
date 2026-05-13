import React, { useState, useMemo, useRef } from 'react';
import Map from 'react-map-gl/maplibre';
import { DeckGL } from '@deck.gl/react';
import { ArcLayer, ScatterplotLayer, GeoJsonLayer } from '@deck.gl/layers';
import { Activity, Globe, Wifi, Settings, Plus, Maximize, Minimize, Filter, Upload } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { kml } from '@tmcw/togeojson';
import 'maplibre-gl/dist/maplibre-gl.css';

// Sample network nodes
const CITIES = {
  london: { name: 'London, UK', coordinates: [-0.1276, 51.5072], type: 'core' },
  paris: { name: 'Paris, FR', coordinates: [2.3522, 48.8566], type: 'core' },
  frankfurt: { name: 'Frankfurt, DE', coordinates: [8.6821, 50.1109], type: 'core' },
  amsterdam: { name: 'Amsterdam, NL', coordinates: [4.9041, 52.3676], type: 'core' },
  marseille: { name: 'Marseille, FR', coordinates: [5.3698, 43.2965], type: 'edge' },
  madrid: { name: 'Madrid, ES', coordinates: [-3.7038, 40.4168], type: 'edge' },
  milan: { name: 'Milan, IT', coordinates: [9.1900, 45.4642], type: 'core' },
  newyork: { name: 'New York, US', coordinates: [-74.006, 40.7128], type: 'subsea_landing' }
};

// Sample network edges
const ROUTES = [
  // European Long Haul
  { source: CITIES.london, target: CITIES.paris, type: 'long_haul', capacity: '100G', status: 'active' },
  { source: CITIES.paris, target: CITIES.frankfurt, type: 'long_haul', capacity: '400G', status: 'active' },
  { source: CITIES.frankfurt, target: CITIES.amsterdam, type: 'long_haul', capacity: '400G', status: 'active' },
  { source: CITIES.amsterdam, target: CITIES.london, type: 'long_haul', capacity: '100G', status: 'maintenance' },
  
  // Metro / Edge extensions
  { source: CITIES.paris, target: CITIES.marseille, type: 'metro', capacity: '10G', status: 'active' },
  { source: CITIES.paris, target: CITIES.madrid, type: 'metro', capacity: '10G', status: 'planned' },
  { source: CITIES.frankfurt, target: CITIES.milan, type: 'long_haul', capacity: '100G', status: 'active' },
  
  // Subsea
  { source: CITIES.london, target: CITIES.newyork, type: 'subsea', capacity: 'Multiple Tbps', status: 'active' }
];

const INITIAL_VIEW_STATE = {
  longitude: 4.0,
  latitude: 48.0,
  zoom: 4,
  pitch: 45,
  bearing: 0
};

export default function NetworkVisualizer() {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState({
    long_haul: true,
    metro: true,
    subsea: true
  });
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  const [importedGeoJson, setImportedGeoJson] = useState<any>(null);
  const [showImported, setShowImported] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.info(`Processing ${file.name}...`);
      
      let kmlText = '';
      
      if (file.name.toLowerCase().endsWith('.kmz')) {
        const zip = await JSZip.loadAsync(file);
        // Find the first .kml file in the archive
        const kmlFile = Object.values(zip.files).find(f => f.name.toLowerCase().endsWith('.kml'));
        if (!kmlFile) {
          throw new Error('No KML file found in KMZ archive.');
        }
        kmlText = await kmlFile.async('text');
      } else if (file.name.toLowerCase().endsWith('.kml')) {
        kmlText = await file.text();
      } else {
        throw new Error('Unsupported file format. Please upload KML or KMZ.');
      }

      const parser = new DOMParser();
      const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
      const geojson = kml(kmlDoc);
      
      setImportedGeoJson(geojson);
      setShowImported(true);
      toast.success('Route data imported successfully!');
      
      // Optionally adjust view to imported data
      if (geojson.features?.length > 0) {
        // Just jumping to a default center if desired, but retaining user's view is often safer
      }
      
    } catch (error: any) {
      console.error('Error importing file:', error);
      toast.error(`Import failed: ${error.message}`);
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const filteredRoutes = useMemo(() => {
    return ROUTES.filter(route => filters[route.type as keyof typeof filters]);
  }, [filters]);

  const toggleFilter = (key: keyof typeof filters) => {
    setFilters(f => ({ ...f, [key]: !f[key] }));
  };

  const layers = [
    new ArcLayer({
      id: 'network-arcs',
      data: filteredRoutes,
      getSourcePosition: (d: any) => d.source.coordinates,
      getTargetPosition: (d: any) => d.target.coordinates,
      getSourceColor: (d: any) => d.status === 'maintenance' ? [251, 191, 36] : d.status === 'planned' ? [156, 163, 175] : [56, 189, 248],
      getTargetColor: (d: any) => d.status === 'maintenance' ? [251, 191, 36] : d.status === 'planned' ? [156, 163, 175] : [129, 140, 248],
      getWidth: (d: any) => d.type === 'subsea' ? 4 : d.type === 'long_haul' ? 3 : 1.5,
      pickable: true,
      onHover: (info: any) => setHoverInfo(info)
    }),
    new ScatterplotLayer({
      id: 'network-nodes',
      data: Object.values(CITIES),
      getPosition: (d: any) => d.coordinates,
      getFillColor: (d: any) => d.type === 'core' ? [139, 92, 246] : [244, 114, 182],
      getRadius: (d: any) => d.type === 'core' ? 30000 : 15000,
      pickable: true,
      stroked: true,
      getLineColor: [255, 255, 255],
      lineWidthMinPixels: 2,
      onHover: (info: any) => setHoverInfo(info)
    }),
    ...(importedGeoJson && showImported ? [
      new GeoJsonLayer({
        id: 'imported-geojson',
        data: importedGeoJson,
        pickable: true,
        stroked: true,
        filled: true,
        extruded: true,
        lineWidthScale: 20,
        lineWidthMinPixels: 2,
        getFillColor: [160, 160, 180, 200],
        getLineColor: [234, 179, 8], // distinctive yellow/gold
        getRadius: 100,
        getLineWidth: 1,
        getElevation: 30,
        onHover: (info: any) => {
          if (info.object) {
            setHoverInfo({
              ...info,
              object: {
                isImported: true,
                name: info.object.properties?.name || 'Imported Geometry',
                type: info.object.geometry?.type
              }
            });
          } else {
            setHoverInfo(null);
          }
        }
      })
    ] : [])
  ];

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-white rounded-3xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-hrma-charcoal flex items-center gap-3">
            <Globe className="w-8 h-8 text-hrma-blue" />
            Network Route Visualiser
          </h1>
          <p className="text-sm font-medium tracking-[0.05em] text-gray-500 mt-2">
            INTEGRATED GOOGLE MAPS / DECK.GL ENGINE
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-3">
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".kml,.kmz"
            className="hidden"
          />
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium text-sm">
            <Settings className="w-4 h-4" />
            Config
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-hrma-blue text-white rounded-xl hover:bg-blue-700 transition-colors shadow-[0_4px_14px_0_rgba(0,118,255,0.39)] font-medium text-sm"
          >
            <Upload className="w-4 h-4" />
            Import KML/KMZ
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={cn(
        "flex flex-col lg:flex-row gap-6 transition-all duration-500",
        isExpanded ? "h-[calc(200vh-250px)] min-h-[1000px]" : "h-[calc(100vh-250px)] min-h-[500px]"
      )}>
        
        {/* Map Container */}
        <div className="flex-1 rounded-3xl overflow-hidden relative shadow-md bg-gray-900 border border-gray-800">
          <DeckGL
            initialViewState={viewState as any}
            controller={true}
            layers={layers}
            onViewStateChange={(e) => setViewState(e.viewState as any)}
          >
            <Map
              mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
              attributionControl={false}
            />
          </DeckGL>

          {/* Hover Tooltip */}
          {hoverInfo && hoverInfo.object && (
            <div 
              className="absolute z-10 p-3 bg-white/95 backdrop-blur-md text-gray-900 rounded-xl shadow-xl text-sm font-medium border border-gray-100 pointer-events-none"
              style={{left: hoverInfo.x + 10, top: hoverInfo.y + 10}}
            >
              {hoverInfo.object.isImported ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-4 h-4 text-yellow-500" />
                    <span className="font-bold">{hoverInfo.object.name}</span>
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    Imported {hoverInfo.object.type}
                  </div>
                </>
              ) : hoverInfo.object.source ? (
                // It's a route
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-hrma-blue" />
                    <span className="font-bold tracking-tight">{hoverInfo.object.source.name} ↔ {hoverInfo.object.target.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-gray-500">Route Type:</span>
                    <span className="capitalize text-right">{hoverInfo.object.type.replace('_', ' ')}</span>
                    <span className="text-gray-500">Capacity:</span>
                    <span className="text-right">{hoverInfo.object.capacity}</span>
                    <span className="text-gray-500">Status:</span>
                    <span className={cn(
                      "text-right capitalize",
                      hoverInfo.object.status === 'active' ? 'text-emerald-500' :
                      hoverInfo.object.status === 'maintenance' ? 'text-amber-500' : 'text-gray-500'
                    )}>
                      {hoverInfo.object.status}
                    </span>
                  </div>
                </>
              ) : (
                // It's a node
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <Wifi className="w-4 h-4 text-purple-500" />
                    <span className="font-bold">{hoverInfo.object.name}</span>
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {hoverInfo.object.type.replace('_', ' ')} Node
                  </div>
                </>
              )}
            </div>
          )}

          {/* Map Controls Overlay */}
          <div className="absolute top-4 left-4 flex gap-2">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 bg-gray-900/80 backdrop-blur text-white rounded-lg hover:bg-gray-800 transition-colors border border-gray-700 shadow-lg"
              title={isExpanded ? "Restore map size" : "Increase map size 2x"}
            >
              {isExpanded ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="w-full lg:w-80 flex flex-col gap-4">
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex-1">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Layer Filters
            </h3>
            
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors group">
                <div className="flex items-center gap-3">
                  <div className={cn("w-3 h-3 rounded-full shadow-sm", filters.long_haul ? "bg-blue-400" : "bg-gray-200")} />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Long Haul Backbone</span>
                </div>
                <input type="checkbox" className="sr-only" checked={filters.long_haul} onChange={() => toggleFilter('long_haul')} />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors group">
                <div className="flex items-center gap-3">
                  <div className={cn("w-3 h-3 rounded-full shadow-sm", filters.metro ? "bg-sky-300" : "bg-gray-200")} />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Metro Extensions</span>
                </div>
                <input type="checkbox" className="sr-only" checked={filters.metro} onChange={() => toggleFilter('metro')} />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors group">
                <div className="flex items-center gap-3">
                  <div className={cn("w-3 h-3 rounded-full shadow-sm", filters.subsea ? "bg-indigo-500" : "bg-gray-200")} />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Subsea Routes</span>
                </div>
                <input type="checkbox" className="sr-only" checked={filters.subsea} onChange={() => toggleFilter('subsea')} />
              </label>

              {importedGeoJson && (
                <label className="flex items-center justify-between p-3 rounded-xl border border-yellow-100 hover:bg-yellow-50 bg-yellow-50/50 cursor-pointer transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-3 h-3 rounded-full shadow-sm", showImported ? "bg-yellow-500" : "bg-gray-200")} />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Custom Upload Data</span>
                  </div>
                  <input type="checkbox" className="sr-only" checked={showImported} onChange={() => setShowImported(!showImported)} />
                </label>
              )}
            </div>
            
            <div className="mt-8">
               <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Integration Possibilities
              </h3>
              <div className="text-sm text-gray-600 space-y-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <p><strong>1. Google Maps JS API + Deck.gl:</strong> Using your corporate Maps API key, we can render 3D arcs directly over satellite imagery in real-time.</p>
                <p><strong>2. Dynamic KML parsing:</strong> Users can upload <code>.kml</code> or <code>.kmz</code> files to have infrastructure overlaid onto the dashboard instantly.</p>
                <p><strong>3. AI Fiber Analysis:</strong> The AI Agent can analyze routes and propose new resilient paths between PoPs.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
