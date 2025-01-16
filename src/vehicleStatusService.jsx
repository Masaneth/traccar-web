import React, {
  createContext, useState, useEffect, useContext, useRef,
} from 'react';
import { useSelector } from 'react-redux';

export const VehicleStatusContext = createContext(null);

const eventDelay = 300000; // 3 minutos en milisegundos (ajustable)

async function fetchDevices() {
  try {
    const response = await fetch('/api/devices', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    throw Error(error.message);
  }
}

async function fetchVehicleEvents(deviceId, from, to) {
  try {
    const response = await fetch(`/api/reports/events?from=${from}&to=${to}&deviceId=${deviceId}&type=deviceMoving&type=deviceStopped`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    throw Error(error.message);
  }
}

function formatDuration(durationMs) {
  const duration = Math.floor(durationMs / 1000);
  const days = Math.floor(duration / 86400);
  const hours = Math.floor((duration % 86400) / 3600);
  const minutes = Math.floor((duration % 3600) / 60);

  return [
    days > 0 ? `${days}d` : null,
    hours > 0 ? `${hours}h` : null,
    minutes > 0 ? `${minutes}m` : null,
  ]
    .filter((part) => part !== null)
    .join(' ');
}

async function initializeVehicleStates(devices) {
  const currentTime = new Date().toISOString();
  const timeRanges = [
    {
      label: '24 hours',
      pastTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      label: '7 days',
      pastTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      label: '1 month',
      pastTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const vehicles = {};
  await Promise.all(devices.map(async (device) => {
    const deviceId = device.id;
    vehicles[deviceId] = {
      isMoving: false,
      lastStateChange: Date.now(),
      stateDuration: 0,
      name: device.name,
    };

    const events = await timeRanges.reduce(async (prevPromise, range) => {
      const prevEvents = await prevPromise;
      if (prevEvents && prevEvents.length > 0) {
        return prevEvents;
      }
      const newEvents = await fetchVehicleEvents(deviceId, range.pastTime, currentTime);
      return newEvents && newEvents.length > 0 ? newEvents : prevEvents;
    }, Promise.resolve([]));

    if (events && events.length > 0) {
      events.sort((a, b) => new Date(a.eventTime) - new Date(b.eventTime));
      const lastEvent = events[events.length - 1];
      const lastState = lastEvent.type;
      const lastStateStartTime = new Date(lastEvent.eventTime).getTime();

      if (lastState === 'deviceStopped') {
        vehicles[deviceId].isMoving = false;
        vehicles[deviceId].lastStateChange = lastStateStartTime - eventDelay;
        vehicles[deviceId].stateDuration = Date.now() - vehicles[deviceId].lastStateChange;
      } else {
        vehicles[deviceId].isMoving = true;
        vehicles[deviceId].lastStateChange = lastStateStartTime;
        vehicles[deviceId].stateDuration = Date.now() - vehicles[deviceId].lastStateChange;
      }
    } else {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).getTime();
      vehicles[deviceId].lastStateChange = thirtyDaysAgo;
      vehicles[deviceId].stateDuration = Date.now() - thirtyDaysAgo;
      vehicles[deviceId].isMoving = false;
    }

    vehicles[deviceId].stateDuration = formatDuration(vehicles[deviceId].stateDuration);
  }));

  return vehicles;
}

export const VehicleStatusProvider = ({ children }) => {
  const [vehicleData, setVehicleData] = useState({});
  const websocketData = useSelector((state) => state.events.items); // Obteniendo los eventos del WebSocket
  const initializedRef = useRef(false);

  useEffect(() => {
    const initializeService = async () => {
      if (!initializedRef.current) {
        const devices = await fetchDevices(); // Obteniendo los dispositivos
        const initialVehicles = await initializeVehicleStates(devices); // Inicializando estados
        setVehicleData(initialVehicles);
        initializedRef.current = true;
      }
    };

    initializeService();
  }, []);

  useEffect(() => {
    if (websocketData && websocketData.length > 0) {
      // Crear un mapa de eventos más recientes para cada dispositivo
      const latestEvents = websocketData.reduce((acc, event) => {
        const { deviceId } = event;
        if (!acc[deviceId] || new Date(event.eventTime) > new Date(acc[deviceId].eventTime)) {
          acc[deviceId] = event;
        }
        return acc;
      }, {});

      // Actualizar el estado de vehicleData basado en los eventos más recientes
      setVehicleData((prevState) => {
        const updatedData = { ...prevState };

        Object.values(latestEvents).forEach((event) => {
          const { deviceId } = event;
          const currentTime = Date.now();
          const vehicle = updatedData[deviceId] || {
            isMoving: false,
            lastStateChange: currentTime,
          };

          let stateChanged = false;

          if (event.type === 'deviceStopped') {
            if (vehicle.isMoving) {
              vehicle.isMoving = false;
              vehicle.lastStateChange = currentTime - eventDelay;
              stateChanged = true;
            }
          } else if (event.type === 'deviceMoving') {
            if (!vehicle.isMoving) {
              vehicle.isMoving = true;
              vehicle.lastStateChange = currentTime;
              stateChanged = true;
            }
          }

          if (stateChanged) {
            vehicle.stateDurationMs = currentTime - vehicle.lastStateChange;
            updatedData[deviceId] = vehicle;
          }
        });

        return updatedData;
      });
    }

    // Actualización periódica del estado de duración
    const intervalId = setInterval(() => {
      setVehicleData((prevState) => {
        const updatedData = { ...prevState };

        Object.entries(updatedData).forEach(([deviceId, vehicle]) => {
          const currentTime = Date.now();
          updatedData[deviceId].stateDurationMs = currentTime - vehicle.lastStateChange;
        });

        return updatedData;
      });
    }, 60000);

    return () => clearInterval(intervalId);
  }, [websocketData]); // Ejecuta este efecto cada vez que websocketData cambie

  return (
    <VehicleStatusContext.Provider value={vehicleData}>
      {children}
    </VehicleStatusContext.Provider>
  );
};

export const useVehicleStatus = (deviceId) => {
  const vehicleData = useContext(VehicleStatusContext);
  const vehicle = vehicleData[deviceId] || null;

  if (vehicle) {
    const currentTime = Date.now();
    const formattedDuration = formatDuration(currentTime - vehicle.lastStateChange);
    return {
      ...vehicle,
      stateDuration: formattedDuration,
    };
  }

  return null;
};
