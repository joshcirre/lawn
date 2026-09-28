<?php

namespace App\Http\Controllers\Api;

use App\Auth\PasskeyCeremony;
use App\Auth\PasskeyCredential;
use App\Auth\TokenIssuer;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Passkeys\Actions\GenerateRegistrationOptions;
use Laravel\Passkeys\Actions\GenerateVerificationOptions;
use Laravel\Passkeys\Actions\StorePasskey;
use Laravel\Passkeys\Actions\VerifyPasskey;
use Laravel\Passkeys\Exceptions\InvalidPasskeyException;
use Laravel\Passkeys\Passkeys;
use Laravel\Passkeys\Support\WebAuthn;
use Webauthn\PublicKeyCredentialCreationOptions;
use Webauthn\PublicKeyCredentialRequestOptions;

class PasskeyController extends Controller
{
    public function __construct(private PasskeyCeremony $ceremonies) {}

    /**
     * Start a passkey-first sign-up. The account is only created once the
     * browser returns a valid credential, so abandoned attempts leave no user.
     */
    public function registerOptions(Request $request, GenerateRegistrationOptions $generate): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:users,email'],
        ]);

        $user = new User($validated);
        $user->id = (string) Str::ulid();

        $options = $generate($user);

        return response()->json([
            'ceremony' => $this->ceremonies->start('register', $options, [...$validated, 'id' => $user->id]),
            'options' => WebAuthn::toBrowserArray($options),
        ]);
    }

    public function register(Request $request, StorePasskey $store, TokenIssuer $tokens): JsonResponse
    {
        $request->validate([...PasskeyCredential::rules(), 'passkey_name' => ['nullable', 'string', 'max:255']]);

        [$options, $pending] = $this->ceremonies->pull('register', $request->input('ceremony'), PublicKeyCredentialCreationOptions::class);
        $credential = PasskeyCredential::fromRequest($request);

        try {
            $user = DB::transaction(function () use ($pending, $store, $credential, $options, $request) {
                $user = new User(['name' => $pending['name'], 'email' => $pending['email']]);
                $user->id = $pending['id'];
                $user->save();

                $store($user, $request->input('passkey_name') ?: 'Passkey', $credential, $options);

                return $user;
            });
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages([
                'email' => __('validation.unique', ['attribute' => 'email']),
            ]);
        }

        return response()->json($tokens->issue($user), 201);
    }

    public function loginOptions(GenerateVerificationOptions $generate): JsonResponse
    {
        // No user: allowCredentials stays empty so the browser offers any
        // discoverable passkey for this site (no email field needed).
        $options = $generate();

        return response()->json([
            'ceremony' => $this->ceremonies->start('login', $options),
            'options' => WebAuthn::toBrowserArray($options),
        ]);
    }

    public function login(Request $request, VerifyPasskey $verify, TokenIssuer $tokens): JsonResponse
    {
        $request->validate(PasskeyCredential::rules());

        [$options] = $this->ceremonies->pull('login', $request->input('ceremony'), PublicKeyCredentialRequestOptions::class);

        $passkey = $verify(PasskeyCredential::fromRequest($request), $options);

        if (! Passkeys::allowsLogin($request, $passkey)) {
            throw InvalidPasskeyException::make('Unable to sign in with this account.');
        }

        return response()->json($tokens->issue($passkey->user));
    }

    /**
     * Add another passkey to the signed-in account (e.g. a password user).
     */
    public function addOptions(Request $request, GenerateRegistrationOptions $generate): JsonResponse
    {
        $options = $generate($request->user());

        return response()->json([
            'ceremony' => $this->ceremonies->start('add', $options, ['user' => $request->user()->id]),
            'options' => WebAuthn::toBrowserArray($options),
        ]);
    }

    public function add(Request $request, StorePasskey $store): JsonResponse
    {
        $request->validate([...PasskeyCredential::rules(), 'passkey_name' => ['nullable', 'string', 'max:255']]);

        [$options, $context] = $this->ceremonies->pull('add', $request->input('ceremony'), PublicKeyCredentialCreationOptions::class);

        if ($context['user'] !== $request->user()->id) {
            throw InvalidPasskeyException::make();
        }

        $passkey = $store($request->user(), $request->input('passkey_name') ?: 'Passkey', PasskeyCredential::fromRequest($request), $options);

        return response()->json([
            'passkey' => ['id' => $passkey->id, 'name' => $passkey->name],
            'user' => $request->user()->toProfile(),
        ], 201);
    }
}
