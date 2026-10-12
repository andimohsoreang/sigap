<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UpdateWargaProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'email' => ['nullable', 'email', 'max:150'],
            'telp' => ['nullable', 'string', 'max:30'],
            'password' => ['nullable', 'string', Password::min(8)],
        ];
    }
}