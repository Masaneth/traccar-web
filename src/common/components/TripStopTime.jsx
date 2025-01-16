import React, { useState, useEffect } from 'react';
import { Typography } from '@mui/material';

const TripStopTime = ({ deviceId }) => {
  const [timeStopped, setTimeStopped] = useState(null);
  const [timeMoving, setTimeMoving] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const toISOWithTimezone = (date) => {
    const localISOTime = new Date(date.getTime()).toISOString();
    return `${localISOTime.slice(0, -1)}Z`; // Ensure it ends with 'Z' to indicate UTC
  };

  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours}h ${minutes}m ${seconds}s`;
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

        // Fetch stop data
        const stopResponse = await fetch(`/api/reports/stops?from=${fromMadridTime}&to=${toMadridTime}&deviceId=${deviceId}`, {
          headers: { Accept: 'application/json' },
        });

        if (!stopResponse.ok) {
          throw new Error(`Error fetching stop data: ${await stopResponse.text()}`);
        }

        const stopData = await stopResponse.json();
        const lastStop = stopData[stopData.length - 1];
        const lastStopEndTime = lastStop ? new Date(lastStop.endTime).getTime() : null;
        const durationStopped = lastStop ? lastStop.duration : 0;

        // Fetch trip data
        const tripResponse = await fetch(`/api/reports/trips?from=${fromMadridTime}&to=${toMadridTime}&deviceId=${deviceId}`, {
          headers: { Accept: 'application/json' },
        });

        if (!tripResponse.ok) {
          throw new Error(`Error fetching trip data: ${await tripResponse.text()}`);
        }

        const tripData = await tripResponse.json();
        const lastTrip = tripData[tripData.length - 1];
        const lastTripEndTime = lastTrip ? new Date(lastTrip.endTime).getTime() : null;
        const durationMoving = lastTrip ? lastTrip.duration : 0;

        const now = new Date().getTime();

        let currentStatus = null;
        let time = 0;

        // Determine the most recent end time
        if (lastStopEndTime && (!lastTripEndTime || lastStopEndTime > lastTripEndTime)) {
          currentStatus = 'parado';
          time = now - lastStopEndTime + durationStopped;
          setTimeStopped(formatTime(time));
        } else if (lastTripEndTime) {
          currentStatus = 'en movimiento';
          time = now - lastTripEndTime + durationMoving;
          setTimeMoving(formatTime(time));
        }

        setStatus(currentStatus);
      } catch (error) {
        setTimeStopped('Error al obtener datos');
        setTimeMoving('Error al obtener datos');
        setStatus(null);
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
      {status === 'en movimiento' && timeMoving ? (
        <Typography variant="body1">
          Tiempo en Movimiento:
          {' '}
          {timeMoving}
        </Typography>
      ) : (
        <Typography variant="body1">
          Tiempo Parado:
          {' '}
          {timeStopped}
        </Typography>
      )}
    </div>
  );
};

export default TripStopTime;
