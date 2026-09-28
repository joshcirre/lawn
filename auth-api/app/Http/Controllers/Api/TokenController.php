<?php

namespace App\Http\Controllers\Api;

use App\Auth\JwtSigner;
use App\Auth\TokenIssuer;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class TokenController extends Controller
{
    public function refresh(Request $request, TokenIssuer $tokens): JsonResponse
    {
        $request->validate(['refresh_token' => ['required', 'string']]);

        $pair = $tokens->rotate($request->input('refresh_token'));

        if (! $pair) {
            return response()->json(['message' => 'Session expired. Please sign in again.'], 401);
        }

        return response()->json($pair);
    }

    public function logout(Request $request, TokenIssuer $tokens): Response
    {
        $request->validate(['refresh_token' => ['required', 'string']]);

        $tokens->revoke($request->input('refresh_token'));

        return response()->noContent();
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $request->user()->toProfile()]);
    }

    public function jwks(JwtSigner $signer): JsonResponse
    {
        return response()->json($signer->jwks())
            ->header('Cache-Control', 'public, max-age=300');
    }
}
