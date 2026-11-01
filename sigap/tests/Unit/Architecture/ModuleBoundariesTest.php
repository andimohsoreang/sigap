<?php

namespace Tests\Unit\Architecture;

use PHPUnit\Framework\TestCase;

/**
 * Uji arsitektur lapisan AI (PRD-AI §3, §4.2, §10) — kerangka Tahap 0.
 *
 * - Hanya modul Ai yang boleh memakai `LlmClient` (semua tugas AI lewat Gateway).
 *   Pelanggaran yang sudah ada dicatat sebagai BASELINE dan wajib dihapus di
 *   Tahap 1; pelanggaran baru langsung gagal, dan entri baseline yang sudah
 *   beres juga gagal agar daftarnya terus menyusut.
 * - Arah ketergantungan antarmodul `App\Modules\*` (§4.2).
 * - Tahap 4: kode modul hanya di `app/Modules/*`, tanpa daftar pengecualian;
 *   lokasi lama (`Services\Ai`, `Services\Knowledge`, `Jobs`, `Listeners`)
 *   tidak boleh terisi lagi.
 */
final class ModuleBoundariesTest extends TestCase
{
    private const LLM_CLIENT = 'App\\Modules\\Ai\\LlmClient';

    /** Lokasi lama kode modul (PRD-AI Lampiran A); kosong sejak Tahap 4. */
    private const LEGACY_NAMESPACES = ['App\\Services\\Ai\\', 'App\\Services\\Knowledge\\', 'App\\Jobs\\', 'App\\Listeners\\'];

    /**
     * Pemakai `LlmClient` di luar modul Ai yang masih ditoleransi. Kosong sejak
     * Tahap 1: semua tugas AI lewat AiGateway.
     *
     * @var list<string>
     */
    private const LLM_CLIENT_BASELINE = [];

    /** §4.2: modul → modul yang DILARANG ia pakai (`*` = semua modul lain). */
    private const FORBIDDEN = [
        'Ai' => ['*'],
        'Knowledge' => ['Assistant', 'Referral'],
        'ContactCenter' => ['Assistant'],
    ];

    /** @return array<string, array{namespace: string, class: string|null, uses: list<string>, code: string}> */
    private static function app(): array
    {
        static $files = null;

        return $files ??= DependencyScanner::scan(dirname(__DIR__, 3).'/app');
    }

    private static function inAiModule(string $class): bool
    {
        return str_starts_with($class, 'App\\Modules\\Ai\\');
    }

    /** @return list<string> */
    private static function llmClientUsersOutsideAi(): array
    {
        $users = [];
        foreach (self::app() as $class => $file) {
            if (! self::inAiModule($class) && DependencyScanner::dependsOn($file, self::LLM_CLIENT)) {
                $users[] = $class;
            }
        }

        return $users;
    }

    public function test_only_the_ai_module_uses_llm_client(): void
    {
        $new = array_values(array_diff(self::llmClientUsersOutsideAi(), self::LLM_CLIENT_BASELINE));

        $this->assertSame([], $new, "Pakai AiGateway, bukan LlmClient langsung (PRD-AI §0.3):\n".implode("\n", $new));
    }

    public function test_llm_client_baseline_only_shrinks(): void
    {
        $fixed = array_values(array_diff(self::LLM_CLIENT_BASELINE, self::llmClientUsersOutsideAi()));

        $this->assertSame([], $fixed, "Sudah tidak memakai LlmClient — hapus dari LLM_CLIENT_BASELINE:\n".implode("\n", $fixed));
    }

    /**
     * @param  array<string, array{namespace: string, class: string|null, uses: list<string>, code: string}>  $files
     * @return list<string>
     */
    private static function moduleViolations(array $files): array
    {
        $violations = [];
        foreach ($files as $class => $file) {
            if (! preg_match('/^App\\\\Modules\\\\(\w+)\\\\/', (string) $class, $m)) {
                continue;
            }
            foreach ($file['uses'] as $used) {
                if (! preg_match('/^App\\\\Modules\\\\(\w+)\\\\/', $used, $u) || $u[1] === $m[1]) {
                    continue;
                }
                $forbidden = self::FORBIDDEN[$m[1]] ?? [];
                if (in_array('*', $forbidden, true) || in_array($u[1], $forbidden, true)) {
                    $violations[] = "{$class} → {$used}";
                }
            }
        }

        return $violations;
    }

    public function test_module_dependency_direction(): void
    {
        $violations = self::moduleViolations(self::app());

        $this->assertSame([], $violations, "Melanggar arah ketergantungan PRD-AI §4.2:\n".implode("\n", $violations));
    }

    public function test_module_code_lives_only_in_app_modules(): void
    {
        $legacy = array_values(array_filter(
            array_keys(self::app()),
            fn ($class) => array_filter(self::LEGACY_NAMESPACES, fn ($ns) => str_starts_with((string) $class, $ns)) !== [],
        ));

        $this->assertSame([], $legacy, "Kode modul harus di app/Modules/* (PRD-AI §4.3):\n".implode("\n", $legacy));
    }

    public function test_scanner_detects_imports_same_namespace_references_and_ignores_comments(): void
    {
        $imported = DependencyScanner::parse(<<<'PHP'
            <?php
            namespace App\Modules\Knowledge;
            use App\Models\Region, App\Models\Category as Kategori;
            use App\Modules\Ai\{LlmClient, PiiMasker as Masker};
            final class Contoh { use \Illuminate\Support\Traits\Macroable; }
            PHP);
        $this->assertTrue(DependencyScanner::dependsOn($imported, self::LLM_CLIENT));
        $this->assertTrue(DependencyScanner::dependsOn($imported, 'App\\Modules\\Ai\\PiiMasker'));
        $this->assertTrue(DependencyScanner::dependsOn($imported, 'App\\Models\\Region'));

        $sameNamespace = DependencyScanner::parse(<<<'PHP'
            <?php
            namespace App\Modules\Ai;
            class Contoh { public function __construct(private LlmClient $llm) {} }
            PHP);
        $this->assertTrue(DependencyScanner::dependsOn($sameNamespace, self::LLM_CLIENT));

        $commentOnly = DependencyScanner::parse(<<<'PHP'
            <?php
            namespace App\Modules\Ai;
            /** Dipakai {@see LlmClient} untuk mengenali tugas. */
            class Contoh { private string $name = 'OpenAiCompatibleLlmClientX'; }
            PHP);
        $this->assertFalse(DependencyScanner::dependsOn($commentOnly, self::LLM_CLIENT));
    }

    public function test_module_rule_catches_forbidden_dependencies(): void
    {
        $parse = fn (string $namespace, string $class, string $use) => DependencyScanner::parse(
            "<?php\nnamespace {$namespace};\nuse {$use};\nfinal class {$class} {}\n"
        );
        $files = [
            'App\\Modules\\Ai\\AiGateway' => $parse('App\\Modules\\Ai', 'AiGateway', 'App\\Modules\\Knowledge\\KnowledgeSearch'),
            'App\\Modules\\Knowledge\\KnowledgeSearch' => $parse('App\\Modules\\Knowledge', 'KnowledgeSearch', 'App\\Modules\\Referral\\Referrals'),
            'App\\Modules\\ContactCenter\\ChatService' => $parse('App\\Modules\\ContactCenter', 'ChatService', 'App\\Modules\\Assistant\\Assistant'),
            // Diizinkan: Assistant → Knowledge, Knowledge → Ai.
            'App\\Modules\\Assistant\\Assistant' => $parse('App\\Modules\\Assistant', 'Assistant', 'App\\Modules\\Knowledge\\KnowledgeSearch'),
            'App\\Modules\\Knowledge\\Ingestion' => $parse('App\\Modules\\Knowledge', 'Ingestion', 'App\\Modules\\Ai\\AiGateway'),
        ];

        $this->assertSame([
            'App\\Modules\\Ai\\AiGateway → App\\Modules\\Knowledge\\KnowledgeSearch',
            'App\\Modules\\Knowledge\\KnowledgeSearch → App\\Modules\\Referral\\Referrals',
            'App\\Modules\\ContactCenter\\ChatService → App\\Modules\\Assistant\\Assistant',
        ], self::moduleViolations($files));
    }
}
