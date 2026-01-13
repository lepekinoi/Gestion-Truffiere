import L from 'leaflet';
import { useMapEvents, useMap } from 'react-leaflet';

// Icône personnalisée
export const arbreIcon = L.divIcon({
  className: 'custom-arbre-icon',
  html: `<div style="
    background-color: #27ae60;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Clic sur la carte
export default function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => onMapClick(e.latlng)
  });
  return null;
}

// Contrôle du zoom / centre
export function MapController({ bounds, center, arbrePosition }) {
  const map = useMap();
  const initializedRef = React.useRef(false);

  React.useEffect(() => {
    if (initializedRef.current) return;

    if (arbrePosition) {
      map.setView(arbrePosition, 18);
      initializedRef.current = true;
    } else if (bounds && bounds.length > 0) {
      const leafletBounds = L.latLngBounds(bounds.map(c => [c[0], c[1]]));
      map.fitBounds(leafletBounds, { padding: [50, 50], maxZoom: 18 });
      initializedRef.current = true;
    } else if (center) {
      map.setView(center, 16);
      initializedRef.current = true;
    }
  }, [bounds, center, arbrePosition, map]);

  return null;
}
