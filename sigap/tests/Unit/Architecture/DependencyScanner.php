<?php

namespace Tests\Unit\Architecture;

/**
 * Pemindai ketergantungan kelas untuk uji arsitektur (PRD-AI §10). Proyek
 * memakai PHPUnit, jadi aturan dijaga dengan memindai pernyataan `use` per
 * namespace, ditambah rujukan nama pendek di namespace yang sama (yang tidak
 * butuh `use`). Komentar dan docblock diabaikan.
 */
final class DependencyScanner
{
    /**
     * @return array{namespace: string, class: string|null, uses: list<string>, code: string}
     */
    public static function parse(string $source): array
    {
        $code = '';
        foreach (token_get_all($source) as $token) {
            if (is_array($token) && in_array($token[0], [T_COMMENT, T_DOC_COMMENT], true)) {
                continue;
            }
            $code .= is_array($token) ? $token[1] : $token;
        }

        preg_match('/^\s*namespace\s+([^;{\s]+)/m', $code, $ns);
        preg_match('/^\s*(?:final\s+|abstract\s+|readonly\s+)*(?:class|interface|trait|enum)\s+(\w+)/m', $code, $cls);

        // Hanya `use` tingkat atas (sebelum deklarasi kelas), bukan `use Trait;` di dalam kelas.
        $header = isset($cls[0]) ? substr($code, 0, (int) strpos($code, $cls[0])) : $code;
        $uses = [];
        preg_match_all('/^\s*use\s+(?:function\s+|const\s+)?([^;]+);/m', $header, $matches);
        foreach ($matches[1] as $clause) {
            $clause = trim($clause);
            if (preg_match('/^(.*)\\\\\{(.*)\}$/s', $clause, $group)) {
                foreach (explode(',', $group[2]) as $item) {
                    $uses[] = trim($group[1]).'\\'.trim(preg_replace('/\s+as\s+\w+$/i', '', trim($item)));
                }

                continue;
            }
            foreach (explode(',', $clause) as $item) {
                $uses[] = ltrim(trim(preg_replace('/\s+as\s+\w+$/i', '', trim($item))), '\\');
            }
        }

        return [
            'namespace' => $ns[1] ?? '',
            'class' => isset($cls[1], $ns[1]) ? $ns[1].'\\'.$cls[1] : ($cls[1] ?? null),
            'uses' => array_values(array_unique($uses)),
            'code' => $code,
        ];
    }

    /** Apakah berkas (hasil {@see parse()}) bergantung pada kelas `$target` (FQCN)? */
    public static function dependsOn(array $file, string $target): bool
    {
        if ($file['class'] === $target) {
            return false;
        }
        if (in_array($target, $file['uses'], true)) {
            return true;
        }

        // Nama pendek di namespace yang sama tidak butuh `use`.
        $pos = strrpos($target, '\\');
        $namespace = $pos === false ? '' : substr($target, 0, $pos);
        $short = $pos === false ? $target : substr($target, $pos + 1);

        return $file['namespace'] === $namespace && preg_match('/(?<![\\\\\w$])'.preg_quote($short, '/').'\b/', $file['code']) === 1;
    }

    /**
     * Semua berkas PHP di bawah `$dir`, dikunci dengan FQCN-nya.
     *
     * @return array<string, array{namespace: string, class: string|null, uses: list<string>, code: string}>
     */
    public static function scan(string $dir): array
    {
        $files = [];
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $path) {
            if ($path->getExtension() !== 'php') {
                continue;
            }
            $parsed = self::parse((string) file_get_contents($path->getPathname()));
            $files[$parsed['class'] ?? $path->getPathname()] = $parsed;
        }
        ksort($files);

        return $files;
    }
}
