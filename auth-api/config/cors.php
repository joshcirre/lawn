<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', '.well-known/*'],

    'allowed_methods' => ['*'],

    // The lawn frontend. Tokens travel in JSON bodies and the Authorization
    // header, never cookies, so credentials support stays off.
    'allowed_origins' => array_filter(explode(',', (string) env('FRONTEND_URL', 'http://localhost:5296'))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
