<?php

namespace App\Auth;

use App\Models\RefreshToken;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Issues access + refresh token pairs and rotates refresh tokens.
 *
 * Refresh tokens are opaque random strings stored only as SHA-256 hashes.
 * Each use rotates the token; presenting an already-rotated token is treated
 * as theft and revokes every token in that sign-in's family.
 */
class TokenIssuer
{
    public function __construct(private JwtSigner $signer) {}

    /**
     * @return array{accessToken: string, refreshToken: string, expiresIn: int, user: array<string, mixed>}
     */
    public function issue(User $user, ?string $familyId = null): array
    {
        $refreshToken = Str::random(64);

        $user->refreshTokens()->create([
            'family_id' => $familyId ?? (string) Str::ulid(),
            'token_hash' => self::hash($refreshToken),
            'expires_at' => now()->addSeconds(config('jwt.refresh_ttl')),
        ]);

        return [
            'accessToken' => $this->signer->issue($user),
            'refreshToken' => $refreshToken,
            'expiresIn' => config('jwt.access_ttl'),
            'user' => $user->toProfile(),
        ];
    }

    /**
     * Exchange a refresh token for a new pair, or null if it can't be used.
     *
     * @return array{accessToken: string, refreshToken: string, expiresIn: int, user: array<string, mixed>}|null
     */
    public function rotate(string $refreshToken): ?array
    {
        return DB::transaction(function () use ($refreshToken) {
            $token = RefreshToken::query()
                ->where('token_hash', self::hash($refreshToken))
                ->lockForUpdate()
                ->first();

            if (! $token) {
                return null;
            }

            if ($token->rotated_at !== null) {
                $this->revokeFamily($token->family_id);

                return null;
            }

            if (! $token->isUsable()) {
                return null;
            }

            $token->forceFill(['rotated_at' => now()])->save();

            return $this->issue($token->user, $token->family_id);
        });
    }

    public function revoke(string $refreshToken): void
    {
        $token = RefreshToken::query()->where('token_hash', self::hash($refreshToken))->first();

        if ($token) {
            $this->revokeFamily($token->family_id);
        }
    }

    private function revokeFamily(string $familyId): void
    {
        RefreshToken::query()
            ->where('family_id', $familyId)
            ->whereNull('revoked_at')
            ->update(['revoked_at' => now()]);
    }

    private static function hash(string $token): string
    {
        return hash('sha256', $token);
    }
}
