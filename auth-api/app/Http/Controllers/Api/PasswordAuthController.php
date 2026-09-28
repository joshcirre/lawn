<?php

namespace App\Http\Controllers\Api;

use App\Auth\TokenIssuer;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class PasswordAuthController extends Controller
{
    public function register(Request $request, TokenIssuer $tokens): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', Password::defaults()],
        ]);

        $user = User::create($validated);

        return response()->json($tokens->issue($user), 201);
    }

    public function login(Request $request, TokenIssuer $tokens): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()->where('email', strtolower($validated['email']))->first();

        // Passkey-only accounts have no password and can never match.
        if (! $user || $user->password === null || ! Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        return response()->json($tokens->issue($user));
    }

    public function setPassword(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'current_password' => [$user->password === null ? 'nullable' : 'required', 'string'],
            'password' => ['required', 'string', Password::defaults()],
        ]);

        if ($user->password !== null && ! Hash::check((string) $request->input('current_password'), $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => __('auth.password'),
            ]);
        }

        $user->forceFill(['password' => $request->input('password')])->save();

        return response()->json(['user' => $user->toProfile()]);
    }
}
