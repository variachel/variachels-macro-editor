import {i18n, log} from './util.js'
import {CodeJar} from './codejar.js';
import highlight from './highlight.js';
import javascript from './languages/javascript-min.js';
import {registerSettings} from './settings.js';

export class VariachelsMacroEditor {
    static _moduleName = 'variachels-macro-editor';
}

highlight.registerLanguage('javascript', javascript);
highlight.configure({
    ignoreUnescapedHTML: true
});

const windowSizes = {
    small: {width: 900, height: 730},
    medium: {width: 1500, height: 1000},
    large: {width: 1800, height: 1200}
}

Hooks.on('renderMacroConfig', (app, html, data) => {
    const windowSize = game.settings.get(
        VariachelsMacroEditor._moduleName,
        'window-size'
    );

    const size = windowSizes[windowSize];

    app.setPosition({
        width: size.width,
        height: size.height
    });

    app.setPosition({
        left: (window.innerWidth - size.width) / 2,
        top: (window.innerHeight - size.height) / 2
    });

    setUpTextArea(html);
});

function setUpTextArea(html) {
    const textarea = html.find('textarea[name="command"]');
    const code = textarea.val();
    textarea.after('<code class="variachels-macro-editor hljs language-javascript"></code>');
    textarea.parent().css({position: 'relative'});
    // textarea.after('<div class='editor-container'><code class='improved-macro-editor hljs language-javascript'></code></div>');
    textarea.hide();

    const editorElement = html.find('.variachels-macro-editor')[0];

    const jar = CodeJar(
        editorElement,
        highlight.highlightElement,
        {
            tab: ' '.repeat(4)
        }
    );
    jar.updateCode(code);
    jar.onUpdate(code => {
        textarea.val(code);
    });
}

Hooks.on('init', async () => {
    registerSettings();
});

Hooks.once('ready', () => {
    log(i18n('editor.ready'))
});
