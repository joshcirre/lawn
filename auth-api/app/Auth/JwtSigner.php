<?php

namespace App\Auth;

use App\Models\User;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use OpenSSLAsymmetricKey;
use RuntimeException;
use Throwable;

/**
 * Signs and verifies RS256 access tokens for Convex's customJwt provider.
 */
class JwtSigner
{
    private ?OpenSSLAsymmetricKey $privateKey = null;

    public function issue(User $user): string
    {
        $now = time();

        return JWT::encode([
            'iss' => config('jwt.issuer'),
            'aud' => config('jwt.audience'),
            'sub' => $user->id,
            'iat' => $now,
            'exp' => $now + config('jwt.access_ttl'),
            // Convex exposes these on ctx.auth.getUserIdentity().
            'name' => $user->name,
            'email' => $user->email,
        ], $this->privateKey(), 'RS256', $this->keyId());
    }

    /**
     * Return the verified claims, or null for any invalid or expired token.
     */
    public function verify(string $token): ?object
    {
        try {
            $claims = JWT::decode($token, new Key($this->publicKeyPem(), 'RS256'));
        } catch (Throwable) {
            return null;
        }

        if (($claims->iss ?? null) !== config('jwt.issuer') || ($claims->aud ?? null) !== config('jwt.audience')) {
            return null;
        }

        return $claims;
    }

    /**
     * @return array{keys: list<array<string, string>>}
     */
    public function jwks(): array
    {
        $rsa = $this->details()['rsa'];

        return ['keys' => [[
            'kty' => 'RSA',
            'use' => 'sig',
            'alg' => 'RS256',
            'kid' => $this->keyId(),
            'n' => self::base64Url($rsa['n']),
            'e' => self::base64Url($rsa['e']),
        ]]];
    }

    public function keyId(): string
    {
        return substr(self::base64Url(hash('sha256', $this->details()['rsa']['n'], true)), 0, 16);
    }

    private function publicKeyPem(): string
    {
        return $this->details()['key'];
    }

    /**
     * @return array{key: string, rsa: array{n: string, e: string}}
     */
    private function details(): array
    {
        $details = openssl_pkey_get_details($this->privateKey());

        if ($details === false || ! isset($details['rsa'])) {
            throw new RuntimeException('JWT_PRIVATE_KEY is not an RSA key.');
        }

        return $details;
    }

    private function privateKey(): OpenSSLAsymmetricKey
    {
        if ($this->privateKey) {
            return $this->privateKey;
        }

        $encoded = config('jwt.private_key');

        if (! $encoded) {
            throw new RuntimeException('JWT_PRIVATE_KEY is not set. Run `php artisan jwt:keygen`.');
        }

        $key = openssl_pkey_get_private(base64_decode($encoded, true) ?: $encoded);

        if ($key === false) {
            throw new RuntimeException('JWT_PRIVATE_KEY could not be parsed.');
        }

        return $this->privateKey = $key;
    }

    private static function base64Url(string $bytes): string
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }
}
