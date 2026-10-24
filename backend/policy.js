export const STALE_MS = 2500;

export function validateTelemetry(body) {
  if (!body || !['simulator', 'wokwi', 'vision'].includes(body.source)) throw new Error('Invalid source');
  if (body.source === 'vision') {
    if (!Array.isArray(body.detections) || body.detections.length > 100) throw new Error('Invalid detections');
    return {source: body.source, detections: body.detections.map(d => {
      if (typeof d.label !== 'string' || d.label.length > 80 || !Number.isFinite(d.confidence) || d.confidence < 0 || d.confidence > 1 || !['left','center','right'].includes(d.direction)) throw new Error('Invalid detection');
      return {label: d.label, confidence: d.confidence, direction: d.direction};
    })};
  }
  const distances = {};
  for (const direction of ['left','center','right']) {
    const value = body.distances?.[direction];
    if (value !== null && (!Number.isFinite(value) || value < 0.02 || value > 10)) throw new Error('Distances must be null or 0.02–10 metres');
    distances[direction] = value;
  }
  return {source: body.source, distances};
}

export function evaluate(samples, activeSource, now = Date.now()) {
  const sample = samples[activeSource];
  const fresh = sample && now - sample.receivedAt <= STALE_MS;
  if (!fresh) return {level: 'unknown', direction: null, distance: null, pulseMs: 0, message: 'Sensor data unavailable or stale.'};
  const distances = Object.entries(sample.distances).filter(([,d]) => d !== null);
  if (!distances.length) return {level:'unknown', direction:null, distance:null, pulseMs:0, message:'No valid sensor readings.'};
  const [direction, distance] = distances.sort((a,b) => a[1] - b[1])[0];
  const level = distance < 0.7 ? 'danger' : distance < 1.5 ? 'warning' : 'clear';
  return {level, direction, distance, pulseMs: level === 'danger' ? 180 : level === 'warning' ? 600 : 0,
    message: level === 'clear' ? 'No close obstacle in the measured sensor rays; this does not establish a safe path.' : `${level === 'danger' ? 'Stop.' : 'Caution.'} Obstacle ${direction}, ${distance.toFixed(1)} metres.`};
}
