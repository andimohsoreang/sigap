<?php

namespace Tests\Unit\Architecture;

use PHPUnit\Framework\TestCase;

/**
 * PRD-AI Tahap 3: logika asisten ada di `App\Modules\Assistant`.
 * `App\Services\Ai\AssistantService` tinggal pintu sementara; pemakainya di
 * app/ dicatat sebagai BASELINE yang hanya boleh menyusut sampai kelas itu
 * dihapus (pola sama dengan ModuleBoundariesTest).
 */
final class AssistantFacadeTest extends TestCase
{
    private const FACADE = 'App\\Services\\Ai\\AssistantService';

    /**
     * Masih memakai pintu sementara karena AsyncReplyTest (tes lama) memanggil
     * handle() dengan AssistantService.
     *
     * @var list<string>
     */
    private const BASELINE = ['App\\Jobs\\RespondToMessage'];

    /** @return list<string> */
    private static function users(): array
    {
        $users = [];
        foreach (DependencyScanner::scan(dirname(__DIR__, 3).'/app') as $class => $file) {
            if ($class !== self::FACADE && DependencyScanner::dependsOn($file, self::FACADE)) {
                $users[] = $class;
            }
        }

        return $users;
    }

    public function test_no_new_users_of_the_temporary_facade(): void
    {
        $new = array_values(array_diff(self::users(), self::BASELINE));

        $this->assertSame([], $new, "Pakai App\\Modules\\Assistant, bukan AssistantService:\n".implode("\n", $new));
    }

    public function test_facade_baseline_only_shrinks(): void
    {
        $fixed = array_values(array_diff(self::BASELINE, self::users()));

        $this->assertSame([], $fixed, "Sudah tidak memakai AssistantService — hapus dari BASELINE:\n".implode("\n", $fixed));
    }
}
