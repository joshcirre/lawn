<?php

use App\Http\Controllers\Api\PasskeyController;
use App\Http\Controllers\Api\PasswordAuthController;
use App\Http\Controllers\Api\TokenController;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:auth')->group(function () {
    Route::post('/register', [PasswordAuthController::class, 'register']);
    Route::post('/login', [PasswordAuthController::class, 'login']);

    Route::post('/passkeys/register/options', [PasskeyController::class, 'registerOptions']);
    Route::post('/passkeys/register', [PasskeyController::class, 'register']);
    Route::post('/passkeys/login/options', [PasskeyController::class, 'loginOptions']);
    Route::post('/passkeys/login', [PasskeyController::class, 'login']);
});

Route::post('/token/refresh', [TokenController::class, 'refresh'])->middleware('throttle:refresh');
Route::post('/logout', [TokenController::class, 'logout']);

Route::middleware('auth:api')->group(function () {
    Route::get('/me', [TokenController::class, 'me']);
    Route::put('/password', [PasswordAuthController::class, 'setPassword']);
    Route::post('/passkeys/options', [PasskeyController::class, 'addOptions']);
    Route::post('/passkeys', [PasskeyController::class, 'add']);
});
