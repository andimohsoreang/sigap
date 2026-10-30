<?php

namespace App\Console\Commands\Concerns;

/** Diff baris untuk pratinjau perintah koreksi sekali jalan. */
trait ShowsLineDiff
{
    /**
     * Diff baris sederhana (LCS): baris tetap diawali "  ", dihapus "- ", ditambah "+ ".
     *
     * @return list<string>
     */
    protected function diff(string $old, string $new): array
    {
        $a = explode("\n", $old);
        $b = explode("\n", $new);
        $lcs = array_fill(0, count($a) + 1, array_fill(0, count($b) + 1, 0));
        for ($i = count($a) - 1; $i >= 0; $i--) {
            for ($j = count($b) - 1; $j >= 0; $j--) {
                $lcs[$i][$j] = $a[$i] === $b[$j] ? $lcs[$i + 1][$j + 1] + 1 : max($lcs[$i + 1][$j], $lcs[$i][$j + 1]);
            }
        }

        $lines = [];
        [$i, $j] = [0, 0];
        while ($i < count($a) || $j < count($b)) {
            if ($i < count($a) && $j < count($b) && $a[$i] === $b[$j]) {
                $lines[] = '  '.$a[$i++];
                $j++;
            } elseif ($j < count($b) && ($i === count($a) || $lcs[$i][$j + 1] >= $lcs[$i + 1][$j])) {
                $lines[] = '+ '.$b[$j++];
            } else {
                $lines[] = '- '.$a[$i++];
            }
        }

        return $lines;
    }
}
