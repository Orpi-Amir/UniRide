"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [26.0667, 50.5577];

async function fetchDrivingRouteCoords(fromCoords, toCoords) {
  const [fromLat, fromLng] = fromCoords;
  const [toLat, toLng] = toCoords;
  const res = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`
  );
  const data = await res.json();
  const coords = data?.routes?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  return coords.map(([lng, lat]) => [lat, lng]);
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&namedetails=1&accept-language=en&lat=${lat}&lon=${lng}`
    );
    const data = await res.json();
    return (
      data?.display_name ||
      data?.name ||
      `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    );
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

export default function MapView({
  setFromCoords,
  setToCoords,
  setFromLocation,
  setToLocation,
  rides = [],
  previewFromCoords,
  previewToCoords,
  routeFromCurrentToCoords,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const markersLayerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const selectionMarkersLayerRef = useRef(null);
  const selectionRouteLayerRef = useRef(null);
  const currentLocationLayerRef = useRef(null);
  const currentRouteLayerRef = useRef(null);
  const selectionRef = useRef({ from: null, to: null });
  const stepRef = useRef(0); // 0 = FROM, 1 = TO
  const routeRenderVersionRef = useRef(0);
  const [currentCoords, setCurrentCoords] = useState(null);

  const safeClearSelectionMarkers = () => {
    const layer = selectionMarkersLayerRef.current;
    if (layer) layer.clearLayers();
    selectionRef.current = { from: null, to: null };
  };

  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || mapRef.current || !containerRef.current) return;

      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        center: DEFAULT_CENTER,
        zoom: 13,
        markerZoomAnimation: false,
      });

      L.tileLayer(
        "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png",
        {
          attribution: "&copy; Stadia Maps &copy; OpenMapTiles &copy; OpenStreetMap",
        }
      ).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      routeLayerRef.current = L.layerGroup().addTo(map);
      selectionMarkersLayerRef.current = L.layerGroup().addTo(map);
      selectionRouteLayerRef.current = L.layerGroup().addTo(map);
      currentLocationLayerRef.current = L.layerGroup().addTo(map);
      currentRouteLayerRef.current = L.layerGroup().addTo(map);

      const selectionIcon = L.icon({
        iconUrl: "/pin.png",
        iconSize: [38, 38],
        iconAnchor: [19, 38],
      });

      const hasSelectionHandlers =
        typeof setFromCoords === "function" ||
        typeof setToCoords === "function" ||
        typeof setFromLocation === "function" ||
        typeof setToLocation === "function";

      if (hasSelectionHandlers) {
        map.on("click", async (e) => {
          const selectionLayer = selectionMarkersLayerRef.current;
          if (!selectionLayer) return;

          const { lat, lng } = e.latlng;
          const nextStep = stepRef.current === 0 ? "from" : "to";

          if (selectionRef.current[nextStep]) {
            try {
              selectionLayer.removeLayer(selectionRef.current[nextStep]);
            } catch {}
            selectionRef.current[nextStep] = null;
          }

          selectionRef.current[nextStep] = L.marker([lat, lng], {
            icon: selectionIcon,
          })
            .addTo(selectionLayer)
            .bindPopup(nextStep === "from" ? "Pickup" : "Dropoff");

          const locationLabel = await reverseGeocode(lat, lng);

          if (nextStep === "from") {
            setFromCoords?.([lat, lng]);
            setFromLocation?.(locationLabel);
            stepRef.current = 1;
          } else {
            setToCoords?.([lat, lng]);
            setToLocation?.(locationLabel);
            stepRef.current = 0;
          }
        });
      }

      mapRef.current = map;

      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (cancelled) return;
            const coords = [position.coords.latitude, position.coords.longitude];
            setCurrentCoords(coords);
          },
          () => {}
        );
      }
    });

    return () => {
      cancelled = true;
      safeClearSelectionMarkers();
      markersLayerRef.current = null;
      routeLayerRef.current = null;
      selectionMarkersLayerRef.current = null;
      selectionRouteLayerRef.current = null;
      currentLocationLayerRef.current = null;
      currentRouteLayerRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [setFromCoords, setToCoords, setFromLocation, setToLocation]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    const routeLayer = routeLayerRef.current;
    const selectionRouteLayer = selectionRouteLayerRef.current;
    const currentLocationLayer = currentLocationLayerRef.current;

    if (!L || !map || !markersLayer || !routeLayer || !selectionRouteLayer || !currentLocationLayer) return;

    const renderVersion = Date.now();
    routeRenderVersionRef.current = renderVersion;
    markersLayer.clearLayers();
    routeLayer.clearLayers();
    selectionRouteLayer.clearLayers();
    currentLocationLayer.clearLayers();

    const bounds = [];
    const routePromises = [];

    rides.forEach((ride) => {
      const hasFrom = Array.isArray(ride.fromCoords) && ride.fromCoords.length === 2;
      const hasTo = Array.isArray(ride.toCoords) && ride.toCoords.length === 2;

      if (hasFrom) {
        const fromMarker = L.marker(ride.fromCoords).bindPopup(
          `<strong>From:</strong> ${ride.from}<br/><strong>Driver:</strong> ${ride.driver}`
        );
        markersLayer.addLayer(fromMarker);
        bounds.push(ride.fromCoords);
      }

      if (hasTo) {
        const toMarker = L.marker(ride.toCoords).bindPopup(
          `<strong>To:</strong> ${ride.to}<br/><strong>Seats:</strong> ${ride.seats}`
        );
        markersLayer.addLayer(toMarker);
        bounds.push(ride.toCoords);
      }

      if (hasFrom && hasTo) {
        routePromises.push(
          fetchDrivingRouteCoords(ride.fromCoords, ride.toCoords)
            .then((pathCoords) => {
              if (!mapRef.current || routeRenderVersionRef.current !== renderVersion) return;
              routeLayer.addLayer(
                L.polyline(pathCoords || [ride.fromCoords, ride.toCoords], {
                  color: "#f4a261",
                  weight: 4,
                  opacity: 0.8,
                })
              );
            })
            .catch(() => {
              if (!mapRef.current || routeRenderVersionRef.current !== renderVersion) return;
              routeLayer.addLayer(
                L.polyline([ride.fromCoords, ride.toCoords], {
                  color: "#f4a261",
                  weight: 4,
                  opacity: 0.8,
                })
              );
            })
        );
      }
    });

    const draftFrom =
      Array.isArray(previewFromCoords) && previewFromCoords.length === 2
        ? previewFromCoords
        : null;
    const draftTo =
      Array.isArray(previewToCoords) && previewToCoords.length === 2 ? previewToCoords : null;

    if (draftFrom && draftTo) {
      routePromises.push(
        fetchDrivingRouteCoords(draftFrom, draftTo)
          .then((pathCoords) => {
            if (!mapRef.current || routeRenderVersionRef.current !== renderVersion) return;
            selectionRouteLayer.addLayer(
              L.polyline(pathCoords || [draftFrom, draftTo], {
                color: "#6366f1",
                weight: 4,
                opacity: 0.9,
                dashArray: "6 8",
              })
            );
          })
          .catch(() => {
            if (!mapRef.current || routeRenderVersionRef.current !== renderVersion) return;
            selectionRouteLayer.addLayer(
              L.polyline([draftFrom, draftTo], {
                color: "#6366f1",
                weight: 4,
                opacity: 0.9,
                dashArray: "6 8",
              })
            );
          })
      );
      bounds.push(draftFrom, draftTo);
    }

    if (currentCoords) {
      const currentMarker = L.circleMarker(currentCoords, {
        radius: 7,
        color: "#2563eb",
        weight: 2,
        fillColor: "#60a5fa",
        fillOpacity: 0.95,
      }).bindPopup("Your current location");
      currentLocationLayer.addLayer(currentMarker);
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30] });
    } else {
      map.setView(DEFAULT_CENTER, 13);
    }

    Promise.allSettled(routePromises);
  }, [rides, previewFromCoords, previewToCoords, currentCoords]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const currentRouteLayer = currentRouteLayerRef.current;
    if (!L || !map || !currentRouteLayer) return;

    currentRouteLayer.clearLayers();

    const destination =
      Array.isArray(routeFromCurrentToCoords) && routeFromCurrentToCoords.length === 2
        ? routeFromCurrentToCoords
        : null;

    if (!currentCoords || !destination) return;

    const drawFallback = () => {
      currentRouteLayer.addLayer(
        L.polyline([currentCoords, destination], {
          color: "#2563eb",
          weight: 5,
          opacity: 0.9,
        })
      );
    };

    const buildRoute = async () => {
      try {
        const pathCoords = await fetchDrivingRouteCoords(currentCoords, destination);
        if (!mapRef.current || !currentRouteLayerRef.current) return;
        if (!Array.isArray(pathCoords) || pathCoords.length < 2) {
          drawFallback();
          return;
        }
        currentRouteLayer.addLayer(
          L.polyline(pathCoords, {
            color: "#2563eb",
            weight: 5,
            opacity: 0.9,
          })
        );
      } catch {
        drawFallback();
      }
    };

    buildRoute();
  }, [currentCoords, routeFromCurrentToCoords]);

  return (
    <div
      ref={containerRef}
      style={{
        height: "min(400px, 60vh)",
        width: "100%",
        borderRadius: "12px",
        overflow: "hidden",
        touchAction: "pan-x pan-y",
      }}
    />
  );
}