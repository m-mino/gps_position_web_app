<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\OwnTracksController;
use App\Http\Controllers\Api\PositionController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);

// OwnTracks は Basic 認証のため Sanctum ミドルウェア外で受け付ける
Route::post('/owntracks', [OwnTracksController::class, 'store']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/positions', [PositionController::class, 'store']);
    Route::get('/positions/latest', [PositionController::class, 'latest']);
    Route::get('/positions', [PositionController::class, 'index']);
});
