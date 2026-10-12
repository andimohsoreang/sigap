<?php

use App\Models\ChatConversation;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Channel Broadcast SIGAP (PRD D5 — Reverb)
|--------------------------------------------------------------------------
| Otentikasi channel privat. Warga hanya boleh mengakses percakapannya
| sendiri; admin (admin kawasan & super admin) boleh memantau semua chat dan
| menerima notifikasi panel.
*/

// Percakapan chat: pemilik percakapan (warga login) atau admin.
//
// Catatan: kanal ini privat sehingga tamu tanpa akun tidak dapat berlangganan
// (Pusher menolak kanal privat tanpa pengguna terautentikasi). Widget tamu
// otomatis memakai fallback polling — lihat live-chat-widget.tsx.
Broadcast::channel('chat.{conversationId}', function (User $user, int $conversationId) {
    if ($user->isAdmin()) {
        return true;
    }

    return ChatConversation::query()
        ->where('id', $conversationId)
        ->where('user_id', $user->id)
        ->exists();
});

// Notifikasi panel admin (tiket baru / perubahan status).
Broadcast::channel('admin.notifications', function (User $user) {
    return $user->isAdmin();
});

// Notifikasi in-app per pengguna (D10): hanya ke diri sendiri.
Broadcast::channel('user.{userId}', function (User $user, int $userId) {
    return $user->id === $userId;
});