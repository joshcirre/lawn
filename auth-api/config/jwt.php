<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Signing Key
    |--------------------------------------------------------------------------
    |
    | RS256 private key (PEM), base64-encoded so it fits in one env var.
    | Generate one with `php artisan jwt:keygen`. The public half is served
    | at /.well-known/jwks.json for Convex (and anything else) to verify.
    |
    */

    'private_key' => env('JWT_PRIVATE_KEY'),

    /*
    |--------------------------------------------------------------------------
    | Claims
    |--------------------------------------------------------------------------
    |
    | Convex's customJwt provider must be configured with the same issuer
    | and applicationID (audience).
    |
    */

    'issuer' => env('JWT_ISSUER', env('APP_URL')),

    'audience' => env('JWT_AUDIENCE', 'convex'),

    /*
    |--------------------------------------------------------------------------
    | Lifetimes
    |--------------------------------------------------------------------------
    |
    | Access tokens are short-lived; the Convex client refreshes them through
    | the rotating refresh token before they expire.
    |
    */

    'access_ttl' => (int) env('JWT_ACCESS_TTL', 900),

    'refresh_ttl' => (int) env('JWT_REFRESH_TTL', 60 * 60 * 24 * 30),

];
