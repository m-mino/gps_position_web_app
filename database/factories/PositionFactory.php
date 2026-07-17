<?php

namespace Database\Factories;

use App\Models\Position;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Position>
 */
class PositionFactory extends Factory
{
    protected $model = Position::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'latitude' => fake()->latitude(35.6, 35.8),
            'longitude' => fake()->longitude(139.6, 139.9),
            'accuracy' => fake()->randomFloat(1, 5, 50),
            'recorded_at' => fake()->dateTimeBetween('-1 day', 'now'),
        ];
    }
}
