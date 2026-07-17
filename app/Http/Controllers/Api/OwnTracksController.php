<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\PersonalAccessToken;

class OwnTracksController extends Controller
{
    /**
     * OwnTracks (Android) HTTPモードからの位置受信。
     * Basic認証（email:password）または Bearer トークンに対応。
     */
    public function store(Request $request): JsonResponse
    {
        $user = $this->authenticate($request);

        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated.'], 401)
                ->header('WWW-Authenticate', 'Basic realm="GPS Position"');
        }

        $payload = $request->json()->all();

        if ($payload === []) {
            return response()->json([]);
        }

        // 単一オブジェクト or 配列の両方に対応
        $items = array_is_list($payload) ? $payload : [$payload];

        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }

            if (($item['_type'] ?? null) !== 'location') {
                continue;
            }

            if (! isset($item['lat'], $item['lon'], $item['tst'])) {
                continue;
            }

            $user->positions()->create([
                'latitude' => (float) $item['lat'],
                'longitude' => (float) $item['lon'],
                'accuracy' => isset($item['acc']) ? (float) $item['acc'] : null,
                'recorded_at' => Carbon::createFromTimestamp((int) $item['tst']),
            ]);
        }

        // OwnTracks は空配列レスポンスを期待する
        return response()->json([]);
    }

    private function authenticate(Request $request): ?User
    {
        $bearer = $request->bearerToken();

        if (is_string($bearer) && $bearer !== '') {
            $accessToken = PersonalAccessToken::findToken($bearer);

            if ($accessToken?->tokenable instanceof User) {
                return $accessToken->tokenable;
            }

            return null;
        }

        $email = $request->getUser();
        $password = $request->getPassword();

        if (! is_string($email) || ! is_string($password) || $email === '' || $password === '') {
            return null;
        }

        /** @var User|null $user */
        $user = User::query()->where('email', $email)->first();

        if (! $user || ! Hash::check($password, $user->password)) {
            return null;
        }

        return $user;
    }
}
