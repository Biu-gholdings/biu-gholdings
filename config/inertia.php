<?php

/*
| Only the `pages` section is overridden; every other Inertia option keeps the
| package default (Laravel merges package config by top-level key).
|
| The package default looks for page components in `resources/js/pages`
| (lower-case). This repository keeps them in `resources/js/Pages`. That works
| on case-insensitive file systems (macOS) but not on Linux CI runners, where
| `assertInertia()->component()` fails with "page component file does not exist".
*/

return [

    'pages' => [

        'ensure_pages_exist' => false,

        'paths' => [

            resource_path('js/Pages'),

        ],

        'extensions' => [

            'js',
            'jsx',
            'svelte',
            'ts',
            'tsx',
            'vue',

        ],

    ],

];
