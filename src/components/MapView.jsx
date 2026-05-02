"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export default function MapView({ setFromCoords, setToCoords }) {
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const stepRef = useRef(0); // 0 = FROM, 1 = TO

  useEffect(() => {
    import("leaflet").then((L) => {
      if (mapRef.current) return;

      const map = L.map("map", {
        center: [26.0667, 50.5577],
        zoom: 13,
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          attribution: "&copy; OpenStreetMap & CARTO",
        }
      ).addTo(map);

      // ✅ SAFE ICON
      const icon = L.icon({
        iconUrl: "/pin.png",
        iconSize: [38, 38],
        iconAnchor: [19, 38],
      });

      map.on("click", (e) => {
        const { lat, lng } = e.latlng;

        console.log("📍 Clicked:", lat, lng);

        // remove old marker
        if (markerRef.current) {
          markerRef.current.remove();
        }

        // add new marker
        markerRef.current = L.marker([lat, lng], { icon }).addTo(map);

        // FROM
        if (stepRef.current === 0) {
          setFromCoords([lat, lng]);
          console.log("📍 FROM set");
          stepRef.current = 1;
        }
        // TO
        else {
          setToCoords([lat, lng]);
          console.log("🎯 TO set");
          stepRef.current = 0;
        }
      });

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [setFromCoords, setToCoords]);

  return (
    <div
      id="map"
      style={{
        height: "400px",
        width: "100%",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    />
  );
}