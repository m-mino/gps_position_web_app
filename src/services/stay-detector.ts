import type { Stay } from "../types";

export type PositionLike = {
  latitude: number;
  longitude: number;
  recorded_at: string;
};

export class StayDetector {
  constructor(
    private readonly maxDistanceMeters = 50,
    private readonly minDurationSeconds = 300,
  ) {}

  detect(positions: PositionLike[]): Stay[] {
    if (positions.length < 2) {
      return [];
    }

    const sorted = [...positions].sort(
      (a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at),
    );

    const stays: Stay[] = [];
    let cluster: PositionLike[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const previous = cluster[cluster.length - 1];
      const distance = haversineMeters(
        previous.latitude,
        previous.longitude,
        current.latitude,
        current.longitude,
      );

      if (distance <= this.maxDistanceMeters) {
        cluster.push(current);
        continue;
      }

      const stay = this.finalizeCluster(cluster);
      if (stay) {
        stays.push(stay);
      }
      cluster = [current];
    }

    const stay = this.finalizeCluster(cluster);
    if (stay) {
      stays.push(stay);
    }

    return stays;
  }

  private finalizeCluster(cluster: PositionLike[]): Stay | null {
    if (cluster.length < 2) {
      return null;
    }

    const first = cluster[0];
    const last = cluster[cluster.length - 1];
    const startedAt = new Date(first.recorded_at);
    const endedAt = new Date(last.recorded_at);
    const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

    if (durationSeconds < this.minDurationSeconds) {
      return null;
    }

    const latitude =
      cluster.reduce((sum, p) => sum + p.latitude, 0) / cluster.length;
    const longitude =
      cluster.reduce((sum, p) => sum + p.longitude, 0) / cluster.length;

    return {
      latitude: round7(latitude),
      longitude: round7(longitude),
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      duration_seconds: durationSeconds,
    };
  }
}

function round7(value: number): number {
  return Math.round(value * 1e7) / 1e7;
}

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadius = 6_371_000;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(a)));
}

function deg2rad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
