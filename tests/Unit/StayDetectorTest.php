<?php

namespace Tests\Unit;

use App\Services\StayDetector;
use Carbon\Carbon;
use PHPUnit\Framework\TestCase;

class StayDetectorTest extends TestCase
{
    public function test_detects_stay_when_points_remain_nearby(): void
    {
        $detector = new StayDetector(maxDistanceMeters: 50, minDurationSeconds: 300);

        $base = Carbon::parse('2026-07-16 10:00:00');
        $positions = collect([
            $this->position(35.681236, 139.767125, $base),
            $this->position(35.681240, 139.767130, $base->copy()->addMinutes(3)),
            $this->position(35.681250, 139.767140, $base->copy()->addMinutes(6)),
            $this->position(35.690000, 139.780000, $base->copy()->addMinutes(10)),
        ]);

        $stays = $detector->detect($positions);

        $this->assertCount(1, $stays);
        $this->assertSame(360, $stays[0]['duration_seconds']);
        $this->assertEqualsWithDelta(35.681242, $stays[0]['latitude'], 0.0001);
    }

    public function test_ignores_short_clusters(): void
    {
        $detector = new StayDetector(maxDistanceMeters: 50, minDurationSeconds: 300);

        $base = Carbon::parse('2026-07-16 10:00:00');
        $positions = collect([
            $this->position(35.681236, 139.767125, $base),
            $this->position(35.681240, 139.767130, $base->copy()->addMinutes(2)),
        ]);

        $this->assertSame([], $detector->detect($positions));
    }

    private function position(float $latitude, float $longitude, Carbon $recordedAt): object
    {
        return (object) [
            'latitude' => $latitude,
            'longitude' => $longitude,
            'recorded_at' => $recordedAt,
        ];
    }
}
