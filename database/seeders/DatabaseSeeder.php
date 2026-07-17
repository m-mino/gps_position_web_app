<?php

namespace Database\Seeders;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $viewer = User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password',
        ]);

        $walker = User::factory()->create([
            'name' => 'Demo Walker',
            'email' => 'walker@example.com',
            'password' => 'password',
        ]);

        $driver = User::factory()->create([
            'name' => 'Demo Driver',
            'email' => 'driver@example.com',
            'password' => 'password',
        ]);

        // 東京駅周辺（Demo Walker）: 今日・昨日・3日前の移動＋滞在
        $this->seedTokyoWalker($walker);

        // 魚住・明石周辺（Demo Driver）: 今日の配送ルート＋滞在
        $this->seedAkashiDriver($driver);

        // Test User: 今日の短い移動＋オフィス滞在
        $this->seedViewer($viewer);
    }

    private function seedTokyoWalker(User $user): void
    {
        $today = now()->startOfDay();

        // 今日: 東京駅 → 丸の内滞在(20分) → 銀座へ移動 → 銀座滞在(45分) → 日本橋へ
        $this->addStay($user, 35.681236, 139.767125, $today->copy()->setTime(9, 0), minutes: 20);
        $this->addPath($user, [
            [35.681236, 139.767125],
            [35.680000, 139.768500],
            [35.678000, 139.770000],
            [35.676000, 139.771500],
            [35.671700, 139.764900],
        ], $today->copy()->setTime(9, 25), intervalMinutes: 3);
        $this->addStay($user, 35.671700, 139.764900, $today->copy()->setTime(9, 40), minutes: 45);
        $this->addPath($user, [
            [35.671700, 139.764900],
            [35.673500, 139.768000],
            [35.680000, 139.772000],
            [35.683000, 139.775000],
        ], $today->copy()->setTime(10, 30), intervalMinutes: 4);

        // 昨日: 皇居周辺の周回＋滞在
        $yesterday = now()->subDay()->startOfDay();
        $this->addStay($user, 35.685175, 139.752800, $yesterday->copy()->setTime(11, 0), minutes: 30);
        $this->addPath($user, [
            [35.685175, 139.752800],
            [35.688000, 139.750000],
            [35.690500, 139.753500],
            [35.687000, 139.757000],
            [35.683500, 139.754500],
        ], $yesterday->copy()->setTime(11, 35), intervalMinutes: 5);
        $this->addStay($user, 35.683500, 139.754500, $yesterday->copy()->setTime(12, 5), minutes: 15);

        // 3日前: 浅草周辺
        $threeDaysAgo = now()->subDays(3)->startOfDay();
        $this->addStay($user, 35.714765, 139.796655, $threeDaysAgo->copy()->setTime(14, 0), minutes: 25);
        $this->addPath($user, [
            [35.714765, 139.796655],
            [35.712500, 139.795000],
            [35.710800, 139.793500],
            [35.711200, 139.796800],
        ], $threeDaysAgo->copy()->setTime(14, 30), intervalMinutes: 4);
        $this->addStay($user, 35.711200, 139.796800, $threeDaysAgo->copy()->setTime(14, 50), minutes: 40);
    }

    private function seedAkashiDriver(User $user): void
    {
        $today = now()->startOfDay();

        // 魚住城跡付近で滞在 → 江井ヶ島方面へ移動 → 滞在 → 赤根川方面へ
        $this->addStay($user, 34.68050, 134.90720, $today->copy()->setTime(8, 30), minutes: 18);
        $this->addPath($user, [
            [34.68050, 134.90720],
            [34.68120, 134.90800],
            [34.68200, 134.90900],
            [34.68300, 134.91050],
            [34.68400, 134.91180],
        ], $today->copy()->setTime(8, 55), intervalMinutes: 3);
        $this->addStay($user, 34.68400, 134.91180, $today->copy()->setTime(9, 15), minutes: 35);
        $this->addPath($user, [
            [34.68400, 134.91180],
            [34.68320, 134.91000],
            [34.68200, 134.90850],
            [34.68080, 134.90750],
            [34.67950, 134.90680],
        ], $today->copy()->setTime(10, 0), intervalMinutes: 3);
        $this->addStay($user, 34.67950, 134.90680, $today->copy()->setTime(10, 20), minutes: 12);

        // 昨日の別ルート
        $yesterday = now()->subDay()->startOfDay();
        $this->addStay($user, 34.67800, 134.90500, $yesterday->copy()->setTime(13, 0), minutes: 50);
        $this->addPath($user, [
            [34.67800, 134.90500],
            [34.67900, 134.90650],
            [34.68000, 134.90800],
            [34.68150, 134.90950],
        ], $yesterday->copy()->setTime(14, 0), intervalMinutes: 5);
    }

    private function seedViewer(User $user): void
    {
        $today = now()->startOfDay();

        $this->addStay($user, 35.658034, 139.701636, $today->copy()->setTime(8, 0), minutes: 60);
        $this->addPath($user, [
            [35.658034, 139.701636],
            [35.660000, 139.705000],
            [35.662500, 139.710000],
            [35.665000, 139.715000],
            [35.668000, 139.720000],
        ], $today->copy()->setTime(9, 10), intervalMinutes: 4);
        $this->addStay($user, 35.668000, 139.720000, $today->copy()->setTime(9, 35), minutes: 22);
    }

    /**
     * 同一地点付近に一定時間滞在する点列を追加（滞在検出用）
     */
    private function addStay(User $user, float $latitude, float $longitude, Carbon $startedAt, int $minutes): void
    {
        $interval = max(1, (int) floor($minutes / 6));
        $steps = max(2, (int) floor($minutes / $interval));

        for ($i = 0; $i <= $steps; $i++) {
            $user->positions()->create([
                'latitude' => $latitude + (mt_rand(-8, 8) / 1000000),
                'longitude' => $longitude + (mt_rand(-8, 8) / 1000000),
                'accuracy' => 8.0 + (mt_rand(0, 20) / 10),
                'recorded_at' => $startedAt->copy()->addMinutes($i * $interval),
            ]);
        }
    }

    /**
     * 経路上の移動点列を追加
     *
     * @param  list<array{0: float, 1: float}>  $points
     */
    private function addPath(User $user, array $points, Carbon $startedAt, int $intervalMinutes): void
    {
        foreach ($points as $index => [$latitude, $longitude]) {
            // 通過点間を補間して軌跡をなめらかにする
            if ($index > 0) {
                [$prevLat, $prevLng] = $points[$index - 1];
                foreach ([0.33, 0.66] as $ratio) {
                    $user->positions()->create([
                        'latitude' => $prevLat + (($latitude - $prevLat) * $ratio),
                        'longitude' => $prevLng + (($longitude - $prevLng) * $ratio),
                        'accuracy' => 12.0,
                        'recorded_at' => $startedAt->copy()->addMinutes(
                            (($index - 1) * $intervalMinutes) + (int) round($intervalMinutes * $ratio)
                        ),
                    ]);
                }
            }

            $user->positions()->create([
                'latitude' => $latitude,
                'longitude' => $longitude,
                'accuracy' => 10.0,
                'recorded_at' => $startedAt->copy()->addMinutes($index * $intervalMinutes),
            ]);
        }
    }
}
