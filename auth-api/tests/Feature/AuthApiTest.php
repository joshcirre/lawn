<?php

namespace Tests\Feature;

use App\Models\User;
use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_password_registration_returns_tokens_and_profile(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.com',
            'password' => 'correct horse battery',
        ]);

        $response->assertCreated()
            ->assertJsonStructure(['accessToken', 'refreshToken', 'expiresIn', 'user' => ['id', 'name', 'email']])
            ->assertJsonPath('user.hasPassword', true)
            ->assertJsonPath('user.passkeyCount', 0);
    }

    public function test_registration_rejects_duplicate_email(): void
    {
        User::factory()->create(['email' => 'ada@example.com']);

        $this->postJson('/api/register', [
            'name' => 'Ada',
            'email' => 'ada@example.com',
            'password' => 'correct horse battery',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_login_with_valid_and_invalid_passwords(): void
    {
        User::factory()->create(['email' => 'ada@example.com', 'password' => 'correct horse battery']);

        $this->postJson('/api/login', ['email' => 'ada@example.com', 'password' => 'wrong'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->postJson('/api/login', ['email' => 'ADA@example.com', 'password' => 'correct horse battery'])
            ->assertOk()
            ->assertJsonStructure(['accessToken', 'refreshToken']);
    }

    public function test_passkey_only_accounts_cannot_log_in_with_a_password(): void
    {
        User::factory()->create(['email' => 'ada@example.com', 'password' => null]);

        $this->postJson('/api/login', ['email' => 'ada@example.com', 'password' => ''])
            ->assertUnprocessable();
        $this->postJson('/api/login', ['email' => 'ada@example.com', 'password' => 'anything'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_access_token_verifies_against_the_published_jwks(): void
    {
        $user = User::factory()->create(['name' => 'Ada', 'email' => 'ada@example.com']);

        $token = $this->postJson('/api/login', ['email' => 'ada@example.com', 'password' => 'password'])
            ->json('accessToken');

        $jwks = $this->getJson('/.well-known/jwks.json')
            ->assertOk()
            ->assertJsonPath('keys.0.alg', 'RS256')
            ->json();

        $claims = JWT::decode($token, JWK::parseKeySet($jwks));

        $this->assertSame($user->id, $claims->sub);
        $this->assertSame(config('jwt.issuer'), $claims->iss);
        $this->assertSame('convex', $claims->aud);
        $this->assertSame('ada@example.com', $claims->email);
        $this->assertSame('Ada', $claims->name);
        $this->assertSame($jwks['keys'][0]['kid'], JWT::jsonDecode(JWT::urlsafeB64Decode(explode('.', $token)[0]))->kid);
    }

    public function test_me_requires_a_valid_bearer_token(): void
    {
        User::factory()->create(['email' => 'ada@example.com']);
        $token = $this->postJson('/api/login', ['email' => 'ada@example.com', 'password' => 'password'])->json('accessToken');

        $this->getJson('/api/me')->assertUnauthorized();
        $this->getJson('/api/me', ['Authorization' => 'Bearer not-a-jwt'])->assertUnauthorized();
        $this->getJson('/api/me', ['Authorization' => "Bearer {$token}"])
            ->assertOk()
            ->assertJsonPath('user.email', 'ada@example.com');
    }

    public function test_refresh_tokens_rotate_and_replay_revokes_the_family(): void
    {
        User::factory()->create(['email' => 'ada@example.com']);
        $first = $this->postJson('/api/login', ['email' => 'ada@example.com', 'password' => 'password'])->json('refreshToken');

        $second = $this->postJson('/api/token/refresh', ['refresh_token' => $first])
            ->assertOk()
            ->json('refreshToken');
        $this->assertNotSame($first, $second);

        // Replaying the rotated token is treated as theft...
        $this->postJson('/api/token/refresh', ['refresh_token' => $first])->assertUnauthorized();

        // ...and kills the token that legitimately replaced it.
        $this->postJson('/api/token/refresh', ['refresh_token' => $second])->assertUnauthorized();
    }

    public function test_logout_revokes_the_refresh_token(): void
    {
        User::factory()->create(['email' => 'ada@example.com']);
        $refresh = $this->postJson('/api/login', ['email' => 'ada@example.com', 'password' => 'password'])->json('refreshToken');

        $this->postJson('/api/logout', ['refresh_token' => $refresh])->assertNoContent();
        $this->postJson('/api/token/refresh', ['refresh_token' => $refresh])->assertUnauthorized();
    }

    public function test_expired_refresh_tokens_are_rejected(): void
    {
        User::factory()->create(['email' => 'ada@example.com']);
        $refresh = $this->postJson('/api/login', ['email' => 'ada@example.com', 'password' => 'password'])->json('refreshToken');

        $this->travel(config('jwt.refresh_ttl') + 1)->seconds();

        $this->postJson('/api/token/refresh', ['refresh_token' => $refresh])->assertUnauthorized();
    }

    public function test_passkey_signup_options_are_bound_to_the_frontend_and_create_no_user(): void
    {
        config(['passkeys.relying_party_id' => 'lawn.example.com']);

        $response = $this->postJson('/api/passkeys/register/options', ['name' => 'Ada', 'email' => 'ada@example.com'])
            ->assertOk()
            ->assertJsonStructure(['ceremony', 'options' => ['challenge', 'rp', 'user', 'pubKeyCredParams']])
            ->assertJsonPath('options.rp.id', 'lawn.example.com')
            ->assertJsonPath('options.user.name', 'ada@example.com');

        $this->assertNotEmpty($response->json('ceremony'));
        $this->assertDatabaseCount('users', 0);
    }

    public function test_passkey_signup_rejects_taken_emails_up_front(): void
    {
        User::factory()->create(['email' => 'ada@example.com']);

        $this->postJson('/api/passkeys/register/options', ['name' => 'Ada', 'email' => 'ada@example.com'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_passkey_login_options_allow_any_discoverable_credential(): void
    {
        $this->postJson('/api/passkeys/login/options')
            ->assertOk()
            ->assertJsonStructure(['ceremony', 'options' => ['challenge']])
            ->assertJsonMissingPath('options.allowCredentials.0');
    }

    public function test_passkey_ceremonies_are_single_use(): void
    {
        $ceremony = $this->postJson('/api/passkeys/login/options')->json('ceremony');
        $credential = ['id' => 'abc', 'rawId' => 'abc', 'type' => 'public-key', 'response' => ['clientDataJSON' => 'e30', 'authenticatorData' => 'AA', 'signature' => 'AA']];

        // First use consumes the challenge even though the credential is bogus.
        $this->postJson('/api/passkeys/login', ['ceremony' => $ceremony, 'credential' => $credential])->assertUnprocessable();

        $this->postJson('/api/passkeys/login', ['ceremony' => $ceremony, 'credential' => $credential])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('ceremony');
    }

    public function test_cors_allows_only_the_frontend_origin(): void
    {
        $this->options('/api/login', [], [
            'Origin' => 'http://localhost:5296',
            'Access-Control-Request-Method' => 'POST',
        ])->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5296');

        $evil = $this->options('/api/login', [], [
            'Origin' => 'https://evil.example.com',
            'Access-Control-Request-Method' => 'POST',
        ]);

        $this->assertNotSame('https://evil.example.com', $evil->headers->get('Access-Control-Allow-Origin'));
        $this->assertNotSame('*', $evil->headers->get('Access-Control-Allow-Origin'));
    }
}
