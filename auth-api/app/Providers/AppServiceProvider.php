<?php

namespace App\Providers;

use App\Auth\JwtSigner;
use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Passkeys\Passkeys;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(JwtSigner::class);

        // The package's routes rely on the web session; the frontend is on
        // another site, so routes/api.php drives its actions statelessly.
        Passkeys::ignoreRoutes();
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Auth::viaRequest('jwt', function (Request $request): ?User {
            $token = $request->bearerToken();
            $claims = $token ? app(JwtSigner::class)->verify($token) : null;

            return $claims ? User::find($claims->sub) : null;
        });

        RateLimiter::for('auth', fn (Request $request) => array_filter([
            Limit::perMinute(10)->by('ip:'.$request->ip()),
            // Passkey requests carry no email; only password guesses are keyed by account.
            $request->filled('email') ? Limit::perMinute(5)->by('email:'.strtolower((string) $request->input('email'))) : null,
        ]));

        RateLimiter::for('refresh', fn (Request $request) => Limit::perMinute(30)->by($request->ip()));
    }
}
