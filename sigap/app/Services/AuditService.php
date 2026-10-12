<?php

namespace App\Services;

use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

/**
 * Pencatat jejak audit admin (PRD SEC-08).
 *
 * Dipakai bersama jalur Web (Inertia) & API. Kegagalan pencatatan tidak boleh
 * menggagalkan operasi utama, sehingga selalu dibungkus try/catch oleh pemanggil
 * lewat {@see record()}.
 */
class AuditService
{
    /**
     * Catat sebuah tindakan.
     *
     * @param  string  $action  kode aksi, mis. 'ticket.status_changed'
     * @param  array<string, mixed>  $properties
     */
    public function record(
        string $action,
        ?Model $subject = null,
        ?string $description = null,
        array $properties = [],
    ): void {
        $user = Auth::user();
        $request = request();

        ActivityLog::create([
            'user_id' => $user?->getKey(),
            'username' => $user?->username ?? $user?->name,
            'action' => $action,
            'subject_type' => $subject ? $subject::class : null,
            'subject_id' => $subject?->getKey() !== null ? (string) $subject->getKey() : null,
            'description' => $description,
            'properties' => $properties ?: null,
            'ip_address' => $request?->ip(),
            'user_agent' => substr((string) $request?->userAgent(), 0, 255) ?: null,
        ]);
    }

    /** Catat tanpa pernah melempar error ke alur utama. */
    public function safe(
        string $action,
        ?Model $subject = null,
        ?string $description = null,
        array $properties = [],
    ): void {
        try {
            $this->record($action, $subject, $description, $properties);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Audit log gagal: '.$e->getMessage());
        }
    }
}