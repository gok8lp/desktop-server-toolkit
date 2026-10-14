// FLUGEL — eslint yapılandırması. gjs.guide stil rehberi ve GNOME Shell'in lint/eslintrc-gjs.yml kurallarından
// eklenti için anlamlı olanlar: 4 boşluk girinti, tek tırnak, noktalı virgül, const, === (null hariç).
import js from '@eslint/js';
import globals from 'globals';

export default [
    {ignores: ['node_modules/', '**/locale/', 'tests/altin/']},
    js.configs.recommended,
    {
        files: ['extensions/**/*.js'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: {
                ...globals.es2021,
                global: 'readonly',
                log: 'readonly',
                logError: 'readonly',
                print: 'readonly',
                printerr: 'readonly',
                console: 'readonly',
                TextEncoder: 'readonly',
                TextDecoder: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['error', {argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none'}],
            'prefer-const': 'error',
            'no-var': 'error',
            'eqeqeq': ['error', 'smart'],
            // GObject.registerClass(class X extends …) gövdesi GNOME'daki gibi sıfır girintili yazılır
            'indent': ['error', 4, {SwitchCase: 0, ignoredNodes: [
                'CallExpression[callee.object.name=GObject][callee.property.name=registerClass] > ClassExpression:first-child',
                'CallExpression > ArrowFunctionExpression', 'ConditionalExpression']}],
            'quotes': ['error', 'single', {avoidEscape: true, allowTemplateLiterals: true}],
            'semi': ['error', 'always'],
            'no-shadow': 'off',
            'prefer-arrow-callback': 'error',
            'prefer-template': 'error',
            'no-useless-concat': 'error',
            'object-shorthand': 'error',
            'no-implicit-coercion': ['error', {allow: ['!!']}],
            'consistent-return': 'error',
            'curly': ['error', 'multi-or-nest', 'consistent'],
            'no-unreachable-loop': 'error',
            'no-await-in-loop': 'error',
        },
    },
    // diğer GNOME eklentileri (kilit ekranı, v1 panel): aynı GJS ortamı, sadece hata yakalayan kurallar
    {
        files: ['pc/gnome-uzantilari/**/*.js'],
        languageOptions: {
            ecmaVersion: 2024, sourceType: 'module',
            globals: {...globals.es2021, global: 'readonly', log: 'readonly', logError: 'readonly', console: 'readonly',
                TextEncoder: 'readonly', TextDecoder: 'readonly'},
        },
        rules: {'no-unused-vars': ['error', {argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none'}]},
    },
    // sunucudaki web arayüzleri (FLUGEL Akış, homepage): tarayıcı ortamı
    {
        files: ['sunucu/**/*.js'],
        languageOptions: {ecmaVersion: 2024, sourceType: 'script', globals: {...globals.browser, ...globals.serviceworker}},
        rules: {'no-unused-vars': ['error', {argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none'}]},
    },
];
