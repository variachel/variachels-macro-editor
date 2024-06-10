import {VariachelsMacroEditor} from './variachels-macro-editor.js'
import {i18n} from './util.js'

export const registerSettings = function () {
    registerWindowSettings();
    registerKeybindings();
    registerCodeStying();
}

function registerWindowSettings() {
    game.settings.register(
        VariachelsMacroEditor._moduleName,
        'window-size',
        {
            name: i18n('editor.window-size'),
            hint: i18n('editor.window-size-hint'),
            scope: 'world',
            config: true,
            default: 'small',
            choices: {
                small: 'Small (900 x 730)',
                medium: 'Medium (1500 x 1000)',
                large: 'Large (1800 x 1200)'
            },
            type: String
        }
    );
}

function registerKeybindings() {
    game.keybindings.register(
        VariachelsMacroEditor._moduleName,
        'command-raw',
        {
            name: i18n('editor.comment-command'),
            editable: []
        });
}

function registerCodeStying() {
    const styleOptions = {
        agate: i18n('editor.agate'),
        'atom-one-dark': i18n('editor.atom-one-dark'),
        codeschool: i18n('editor.codeschool'),
        darkmoss: i18n('editor.darkmoss'),
        eva: i18n('editor.eva'),
        'gradient-light': i18n('editor.gradient-light'),
        purebasic: i18n('editor.purebasic')
    }

    game.settings.register(
        VariachelsMacroEditor._moduleName,
        'macro-editor-styling',
        {
            name: i18n('editor.macro-editor-styling'),
            hint: i18n('editor.macro-editor-styling-hint'),
            scope: 'world',
            config: true,
            default: 'agate',
            choices: styleOptions,
            type: String,
            requiresReload: true
        });

    const styling = game.settings.get(
        VariachelsMacroEditor._moduleName,
        'macro-editor-styling'
    )

    if (styling) {
        injectCustomCSS(buildCSS(styling));
    }
}

function injectCustomCSS(customCss) {
    const head = document.getElementsByTagName('head')[0]
    head.append(customCss, head.lastChild)
}

function buildCSS(style) {
    const css = document.createElement('link')
    css.setAttribute('rel', 'stylesheet')
    css.setAttribute('type', 'text/css')
    css.setAttribute('href', 'modules/variachels-macro-editor/styles/' + style + '.css')
    css.setAttribute('media', 'all')
    return css
}
