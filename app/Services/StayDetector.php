<?php

namespace App\Services;

use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

class StayDetector
{
    public function __construct(
        private readonly float $maxDistanceMeters = 50.0,
        private readonly int $minDurationSeconds = 300,
    ) {}

    /**
     * @param  Collection<int, object{latitude: mixed, longitude: mixed, recorded_at: mixed}>  $positions
     * @return list<array{latitude: float, longitude: float, started_at: string, ended_at: string, duration_seconds: int}>
     */
    public function detect(Collection $positions): array
    {
        if ($positions->count() < 2) {
            return [];
        }

        $sorted = $positions
            ->sortBy(fn (object $position) => $this->asCarbon($position->recorded_at)->timestamp)
            ->values();

        $stays = [];
        $cluster = [$sorted[0]];

        for ($i = 1; $i < $sorted->count(); $i++) {
            $current = $sorted[$i];
            $previous = $cluster[array_key_last($cluster)];

            $distance = $this->haversineMeters(
                (float) $previous->latitude,
                (float) $previous->longitude,
                (float) $current->latitude,
                (float) $current->longitude,
            );

            if ($distance <= $this->maxDistanceMeters) {
                $cluster[] = $current;
                continue;
            }

            $stay = $this->finalizeCluster($cluster);
            if ($stay !== null) {
                $stays[] = $stay;
            }
            $cluster = [$current];
        }

        $stay = $this->finalizeCluster($cluster);
        if ($stay !== null) {
            $stays[] = $stay;
        }

        return $stays;
    }

    /**
     * @param  list<object{latitude: mixed, longitude: mixed, recorded_at: mixed}>  $cluster
     * @return array{latitude: float, longitude: float, started_at: string, ended_at: string, duration_seconds: int}|null
     */
    private function finalizeCluster(array $cluster): ?array
    {
        if (count($cluster) < 2) {
            return null;
        }

        $first = $cluster[0];
        $last = $cluster[array_key_last($cluster)];

        $startedAt = $this->asCarbon($first->recorded_at);
        $endedAt = $this->asCarbon($last->recorded_at);
        $durationSeconds = $startedAt->diffInSeconds($endedAt);

        if ($durationSeconds < $this->minDurationSeconds) {
            return null;
        }

        $latitude = collect($cluster)->avg(fn (object $position) => (float) $position->latitude);
        $longitude = collect($cluster)->avg(fn (object $position) => (float) $position->longitude);

        return [
            'latitude' => round((float) $latitude, 7),
            'longitude' => round((float) $longitude, 7),
            'started_at' => $startedAt->toISOString(),
            'ended_at' => $endedAt->toISOString(),
            'duration_seconds' => (int) $durationSeconds,
        ];
    }

    private function asCarbon(mixed $value): CarbonInterface
    {
        if ($value instanceof CarbonInterface) {
            return $value;
        }

        return Carbon::parse($value);
    }

    private function haversineMeters(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadius = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;

        return 2 * $earthRadius * asin(min(1, sqrt($a)));
    }
}
