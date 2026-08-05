'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { X, Navigation, Loader2, MapPin } from 'lucide-react';

type Props = {
  orderId: string;
  destination?: { lat: number; lng: number; label?: string };
  onClose: () => void;
  technicianName?: string;
  technicianRole?: string;
};

const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14&accept-language=en`);
    const data = await res.json();
    return data?.display_name || 'Location unavailable';
  } catch {
    return 'Location unavailable';
  }
};

export default function LiveTrackingModal({ orderId, destination, onClose, technicianName, technicianRole }: Props) {
  const supabase = createClient();
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const trailRef = useRef<any>(null);       // actual path already traveled (breadcrumb)
  const remainingLineRef = useRef<any>(null); // dashed line: current pos -> destination
  const containerRef = useRef<HTMLDivElement>(null);
  const LRef = useRef<any>(null);
  const pointsRef = useRef<[number, number][]>([]); // all recorded_at-ordered points so far

  const [status, setStatus] = useState<'connecting' | 'live' | 'no-data'>('connecting');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [areaName, setAreaName] = useState<string>('');

  // Init map
  useEffect(() => {
    let mounted = true;

    (async () => {
      const L = (await import('leaflet')).default;
      if (!mounted || !containerRef.current) return;
      LRef.current = L;

      // Fix default icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const startLat = destination?.lat || 20.5937;
      const startLng = destination?.lng || 78.9629;

      const map = L.map(containerRef.current).setView([startLat, startLng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;

      // Destination marker (static)
      if (destination) {
        const destIcon = L.divIcon({
          className: '',
          html: `<div style="background:#ef4444;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 2px #ef4444;"></div>`,
          iconSize: [16, 16],
        });
        destMarkerRef.current = L.marker([destination.lat, destination.lng], { icon: destIcon })
          .addTo(map)
          .bindPopup(destination.label || 'Destination');
      }

      // Initial fetch of the full trail so far (job_locations is an append-only log)
      const { data } = await supabase
        .from('job_locations')
        .select('*')
        .eq('order_id', orderId)
        .order('recorded_at', { ascending: true });

      if (data && data.length > 0) {
        pointsRef.current = data.map((row: any) => [row.latitude, row.longitude]);
        const last = data[data.length - 1];
        renderTrailAndMarker(L);
        setStatus('live');
        setLastUpdated(new Date(last.recorded_at));
        reverseGeocode(last.latitude, last.longitude).then(setAreaName);
        fitBounds(L);
      } else {
        setStatus('no-data');
      }
    })();

    return () => {
      mounted = false;
      mapRef.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime subscription — job_locations is append-only, so we listen for INSERTs
  useEffect(() => {
    const channel = supabase
      .channel(`job-loc-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_locations', filter: `order_id=eq.${orderId}` },
        (payload: any) => {
          const row = payload.new;
          if (!row || !LRef.current) return;
          pointsRef.current.push([row.latitude, row.longitude]);
          renderTrailAndMarker(LRef.current);
          setStatus('live');
          setLastUpdated(new Date(row.recorded_at));
          reverseGeocode(row.latitude, row.longitude).then(setAreaName);
          fitBounds(LRef.current);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Draws the breadcrumb trail (solid line, all points visited) + the moving marker
  // at the latest point + an optional dashed line showing the remaining distance
  // to the destination.
  const renderTrailAndMarker = (L: any) => {
    const map = mapRef.current;
    const points = pointsRef.current;
    if (!map || points.length === 0) return;

    const latest = points[points.length - 1];

    // Breadcrumb trail of the actual path traveled so far
    if (trailRef.current) map.removeLayer(trailRef.current);
    if (points.length > 1) {
      trailRef.current = L.polyline(points, { color: '#8ED26B', weight: 4, opacity: 0.8 }).addTo(map);
    }

    // Moving marker at the latest recorded point
    // Moving marker at the latest recorded point
const icon = L.divIcon({
  className: '',
  html: `<div style="
    background:#8ED26B;
    width:34px;height:34px;
    border-radius:50%;
    border:3px solid white;
    box-shadow:0 2px 8px rgba(0,0,0,0.35);
    display:flex;align-items:center;justify-content:center;
    font-size:18px;
    line-height:1;
  ">🏍️</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});
    const popupHtml = `
  <div style="font-family:inherit;min-width:160px;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
      <span style="font-size:15px;">👤</span>
      <span style="font-weight:700;font-size:13px;color:#111827;">${technicianName || 'Technician'}</span>
    </div>
    <div style="display:flex;align-items:center;gap:6px;">
      <span style="font-size:14px;">🛠️</span>
      <span style="font-size:12px;color:#6b7280;font-weight:600;">${technicianRole || 'Field Executive'}</span>
    </div>
  </div>
`;

if (!markerRef.current) {
  markerRef.current = L.marker(latest, { icon }).addTo(map).bindPopup(popupHtml);
} else {
  markerRef.current.setLatLng(latest);
  markerRef.current.setPopupContent(popupHtml);
}

    // Dashed line from current position to destination (remaining distance)
    if (destination) {
      if (remainingLineRef.current) map.removeLayer(remainingLineRef.current);
      remainingLineRef.current = L.polyline(
        [latest, [destination.lat, destination.lng]],
        { color: '#9ca3af', dashArray: '6 6', weight: 2 }
      ).addTo(map);
    }
  };

  const fitBounds = (L: any) => {
    const map = mapRef.current;
    if (!map || !markerRef.current) return;
    const points = [markerRef.current.getLatLng()];
    if (destMarkerRef.current) points.push(destMarkerRef.current.getLatLng());
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [60, 60] });
    } else {
      map.setView(points[0], 15);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Navigation size={18} className="text-[#5a9a3e]" />
            <h3 className="text-sm font-black text-gray-900">Live Technician Tracking</h3>
            {status === 'live' && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> LIVE
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        <div className="relative h-[420px] w-full">
          {status === 'connecting' && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
              <Loader2 size={28} className="animate-spin text-[#8ED26B]" />
            </div>
          )}
          {status === 'no-data' && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 text-center px-6">
              <MapPin size={32} className="text-gray-300 mb-2" />
              <p className="text-sm font-bold text-gray-600">No live location yet</p>
              <p className="text-xs text-gray-400 mt-1">The map will update automatically once the technician starts sharing location.</p>
            </div>
          )}
          <div ref={containerRef} className="h-full w-full" />
        </div>

        {(lastUpdated || areaName) && (
          <div className="px-5 py-2.5 border-t border-gray-100 text-center">
            {areaName && (
              <p className="text-xs font-semibold text-gray-700 truncate mb-0.5">{areaName}</p>
            )}
            {lastUpdated && (
              <p className="text-[11px] font-medium text-gray-400">
                Last updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}