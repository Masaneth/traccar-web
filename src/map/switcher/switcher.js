import './switcher.css';
import maplibregl from 'maplibre-gl';

export class SwitcherControl {

  constructor(onBeforeSwitch, onSwitch, onAfterSwitch, showMarkerCallback) {
    this.onBeforeSwitch = onBeforeSwitch;
    this.onSwitch = onSwitch;
    this.onAfterSwitch = onAfterSwitch;
    this.showMarkerCallback = showMarkerCallback;
    this.onDocumentClick = this.onDocumentClick.bind(this);
    this.styles = [];
    this.currentStyle = null;
    this.marker = null;
  }

  getDefaultPosition() {
    return 'top-right';
  }

  updateStyles(updatedStyles, defaultStyle) {
    this.styles = updatedStyles;

    let selectedStyle = null;
    for (const style of this.styles) {
      if (style.id === (this.currentStyle || defaultStyle)) {
        selectedStyle = style.id;
        break;
      }
    }
    if (!selectedStyle) {
      selectedStyle = this.styles[0].id;
    }

    while (this.mapStyleContainer.firstChild) {
      this.mapStyleContainer.removeChild(this.mapStyleContainer.firstChild);
    }

    let selectedStyleElement;

    for (const style of this.styles) {
      const styleElement = document.createElement('button');
      styleElement.type = 'button';
      styleElement.innerText = style.title;
      styleElement.dataset.id = style.id;
      styleElement.dataset.style = JSON.stringify(style.style);
      styleElement.addEventListener('click', (event) => {
        const { target } = event;
        if (!target.classList.contains('active')) {
          this.onSelectStyle(target);
        }
      });
      if (style.id === selectedStyle) {
        selectedStyleElement = styleElement;
        styleElement.classList.add('active');
      }
      this.mapStyleContainer.appendChild(styleElement);
    }

    if (this.currentStyle !== selectedStyle) {
      this.onSelectStyle(selectedStyleElement);
      this.currentStyle = selectedStyle;
    }
  }

  onSelectStyle(target) {
    this.onBeforeSwitch();

    const style = this.styles.find((it) => it.id === target.dataset.id);
    this.map.setStyle(style.style, { diff: false });
    this.map.setTransformRequest(style.transformRequest);

    this.onSwitch(target.dataset.id);

    this.mapStyleContainer.style.display = 'none';
    this.styleButton.style.display = 'block';

    const elements = this.mapStyleContainer.getElementsByClassName('active');
    while (elements[0]) {
      elements[0].classList.remove('active');
    }
    target.classList.add('active');

    this.currentStyle = target.dataset.id;

    this.onAfterSwitch();
  }

  onAdd(map) {
    this.map = map;
    this.controlContainer = document.createElement('div');
    this.controlContainer.classList.add('maplibregl-ctrl');
    this.controlContainer.classList.add('maplibregl-ctrl-group');

    this.mapStyleContainer = document.createElement('div');
    this.mapStyleContainer.classList.add('maplibregl-style-list');
    this.controlContainer.appendChild(this.mapStyleContainer);

    this.styleButton = document.createElement('button');
    this.styleButton.type = 'button';
    this.styleButton.classList.add('maplibregl-ctrl-icon');
    this.styleButton.classList.add('maplibregl-style-switcher');
    this.styleButton.addEventListener('click', () => {
      this.styleButton.style.display = 'none';
      this.mapStyleContainer.style.display = 'block';
    });
    this.controlContainer.appendChild(this.styleButton);

    this.markerButton = document.createElement('button');
    this.markerButton.type = 'button';
    this.markerButton.classList.add('maplibregl-ctrl-icon');
    this.markerButton.classList.add('maplibregl-marker-switcher');
    this.markerButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20px" height="20px">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  `;
    this.markerButton.addEventListener('click', () => this.showMarker());
    this.controlContainer.appendChild(this.markerButton);

    document.addEventListener('click', this.onDocumentClick);

    return this.controlContainer;
  }

  onRemove() {
    if (this.controlContainer) {
      this.controlContainer.parentNode.removeChild(this.controlContainer);
      document.removeEventListener('click', this.onDocumentClick);
    }
  }

  onDocumentClick(event) {
    if (!this.controlContainer.contains(event.target)) {
      this.mapStyleContainer.style.display = 'none';
      this.styleButton.style.display = 'block';
    }
  }

  showMarker() {
    if (!this.marker) {
      this.marker = new maplibregl.Marker({ draggable: true })
        .setLngLat(this.map.getCenter())
        .addTo(this.map);
      
      // Manejo del evento 'dragend' para obtener las coordenadas
      this.marker.on('dragend', () => {
        const lngLat = this.marker.getLngLat();
        const coordsText = `${lngLat.lat.toFixed(6)}, ${lngLat.lng.toFixed(6)}`;
        const googleMapsUrl = `https://www.google.com/maps?q=${coordsText}`;

        // Método seguro para copiar en WebView o navegador
        this.copyToClipboard(googleMapsUrl);

        // Mostrar las coordenadas en el Snackbar
        this.showMarkerCallback(coordsText);

        // Ocultar el marcador después de 2 segundos
        setTimeout(() => {
          if (this.marker) {
            this.marker.remove();
            this.marker = null;
          }
        }, 2000);
      });
    } else {
      this.marker.setLngLat(this.map.getCenter());
      this.marker.addTo(this.map);
    }
  }

  // Método alternativo para copiar al portapapeles
  copyToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(err => {
        console.error('Error al copiar en clipboard:', err);
      });
    } else {
      // Fallback para WebView
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';  // Para evitar el desplazamiento en la pantalla
      textArea.style.top = '0';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        console.log('Texto copiado al portapapeles usando fallback.');
      } catch (err) {
        console.error('Error al copiar usando execCommand:', err);
      }
      document.body.removeChild(textArea);
    }
  }
}
