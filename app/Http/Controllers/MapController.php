<?php

namespace App\Http\Controllers;

use Illuminate\View\View;

class MapController extends Controller
{
    public function __invoke(): View
    {
        return view('map');
    }
}
