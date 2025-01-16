// eslint-disable-next-line import/no-unresolved
import mapboxglRtlTextUrl from '@mapbox/mapbox-gl-rtl-text/mapbox-gl-rtl-text.min?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import { googleProtocol } from 'maplibre-google-maps';
import React, {
  useRef, useLayoutEffect, useEffect, useState,
} from 'react';
import { Snackbar } from '@mui/material';
import { SwitcherControl } from '../switcher/switcher';
import { useAttributePreference, usePreference } from '../../common/util/preferences';
import usePersistedState, { savePersistedState } from '../../common/util/usePersistedState';
import { mapImages } from './preloadImages';
import useMapStyles from './useMapStyles';
import { snackBarDurationLongMs } from '../../common/util/duration';

const element = document.createElement('div');
element.style.width = '100%';
element.style.height = '100%';
element.style.boxSizing = 'initial';

maplibregl.setRTLTextPlugin(mapboxglRtlTextUrl);
maplibregl.addProtocol('google', googleProtocol);

export const map = new maplibregl.Map({
  container: element,
});

let controlsAdded = false;
let ready = false;
const readyListeners = new Set();

const addReadyListener = (listener) => {
  readyListeners.add(listener);
  listener(ready);
};

const removeReadyListener = (listener) => {
  readyListeners.delete(listener);
};

const updateReadyValue = (value) => {
  ready = value;
  readyListeners.forEach((listener) => listener(value));
};

const initMap = async () => {
  if (ready) return;
  if (!map.hasImage('background')) {
    Object.entries(mapImages).forEach(([key, value]) => {
      map.addImage(key, value, {
        pixelRatio: window.devicePixelRatio,
      });
    });
  }
  updateReadyValue(true);
};

const MapView = ({ children }) => {
  const containerEl = useRef(null);

  const [mapReady, setMapReady] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [coords, setCoords] = useState('');

  const mapStyles = useMapStyles();
  const activeMapStyles = useAttributePreference('activeMapStyles', 'locationIqStreets,locationIqDark,openFreeMap');
  const [defaultMapStyle] = usePersistedState('selectedMapStyle', usePreference('map', 'locationIqStreets'));
  const mapboxAccessToken = useAttributePreference('mapboxAccessToken');
  const maxZoom = useAttributePreference('web.maxZoom');

  useEffect(() => {
    if (maxZoom) {
      map.setMaxZoom(maxZoom);
    }
  }, [maxZoom]);

  useEffect(() => {
    maplibregl.accessToken = mapboxAccessToken;
  }, [mapboxAccessToken]);

  useEffect(() => {
    if (!controlsAdded) {
      map.addControl(new maplibregl.NavigationControl());

      const switcher = new SwitcherControl(
        () => updateReadyValue(false),
        (styleId) => savePersistedState('selectedMapStyle', styleId),
        () => {
          map.once('styledata', () => {
            const waiting = () => {
              if (!map.loaded()) {
                setTimeout(waiting, 33);
              } else {
                initMap();
              }
            };
            waiting();
          });
        },
        (coordsText) => {
          setCoords(coordsText);
          setSnackbarOpen(true);
        },
      );

      map.addControl(switcher);
      controlsAdded = true;
    }

    const listener = (ready) => setMapReady(ready);
    addReadyListener(listener);
    return () => {
      removeReadyListener(listener);
    };
  }, [mapStyles, defaultMapStyle, activeMapStyles]);

  useEffect(() => {
    const filteredStyles = mapStyles.filter((s) => s.available && activeMapStyles.includes(s.id));
    const styles = filteredStyles.length ? filteredStyles : mapStyles.filter((s) => s.id === 'osm');

    if (controlsAdded) {
      // eslint-disable-next-line no-underscore-dangle
      const switcher = map._controls.find((control) => control instanceof SwitcherControl);
      if (switcher) {
        switcher.updateStyles(styles, defaultMapStyle);
      }
    }
  }, [mapStyles, defaultMapStyle]);

  useLayoutEffect(() => {
    const currentEl = containerEl.current;
    currentEl.appendChild(element);
    map.resize();
    return () => {
      currentEl.removeChild(element);
    };
  }, [containerEl]);

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  return (
    <div style={{ width: '100%', height: '100%' }} ref={containerEl}>
      {mapReady && children}

      <Snackbar
        key={coords}
        open={snackbarOpen}
        message="Link de Google Maps copiado al portapapeles"
        autoHideDuration={snackBarDurationLongMs}
        onClose={handleCloseSnackbar}
      />
    </div>
  );
};

export default MapView;
