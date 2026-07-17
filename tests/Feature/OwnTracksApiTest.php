<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OwnTracksApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_owntracks_accepts_location_with_basic_auth(): void
    {
        $user = User::factory()->create([
            'email' => 'tracker@example.com',
            'password' => 'password',
        ]);

        $response = $this->withBasicAuth('tracker@example.com', 'password')
            ->postJson('/api/owntracks', [
                '_type' => 'location',
                'lat' => 34.6805,
                'lon' => 134.9072,
                'acc' => 12,
                'tst' => 1720000000,
            ]);

        $response->assertOk()->assertExactJson([]);

        $this->assertDatabaseHas('positions', [
            'user_id' => $user->id,
            'latitude' => 34.6805,
            'longitude' => 134.9072,
        ]);
    }

    public function test_owntracks_accepts_bearer_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('owntracks-test')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/owntracks', [
                '_type' => 'location',
                'lat' => 35.0,
                'lon' => 139.0,
                'tst' => 1720000000,
            ])
            ->assertOk();

        $this->assertDatabaseHas('positions', [
            'user_id' => $user->id,
            'latitude' => 35.0,
        ]);
    }

    public function test_owntracks_rejects_unauthenticated_requests(): void
    {
        $this->postJson('/api/owntracks', [
            '_type' => 'location',
            'lat' => 35.0,
            'lon' => 139.0,
            'tst' => 1720000000,
        ])->assertUnauthorized();
    }

    public function test_owntracks_ignores_non_location_payloads(): void
    {
        User::factory()->create([
            'email' => 'tracker@example.com',
            'password' => 'password',
        ]);

        $this->withBasicAuth('tracker@example.com', 'password')
            ->postJson('/api/owntracks', [
                '_type' => 'status',
                'batt' => 80,
            ])
            ->assertOk()
            ->assertExactJson([]);

        $this->assertDatabaseCount('positions', 0);
    }
}
