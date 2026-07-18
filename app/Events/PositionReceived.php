<?php

namespace App\Events;

use App\Models\Position;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PositionReceived implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Position $position)
    {
        $this->position->loadMissing('user:id,name');
    }

    /**
     * @return array<int, \Illuminate\Broadcasting\PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('positions'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'position.received';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'user_id' => $this->position->user_id,
            'user_name' => $this->position->user?->name,
            'latitude' => $this->position->latitude,
            'longitude' => $this->position->longitude,
            'accuracy' => $this->position->accuracy,
            'recorded_at' => $this->position->recorded_at?->toISOString(),
        ];
    }
}
