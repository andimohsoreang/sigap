<?php

namespace Tests\Feature\Web;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PublicPagesTest extends TestCase
{
    use RefreshDatabase;

    public function test_beranda_utama_uses_absol_design(): void
    {
        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('public/beranda-absol')
                ->has('stats')
                ->has('channels')
                ->has('faqs')
            );
    }

    public function test_beranda_standar_still_available_with_same_data(): void
    {
        $this->get('/beranda-standar')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('public/beranda')
                ->has('stats')
                ->has('channels')
                ->has('faqs')
            );
    }

    public function test_beranda_baru_transi_renders_with_its_assets(): void
    {
        $this->get('/beranda-baru')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('public/beranda-transi'));

        foreach (['08-selamat-datang', '01-menunjuk-kanan', '03-jempol-sukses', '06-berpikir', '00-menyapa', 'avatar'] as $image) {
            $this->assertFileExists(public_path("images/transi/{$image}.webp"));
        }
    }

    public function test_old_absol_url_redirects_to_home(): void
    {
        $this->get('/beranda-absol')->assertRedirect('/')->assertStatus(301);
    }

    public function test_public_static_pages_render(): void
    {
        foreach ([
            '/tentang' => 'public/tentang',
            '/katalog' => 'public/katalog',
            '/katalog/kantor-balai' => 'public/kantor-balai',
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
