import { useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icon (Leaflet + bundler issue)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const defaultCenter = [28.6139, 77.2090]; // Delhi default

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapPicker({ lat, lng, onLocationSelect }) {
  const hasMarker = lat && lng;
  const center = hasMarker ? [parseFloat(lat), parseFloat(lng)] : defaultCenter;

  const handleClick = useCallback(async (clickLat, clickLng) => {
    // Reverse geocode using free Nominatim API
    let address = '';
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${clickLat}&lon=${clickLng}&format=json`
      );
      const data = await res.json();
      address = data.display_name || '';
    } catch {
      // Geocoding failed — coordinates still captured
    }
    onLocationSelect(clickLat, clickLng, address);
  }, [onLocationSelect]);

  return (
    <div className="map-picker-container">
      <MapContainer
        center={center}
        zoom={hasMarker ? 16 : 12}
        style={{ width: '100%', height: '250px', borderRadius: '8px' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onMapClick={handleClick} />
        {hasMarker && <Marker position={[parseFloat(lat), parseFloat(lng)]} />}
      </MapContainer>
      <p className="map-hint">Click on the map to set the billboard location</p>
    </div>
  );
}
