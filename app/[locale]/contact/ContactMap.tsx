'use client';

import 'leaflet/dist/leaflet.css';

import { useEffect, useRef } from 'react';

// Leaflet loaded lazily — no SSR issues
export default function ContactMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !mapRef.current) return;
    initialized.current = true;

    // Lazy-load Leaflet only on client
    (async () => {
      const L = (await import('leaflet')).default;

      // Fix default icon paths broken by webpack
      delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        iconUrl: '/leaflet/marker-icon.png',
        shadowUrl: '/leaflet/marker-shadow.png',
      });

      // ← ใส่ lat/lng จริงของห้องสมุด
      const LAT = 17.9748;
      const LNG = 102.6332;

      const map = L.map(mapRef.current!).setView([LAT, LNG], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      L.marker([LAT, LNG]).addTo(map);
    })();
  }, []);

  return (
    <div
      ref={mapRef}
      className="rounded-2xl overflow-hidden border"
      style={{ height: 240 }}
      aria-label="แผนที่ที่ตั้งห้องสมุด"
      role="application"
    />
  );
}