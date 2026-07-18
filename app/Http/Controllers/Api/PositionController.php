<?php

namespace App\Http\Controllers\Api;

use App\Events\PositionReceived;
use App\Http\Controllers\Controller;
use App\Models\Position;
use App\Services\StayDetector;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PositionController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', 'min:0'],
            'recorded_at' => ['required', 'date'],
        ]);

        $position = $request->user()->positions()->create($data);

        PositionReceived::dispatch($position);

        return response()->json([
            'data' => $this->transform($position),
        ], 201);
    }

    public function latest(): JsonResponse
    {
        $positions = Position::query()
            ->with('user:id,name')
            ->orderByDesc('recorded_at')
            ->orderByDesc('id')
            ->get()
            ->unique('user_id')
            ->values()
            ->sortBy('user_id')
            ->values();

        return response()->json([
            'data' => $positions->map(fn (Position $position) => [
                'user_id' => $position->user_id,
                'user_name' => $position->user?->name,
                'latitude' => $position->latitude,
                'longitude' => $position->longitude,
                'accuracy' => $position->accuracy,
                'recorded_at' => $position->recorded_at?->toISOString(),
            ]),
        ]);
    }

    public function index(Request $request, StayDetector $stayDetector): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', Rule::exists('users', 'id')],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $from = isset($data['from'])
            ? Carbon::parse($data['from'], config('app.timezone'))->startOfDay()
            : now()->subDay();
        $to = isset($data['to'])
            ? Carbon::parse($data['to'], config('app.timezone'))->endOfDay()
            : now();

        $positions = Position::query()
            ->where('user_id', $data['user_id'])
            ->whereBetween('recorded_at', [$from, $to])
            ->orderBy('recorded_at')
            ->get();

        return response()->json([
            'data' => $positions->map(fn (Position $position) => $this->transform($position)),
            'stays' => $stayDetector->detect($positions),
            'meta' => [
                'from' => $from->toIso8601String(),
                'to' => $to->toIso8601String(),
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function transform(Position $position): array
    {
        return [
            'id' => $position->id,
            'user_id' => $position->user_id,
            'latitude' => $position->latitude,
            'longitude' => $position->longitude,
            'accuracy' => $position->accuracy,
            'recorded_at' => $position->recorded_at?->toISOString(),
        ];
    }
}
