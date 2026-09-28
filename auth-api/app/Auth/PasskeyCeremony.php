<?php

namespace App\Auth;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Passkeys\Support\WebAuthn;

/**
 * Stateless stand-in for laravel/passkeys' session storage.
 *
 * The frontend lives on another site, so there is no session cookie to hold
 * the WebAuthn challenge. Options are cached under a random ceremony id that
 * the client echoes back; pull() makes each challenge single-use.
 */
class PasskeyCeremony
{
    /**
     * @param  array<string, mixed>  $context
     */
    public function start(string $type, object $options, array $context = []): string
    {
        $id = Str::random(40);

        Cache::put($this->key($type, $id), [
            'options' => WebAuthn::toJson($options),
            'context' => $context,
        ], now()->addMilliseconds(config('passkeys.timeout') + 30_000));

        return $id;
    }

    /**
     * @template T of object
     *
     * @param  class-string<T>  $optionsClass
     * @return array{0: T, 1: array<string, mixed>}
     */
    public function pull(string $type, ?string $id, string $optionsClass): array
    {
        $stored = $id ? Cache::pull($this->key($type, $id)) : null;

        if (! $stored) {
            throw ValidationException::withMessages([
                'ceremony' => __('Passkey request expired. Please try again.'),
            ]);
        }

        return [WebAuthn::fromJson($stored['options'], $optionsClass), $stored['context']];
    }

    private function key(string $type, string $id): string
    {
        return "passkey-ceremony:{$type}:{$id}";
    }
}
