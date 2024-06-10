// import {i18n} from './util.js'
import { CodeJar } from './codejar.js';
import highlight from './highlight.js';
import javascript from './languages/javascript-min.js';

export class VariachelsMacroEditor {
    static _moduleName = 'variachels-macro-editor'
}

highlight.registerLanguage("javascript", javascript);
highlight.configure({
    ignoreUnescapedHTML: true
});

const windowSizes = {
    small: {width: 900, height: 650},
    medium: {width: 1500, height: 1000},
    large: {width: 1800, height: 1200}
}

Hooks.on('renderMacroConfig', (app, html, data) => {
    const size = windowSizes[game.settings.get(VariachelsMacroEditor._moduleName, "window-size")];

    app.setPosition({
        width: size.width,
        height: size.height
    });

    app.setPosition({
        left: (window.innerWidth - size.width) / 2,
        top: (window.innerHeight - size.height) / 2
    });

    const textarea = html.find('textarea[name="command"]');
    const code = textarea.val();
    textarea.after('<code class="improved-macro-editor hljs language-javascript"></code>');
    textarea.parent().css({position: 'relative'});
    // textarea.after('<div class="editor-container"><code class="improved-macro-editor hljs language-javascript"></code></div>');
    textarea.hide();

    const editorElement = html.find('.improved-macro-editor')[0];

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
});

Hooks.on("init", () => {
    game.keybindings.register(VariachelsMacroEditor._moduleName, "comment-command", {
        name: "improved-macro-editor.comment-command",
        editable: []
    });

    game.settings.register(
        VariachelsMacroEditor._moduleName,
        "window-size",
        {
            name: "improved-macro-editor.window-size",
            scope: "client",
            config: true,
            default: "medium",
            choices: {
                small: "900 x 650",
                medium: "1500 x 1000",
                large: "1800 x 1200"
            },
            type: String
        }
    );
})