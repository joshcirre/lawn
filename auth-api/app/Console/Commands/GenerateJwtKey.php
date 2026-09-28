<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('jwt:keygen')]
#[Description('Generate an RS256 signing key and print it as a JWT_PRIVATE_KEY env line')]
class GenerateJwtKey extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $key = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_RSA, 'private_key_bits' => 2048]);

        if ($key === false || ! openssl_pkey_export($key, $pem)) {
            $this->error('Could not generate an RSA key: '.openssl_error_string());

            return self::FAILURE;
        }

        $this->line('JWT_PRIVATE_KEY='.base64_encode($pem));

        return self::SUCCESS;
    }
}
