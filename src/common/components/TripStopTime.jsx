import React, { useState, useEffect } from 'react';
import { Typography } from '@mui/material';

const TripStopTime = ({ deviceId, speed }) => {
  const [timeStopped, setTimeStopped] = useState(null);
  const [timeMoving, setTimeMoving] = useState(null);
  const [loading, setLoading] = useState(false);

  const toISOWithTimezone = (date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date.getTime() - tzOffset).toISOString();
    return `${localISOTime.slice(0, -1)}Z`; // Ensure it ends with 'Z' to indicate UTC
  };

  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    return `${hours}h ${minutes}m`;
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 1);

        const toMadridTime = toISOWithTimezone(to);
        const fromMadridTime = toISOWithTimezone(from);

        const isStopped = speed < 2;
        // console.log('¿Está parado?', isStopped);

        if (isStopped) {
          const stopResponse = await fetch(`/api/reports/stops?from=${fromMadridTime}&to=${toMadridTime}&deviceId=${deviceId}`, {
            headers: { Accept: 'application/json' },
          });
          // console.log(`/api/reports/stops?from=${fromMadridTime}&to=${toMadridTime}&deviceId=${deviceId}`);
          if (!stopResponse.ok) {
            throw new Error(`Error fetching stop data: ${await stopResponse.text()}`);
          }

          const stopData = await stopResponse.json();
          // console.log('Datos de la API de paradas:', stopData);

          const lastStop = stopData[stopData.length - 1];
          const { duration } = lastStop;

          setTimeStopped(formatTime(duration));
        } else {
          const tripResponse = await fetch(`/api/reports/trips?from=${fromMadridTime}&to=${toMadridTime}&deviceId=${deviceId}`, {
            headers: { Accept: 'application/json' },
          });

          if (!tripResponse.ok) {
            throw new Error(`Error fetching trip data: ${await tripResponse.text()}`);
          }

          const tripData = await tripResponse.json();
          // console.log('Datos de la API de viajes:', tripData);

          const lastTrip = tripData[tripData.length - 1];
          const { duration } = lastTrip;

          setTimeMoving(formatTime(duration));
        }
      } catch (error) {
        throw new Error(`Error fetching trip data: ${error}`);
      } finally {
        setLoading(false);
      }
    };

    if (deviceId) {
      fetchData();
    }
  }, [deviceId]);

  if (loading) {
    return <Typography variant="body1">Cargando...</Typography>;
  }

  return (
    <div>
      {timeStopped !== null ? (
        <Typography variant="body1">
          Tiempo Parado:
          {' '}
          {timeStopped}
        </Typography>
      ) : (
        <Typography variant="body1">
          Tiempo en Movimiento:
          {' '}
          {timeMoving}
        </Typography>
      )}
    </div>
  );
};

export default TripStopTime;
