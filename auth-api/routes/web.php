<?php

use App\Http\Controllers\Api\TokenController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json(['service' => config('app.name')]));

Route::get('/.well-known/jwks.json', [TokenController::class, 'jwks']);
