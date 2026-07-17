<?php

namespace Tests\Feature;

use App\Models\Position;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PositionApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_store_position(): void
    {
        $this->postJson('/api/positions', [
            'latitude' => 35.681236,
            'longitude' => 139.767125,
            'recorded_at' => now()->toIso8601String(),
        ])->assertUnauthorized();
    }

    public function test_authenticated_user_can_store_position(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/positions', [
            'latitude' => 35.681236,
            'longitude' => 139.767125,
            'accuracy' => 12.5,
            'recorded_at' => '2026-07-16T12:00:00+09:00',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.user_id', $user->id)
            ->assertJsonPath('data.latitude', 35.681236);

        $this->assertDatabaseHas('positions', [
            'user_id' => $user->id,
            'latitude' => 35.681236,
            'longitude' => 139.767125,
        ]);
    }

    public function test_api_login_issues_token_and_allows_position_store(): void
    {
        $user = User::factory()->create([
            'email' => 'android@example.com',
            'password' => 'password',
        ]);

        $login = $this->postJson('/api/login', [
            'email' => 'android@example.com',
            'password' => 'password',
            'device_name' => 'test-device',
        ]);

        $login->assertOk()->assertJsonStructure(['token', 'user' => ['id', 'name', 'email']]);

        $token = $login->json('token');

        $this->withToken($token)
            ->postJson('/api/positions', [
                'latitude' => 35.68,
                'longitude' => 139.76,
                'recorded_at' => now()->toIso8601String(),
            ])
            ->assertCreated();

        $this->assertDatabaseHas('positions', [
            'user_id' => $user->id,
        ]);
    }

    public function test_latest_returns_newest_position_per_user(): void
    {
        $userA = User::factory()->create(['name' => 'User A']);
        $userB = User::factory()->create(['name' => 'User B']);

        Position::factory()->create([
            'user_id' => $userA->id,
            'latitude' => 35.0,
            'longitude' => 139.0,
            'recorded_at' => now()->subHour(),
        ]);
        Position::factory()->create([
            'user_id' => $userA->id,
            'latitude' => 35.1,
            'longitude' => 139.1,
            'recorded_at' => now(),
        ]);
        Position::factory()->create([
            'user_id' => $userB->id,
            'latitude' => 36.0,
            'longitude' => 140.0,
            'recorded_at' => now(),
        ]);

        Sanctum::actingAs($userA);

        $this->getJson('/api/positions/latest')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonFragment([
                'user_id' => $userA->id,
                'user_name' => 'User A',
                'latitude' => 35.1,
            ])
            ->assertJsonFragment([
                'user_id' => $userB->id,
                'user_name' => 'User B',
                'latitude' => 36.0,
            ]);
    }

    public function test_history_returns_positions_for_user_in_range(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        Position::factory()->create([
            'user_id' => $user->id,
            'latitude' => 35.2,
            'longitude' => 139.2,
            'recorded_at' => now()->subHours(2),
        ]);
        Position::factory()->create([
            'user_id' => $user->id,
            'latitude' => 35.3,
            'longitude' => 139.3,
            'recorded_at' => now()->subHour(),
        ]);
        Position::factory()->create([
            'user_id' => $other->id,
            'recorded_at' => now()->subHour(),
        ]);
        Position::factory()->create([
            'user_id' => $user->id,
            'recorded_at' => now()->subDays(2),
        ]);

        Sanctum::actingAs($user);

        $this->getJson('/api/positions?user_id='.$user->id)
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.latitude', 35.2)
            ->assertJsonPath('data.1.latitude', 35.3)
            ->assertJsonStructure(['stays', 'meta' => ['from', 'to']]);
    }

    public function test_history_can_be_filtered_by_date(): void
    {
        $user = User::factory()->create();

        Position::factory()->create([
            'user_id' => $user->id,
            'latitude' => 35.1,
            'longitude' => 139.1,
            'recorded_at' => '2026-07-10 12:00:00',
        ]);
        Position::factory()->create([
            'user_id' => $user->id,
            'latitude' => 35.2,
            'longitude' => 139.2,
            'recorded_at' => '2026-07-16 09:00:00',
        ]);
        Position::factory()->create([
            'user_id' => $user->id,
            'latitude' => 35.2001,
            'longitude' => 139.2001,
            'recorded_at' => '2026-07-16 10:00:00',
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/positions?user_id='.$user->id.'&from=2026-07-16&to=2026-07-16');

        $response->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonCount(1, 'stays')
            ->assertJsonPath('stays.0.duration_seconds', 3600);
    }

    public function test_web_user_can_access_latest_via_session(): void
    {
        $user = User::factory()->create();
        Position::factory()->create(['user_id' => $user->id]);

        $this->actingAs($user)
            ->getJson('/api/positions/latest')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_store_validates_coordinates(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/positions', [
            'latitude' => 200,
            'longitude' => 139.7,
            'recorded_at' => now()->toIso8601String(),
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['latitude']);
    }
}
