<?php

namespace Tests\Feature\Web;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PublicPagesTest extends TestCase
{
    use RefreshDatabase;

    public function test_beranda_renders_with_stats_and_channels(): void
    {
        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('public/beranda')
                ->has('stats')
                ->has('channels')
                ->has('faqs')
            );
    }

    public function test_beranda_absol_comparison_page_uses_same_data_as_home(): void
    {
        $home = $this->get('/')->assertOk();

        $this->get('/beranda-absol')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('public/beranda-absol')
                ->has('stats')
                ->has('channels')
                ->has('faqs')
            );

        // Halaman asli tetap utuh (tidak tertimpa versi pembanding).
        $home->assertInertia(fn (Assert $page) => $page->component('public/beranda'));
    }

    public function test_public_static_pages_render(): void
    {
        foreach ([
            '/tentang' => 'public/tentang',
            '/katalog' => 'public/katalog',
            '/peta' => 'public/peta',
            '/lacak' => 'public/lacak',
            '/pedoman-layanan' => 'public/pedoman-layanan',
            '/syarat-ketentuan' => 'public/syarat-ketentuan',
            '/kebijakan-privasi' => 'public/kebijakan-privasi',
            '/tentang-kami' => 'public/tentang-kami',
            '/masuk' => 'public/masuk',
            '/pengaduan/baru' => 'public/formulir-pengaduan',
            '/pengaduan/internal' => 'public/formulir-internal',
            '/panduan' => 'public/panduan',
        ] as $url => $component) {
            $this->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page->component($component));
        }
    }

    public function test_guest_is_redirected_from_portal_to_masuk(): void
    {
        $this->get('/portal-warga')->assertRedirect('/masuk');
        $this->get('/admin')->assertRedirect('/masuk');
    }

    public function test_track_page_returns_null_ticket_for_unknown_number(): void
    {
        $this->get('/lacak?ticket=TKT-99999')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('public/lacak')->where('ticket', false));
    }
}