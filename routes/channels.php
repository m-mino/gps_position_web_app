<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('positions', function (User $user) {
    return true;
});
