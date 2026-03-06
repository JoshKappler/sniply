"use client";
import { useEffect, useRef, useState } from "react";

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
import type { Map, LayerGroup, Marker } from "leaflet";

export interface MapBarber {
  id: string;
  name: string;
  location: string;
  rating: number;
  reviewCount: number;
  startingPrice: number;
  type: "independent" | "shop";
  lat: number;
  lng: number;
}

interface MapViewProps {
  barbers: MapBarber[];
  center: { lat: number; lng: number } | null;
  userPin: { lat: number; lng: number } | null;
}

// ── Leaflet loader (module-level singleton) ────────────────────────────────
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _L: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _promise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadLeaflet(): Promise<any> {
  if (_L) return Promise.resolve(_L);
  if (_promise) return _promise;
  _promise = import("leaflet").then((mod) => {
    _L = mod.default ?? mod;
    return _L;
  });
  return _promise;
}

function injectCSS() {
  if (document.querySelector(`link[href="${LEAFLET_CSS}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = LEAFLET_CSS;
  document.head.appendChild(link);

  const style = document.createElement("style");
  style.textContent = `
    .leaflet-popup-content-wrapper {
      border-radius: 14px !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.07) !important;
      padding: 0 !important;
      border: 1px solid rgba(0,0,0,0.07) !important;
    }
    .leaflet-popup-content {
      margin: 14px 16px !important;
    }
    .leaflet-popup-close-button {
      top: 8px !important;
      right: 10px !important;
      color: #9ca3af !important;
      font-size: 18px !important;
    }
    .leaflet-popup-close-button:hover {
      color: #374151 !important;
    }
    .leaflet-popup-tip-container {
      margin-top: -1px;
    }
  `;
  document.head.appendChild(style);
}

// ── SVG pin builders ───────────────────────────────────────────────────────
function barberPinHtml(color: string) {
  return `<div style="width:30px;height:38px;">
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38">
      <path d="M15 0C6.716 0 0 6.716 0 15c0 8.284 15 23 15 23S30 23.284 30 15C30 6.716 23.284 0 15 0z"
        fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="15" cy="15" r="6" fill="white"/>
    </svg>
  </div>`;
}

const USER_PIN_HTML = `<div style="width:20px;height:20px;">
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="8" fill="var(--color-accent)" stroke="white" stroke-width="2.5"/>
    <circle cx="10" cy="10" r="3.5" fill="white"/>
  </svg>
</div>`;

function starStr(rating: number) {
  const f = Math.round(rating);
  return "★".repeat(f) + "☆".repeat(5 - f);
}

// ── Component ──────────────────────────────────────────────────────────────
export default function MapView({ barbers, center, userPin }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  const BAY_AREA: [number, number] = [37.7749, -122.4194];

  // ── Initialize map ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    injectCSS();
    loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      LRef.current = L;

      const initialCenter: [number, number] = center
        ? [center.lat, center.lng]
        : BAY_AREA;

      const map = L.map(containerRef.current, {
        center: initialCenter,
        zoom: center ? 12 : 10,
        zoomControl: true,
        attributionControl: true,
      }) as Map;

      // CartoDB Positron — clean light tiles that match the app's silver palette
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 20,
        }
      ).addTo(map);

      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      setReady(true);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
        userMarkerRef.current = null;
        setReady(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update markers when barbers change ───────────────────────────────────
  useEffect(() => {
    if (!ready || !layerRef.current || !LRef.current) return;
    const L = LRef.current;
    const layer = layerRef.current;

    layer.clearLayers();

    barbers.forEach((barber) => {
      if (barber.lat == null || barber.lng == null) return;

      const badgeColor = barber.type === "shop" ? "#D97706" : "var(--color-primary)";
      const badgeLabel = barber.type === "shop" ? "Shop" : "Independent";

      const icon = L.divIcon({
        html: barberPinHtml("var(--color-primary)"),
        className: "",
        iconSize: [30, 38],
        iconAnchor: [15, 38],
        popupAnchor: [0, -42],
      });

      const popupContent = `
        <div style="font-family:Inter,system-ui,sans-serif;min-width:175px;max-width:215px;">
          <div style="font-weight:700;font-size:14px;color:#111827;margin-bottom:5px;line-height:1.35;">${escHtml(barber.name)}</div>
          <div style="display:inline-flex;align-items:center;background:${badgeColor}18;color:${badgeColor};font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;margin-bottom:8px;">${badgeLabel}</div>
          <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">
            <span style="color:var(--color-accent);font-size:12px;line-height:1;">${starStr(barber.rating)}</span>
            <span style="color:#111827;font-size:12px;font-weight:600;">${barber.rating}</span>
            <span style="color:#9ca3af;font-size:11px;">(${barber.reviewCount})</span>
          </div>
          <div style="color:#374151;font-size:12px;margin-bottom:2px;">from <strong style="color:#111827;">$${barber.startingPrice}</strong></div>
          <div style="color:#9ca3af;font-size:11px;margin-bottom:11px;">${escHtml(barber.location)}</div>
          <a href="/barber/${barber.id}" style="display:block;text-align:center;font-size:12px;font-weight:700;color:#fff;text-decoration:none;background:linear-gradient(135deg,#3050A0,#1E3573);padding:7px 14px;border-radius:9px;">View Profile →</a>
        </div>`;

      const marker = L.marker([barber.lat, barber.lng], { icon }).bindPopup(
        popupContent,
        { maxWidth: 210, closeButton: true }
      );

      layer.addLayer(marker);
    });

    // Auto-fit map to visible barbers (only when no explicit center is set)
    const points = barbers
      .filter((b) => b.lat != null && b.lng != null)
      .map((b) => [b.lat, b.lng] as [number, number]);
    if (points.length >= 2 && mapRef.current) {
      const bounds = L.latLngBounds(points);
      mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 13, animate: true });
    }
  }, [barbers, ready]);

  // ── Update user GPS pin ──────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current || !LRef.current) return;
    const L = LRef.current;
    const map = mapRef.current;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (userPin) {
      const icon = L.divIcon({
        html: USER_PIN_HTML,
        className: "",
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      userMarkerRef.current = L.marker([userPin.lat, userPin.lng], {
        icon,
        zIndexOffset: 1000,
        title: "Your location",
      }).addTo(map);
    }
  }, [userPin, ready]);

  // ── Pan/zoom on center change ────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current || !center) return;
    mapRef.current.setView([center.lat, center.lng], 12, { animate: true });
  }, [center, ready]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-sm border border-gray-200">
      {!ready && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
          <div className="w-8 h-8 border-2 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin" />
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
      {ready && barbers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl px-5 py-3 shadow border border-gray-200 text-center">
            <p className="font-semibold text-gray-700 text-sm">No pros in this area</p>
            <p className="text-gray-400 text-xs mt-0.5">Try expanding your search radius</p>
          </div>
        </div>
      )}
    </div>
  );
}
