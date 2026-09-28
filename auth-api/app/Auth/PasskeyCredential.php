<?php

namespace App\Auth;

use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Laravel\Passkeys\Support\WebAuthn;
use Throwable;
use Webauthn\PublicKeyCredential;

class PasskeyCredential
{
    /**
     * Validation rules for the browser's PublicKeyCredential JSON.
     *
     * @return array<string, list<string>>
     */
    public static function rules(): array
    {
        return [
            'ceremony' => ['required', 'string'],
            'credential' => ['required', 'array'],
            'credential.id' => ['required', 'string'],
            'credential.rawId' => ['required', 'string'],
            'credential.type' => ['required', 'string', 'in:public-key'],
            'credential.response' => ['required', 'array'],
        ];
    }

    public static function fromRequest(Request $request): PublicKeyCredential
    {
        try {
            return WebAuthn::fromJson(json_encode($request->input('credential')) ?: '{}', PublicKeyCredential::class);
        } catch (Throwable) {
            throw ValidationException::withMessages([
                'credential' => __('Invalid credential format.'),
            ]);
        }
    }
}
