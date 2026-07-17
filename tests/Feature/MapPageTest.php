<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MapPageTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_is_redirected_from_map(): void
    {
        $this->get('/map')->assertRedirect(route('login'));
    }

    public function test_authenticated_user_can_view_map(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get('/map')
            ->assertOk()
            ->assertSee('位置情報マップ')
            ->assertSee('自分の現在地を共有')
            ->assertSee('開始日')
            ->assertSee('終了日')
            ->assertSee('id="map"', false)
            ->assertSee('data-current-user-id="'.$user->id.'"', false);
    }
}
