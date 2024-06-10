const globalWindow = window;

export function CodeJar(editor, highlight, opt = {}) {

    const options = Object.assign({
        tab: '\t',
        indentOn: /[({\[]$/,
        moveToNewLine: /^[)}\]]/,
        spellcheck: false,
        catchTab: true,
        preserveIdent: true,
        addClosing: true,
        history: true,
        window: globalWindow
    }, opt);

    const window = options.window;
    const document = window.document;
    let listeners = [];
    let history = [];
    let at = -1;
    let focus = false;
    let callback;
    let prev; // code content prior keydown event

    editor.setAttribute('contenteditable', 'plaintext-only');
    editor.setAttribute('spellcheck', options.spellcheck ? 'true' : 'false');
    editor.style.outline = 'none';
    editor.style.overflowWrap = 'break-word';
    editor.style.overflowY = 'auto';
    editor.style.whiteSpace = 'pre-wrap';

    let isLegacy = false; // true if plaintext-only is not supported
    highlight(editor);

    if (editor.contentEditable !== 'plaintext-only')
        isLegacy = true;
    if (isLegacy)
        editor.setAttribute('contenteditable', 'true');

    const debounceHighlight = debounce(() => {
        const pos = save();
        highlight(editor, pos);
        restore(pos);
    }, 30);

    let recording = false;

    const shouldRecord = (event) => {
        return !isUndo(event) && !isRedo(event)
            && event.key !== 'Meta'
            && event.key !== 'Control'
            && event.key !== 'Alt'
            && !event.key.startsWith('Arrow');
    };

    const debounceRecordHistory = debounce((event) => {
        if (shouldRecord(event)) {
            recordHistory();
            recording = false;
        }
    }, 300);

    const on = (type, fn) => {
        listeners.push([type, fn]);
        editor.addEventListener(type, fn);
    };

    on('keydown', event => {
        if (event.defaultPrevented)
            return;
        prev = toString();
        if (options.preserveIdent)
            handleNewLine(event);
        else
            legacyNewLineFix(event);
        if (options.catchTab)
            handleTabCharacters(event);
        // EDIT START
        handleCommentCommand(event);
        // EDIT END
        if (options.addClosing)
            handleSelfClosingCharacters(event);
        if (options.history) {
            handleUndoRedo(event);
            if (shouldRecord(event) && !recording) {
                recordHistory();
                recording = true;
            }
        }
        if (isLegacy)
            restore(save());
    });

    on('keyup', event => {
        if (event.defaultPrevented)
            return;
        if (event.isComposing)
            return;
        if (prev !== toString())
            debounceHighlight();
        debounceRecordHistory(event);
        if (callback)
            callback(toString());
    });

    on('focus', _event => {
        focus = true;
    });

    on('blur', _event => {
        focus = false;
    });

    on('paste', event => {
        recordHistory();
        handlePaste(event);
        recordHistory();
        if (callback)
            callback(toString());
    });

    function save() {
        const s = getSelection();
        const pos = {start: 0, end: 0, dir: undefined};
        let {anchorNode, anchorOffset, focusNode, focusOffset} = s;
        if (!anchorNode || !focusNode)
            throw 'error1';
        // Selection anchor and focus are expected to be text nodes,
        // so normalize them.
        if (anchorNode.nodeType === Node.ELEMENT_NODE) {
            const node = document.createTextNode('');
            anchorNode.insertBefore(node, anchorNode.childNodes[anchorOffset]);
            anchorNode = node;
            anchorOffset = 0;
        }
        if (focusNode.nodeType === Node.ELEMENT_NODE) {
            const node = document.createTextNode('');
            focusNode.insertBefore(node, focusNode.childNodes[focusOffset]);
            focusNode = node;
            focusOffset = 0;
        }
        visit(editor, el => {
            if (el === anchorNode && el === focusNode) {
                pos.start += anchorOffset;
                pos.end += focusOffset;
                pos.dir = anchorOffset <= focusOffset ? '->' : '<-';
                return 'stop';
            }
            if (el === anchorNode) {
                pos.start += anchorOffset;
                if (!pos.dir) {
                    pos.dir = '->';
                } else {
                    return 'stop';
                }
            } else if (el === focusNode) {
                pos.end += focusOffset;
                if (!pos.dir) {
                    pos.dir = '<-';
                } else {
                    return 'stop';
                }
            }
            if (el.nodeType === Node.TEXT_NODE) {
                if (pos.dir !== '->')
                    pos.start += el.nodeValue.length;
                if (pos.dir !== '<-')
                    pos.end += el.nodeValue.length;
            }
        });
        // collapse empty text nodes
        editor.normalize();
        return pos;
    }

    function restore(pos) {
        const s = getSelection();
        let startNode, startOffset = 0;
        let endNode, endOffset = 0;
        if (!pos.dir)
            pos.dir = '->';
        if (pos.start < 0)
            pos.start = 0;
        if (pos.end < 0)
            pos.end = 0;
        // Flip start and end if the direction reversed
        if (pos.dir === '<-') {
            const {start, end} = pos;
            pos.start = end;
            pos.end = start;
        }
        let current = 0;

        visit(editor, el => {
            if (el.nodeType !== Node.TEXT_NODE)
                return;
            const len = (el.nodeValue || '').length;
            if (current + len > pos.start) {
                if (!startNode) {
                    startNode = el;
                    startOffset = pos.start - current;
                }
                if (current + len > pos.end) {
                    endNode = el;
                    endOffset = pos.end - current;
                    return 'stop';
                }
            }
            current += len;
        });

        if (!startNode) {
            startNode = editor;
            startOffset = editor.childNodes.length;
        }

        if (!endNode) {
            endNode = editor;
            endOffset = editor.childNodes.length;
        }

        // Flip back the selection
        if (pos.dir === '<-') {
            [startNode, startOffset, endNode, endOffset] = [endNode, endOffset, startNode, startOffset];
        }
        s.setBaseAndExtent(startNode, startOffset, endNode, endOffset);
    }

    function beforeCursor() {
        const s = getSelection();
        const r0 = s.getRangeAt(0);
        const r = document.createRange();
        r.selectNodeContents(editor);
        r.setEnd(r0.startContainer, r0.startOffset);
        return r.toString();
    }

    function afterCursor() {
        const s = getSelection();
        const r0 = s.getRangeAt(0);
        const r = document.createRange();
        r.selectNodeContents(editor);
        r.setStart(r0.endContainer, r0.endOffset);
        return r.toString();
    }

    // EDIT START
    function betweenCursor() {
        const s = getSelection();
        const r0 = s.getRangeAt(0);
        const r = document.createRange();
        r.selectNodeContents(editor);
        r.setStart(r0.startContainer, r0.startOffset);
        r.setEnd(r0.endContainer, r0.endOffset);
        return r.toString();
    }

    // EDIT END
    function handleNewLine(event) {
        if (event.key === 'Enter') {
            const before = beforeCursor();
            const after = afterCursor();
            let [padding] = findPadding(before);
            let newLinePadding = padding;
            // If last symbol is opening brace ident new line
            if (options.indentOn.test(before)) {
                newLinePadding += options.tab;
            }
            // Preserve padding
            if (newLinePadding.length > 0) {
                preventDefault(event);
                event.stopPropagation();
                insert('\n' + newLinePadding);
            } else {
                legacyNewLineFix(event);
            }
            // Place adjacent closing brace on next line
            if (newLinePadding !== padding && options.moveToNewLine.test(after)) {
                const pos = save();
                insert('\n' + padding);
                restore(pos);
            }
        }
    }

    function legacyNewLineFix(event) {
        // Firefox does not support plaintext-only mode
        // and puts <div><br></div> on Enter. Let's help.
        if (isLegacy && event.key === 'Enter') {
            preventDefault(event);
            event.stopPropagation();
            if (afterCursor() === '') {
                insert('\n ');
                const pos = save();
                pos.start = --pos.end;
                restore(pos);
            } else {
                insert('\n');
            }
        }
    }

    function handleSelfClosingCharacters(event) {
        const open = `([{'"`;
        const close = `)]}'"`;
        const codeAfter = afterCursor();
        const codeBefore = beforeCursor();
        const escapeCharacter = codeBefore.substring(codeBefore.length - 1) === '\\';
        const charAfter = codeAfter.substring(0, 1);
        if (close.includes(event.key) && !escapeCharacter && charAfter === event.key) {
            // We already have closing char next to cursor.
            // Move one char to right.
            const pos = save();
            preventDefault(event);
            pos.start = ++pos.end;
            restore(pos);
        } else if (open.includes(event.key)
            && !escapeCharacter
            && (`"'`.includes(event.key) || ['', ' ', '\n'].includes(charAfter))) {
            preventDefault(event);
            const pos = save();
            const wrapText = pos.start === pos.end ? '' : getSelection().toString();
            const text = event.key + wrapText + close[open.indexOf(event.key)];
            insert(text);
            pos.start++;
            pos.end++;
            restore(pos);
        }
    }

    // EDIT START
    function getAllIndexes(arr, val) {
        let indexes = [], i = -1;
        while ((i = arr.indexOf(val, i + 1)) !== -1) {
            indexes.push(i);
        }
        return indexes;
    }

    function endOfLine(from) {
        const c = toString()
        const i = c.indexOf('\n', from);
        return i !== -1 ? i : c.length;
    }

    function adjustPosition(i, changes, excl) {
        let n = i;
        for (const c of changes) {
            if (excl && n === i ? c[0] < i : c[0] <= i) {
                n += c[1];
            }
        }
        return n;
    }

    function adjustedPosition(pos, changes) {
        if (pos.start < pos.end) {
            return {
                start: adjustPosition(pos.start, changes, true),
                end: adjustPosition(pos.end, changes, false),
                dir: pos.dir
            }
        } else if (pos.start > pos.end) {
            return {
                start: adjustPosition(pos.start, changes, false),
                end: adjustPosition(pos.end, changes, true),
                dir: pos.dir
            }
        } else {
            return {
                start: adjustPosition(pos.start, changes, true),
                end: adjustPosition(pos.end, changes, true),
                dir: pos.dir
            }
        }
    }

    function handleCommentCommand(event) {
        const context = KeyboardManager.getKeyboardEventContext(event)
        const binding = game.keybindings.get('improved-macro-editor', 'comment-command')[0];
        if (event.code === binding?.key && binding?.modifiers.every(mod => context.modifiers.includes(mod))) {

            preventDefault(event);

            const pos = save();
            const min = Math.min(pos.start, pos.end);
            const content = toString();
            const between = betweenCursor();

            const editPoints = [min, ...getAllIndexes(between, '\n').filter(i => i !== 0 && i !== between.length - 1).map(i => i + min + 1)].sort((a, b) => a - b).reverse();

            const isCommented = editPoints.every(i => {
                const before = content.substring(0, endOfLine(i));
                const [padding, start, end] = findPadding(before);
                return before.substring(end, end + 3) === "// ";
            });
            const changes = editPoints.map(i => {
                const before = content.substring(0, endOfLine(i));
                const [padding, start, end] = findPadding(before);
                if (isCommented) {
                    restore({start: end, end: end + 3});
                    document.execCommand('delete');
                    return [end, -3];
                } else {
                    restore({start: end, end});
                    insert("// ");
                    return [end, 3];
                }
            });

            highlight(editor);
            restore(adjustedPosition(pos, changes));
        }
    }

    // EDIT END
    function handleTabCharacters(event) {
        if (event.key === 'Tab') {
            preventDefault(event);

            // EDIT START
            const content = toString();
            const between = betweenCursor();
            const pos = save();
            const min = Math.min(pos.start, pos.end);
            const editPoints = [min, ...getAllIndexes(between, '\n').filter(i => i !== 0 && i !== between.length - 1).map(i => i + min + 1)].sort((a, b) => a - b).reverse();

            if (editPoints.length === 1 && !event.shiftKey) {
                insert(options.tab);
            } else {
                const changes = editPoints.map(i => {
                    const before = content.substring(0, endOfLine(i));
                    const [padding, start] = findPadding(before);
                    const len = Math.min(options.tab.length, padding.length);
                    if (event.shiftKey) {
                        restore({start, end: start + len});
                        document.execCommand('delete');
                        return [start, -len];
                    } else {
                        restore({start, end: start});
                        insert(options.tab);
                        return [start, options.tab.length];
                    }
                });

                restore(adjustedPosition(pos, changes));
            }
        }
    }

    function handleUndoRedo(event) {
        if (isUndo(event)) {
            preventDefault(event);
            at--;
            const record = history[at];
            if (record) {
                editor.innerHTML = record.html;
                restore(record.pos);
            }
            if (at < 0)
                at = 0;
        }
        if (isRedo(event)) {
            preventDefault(event);
            at++;
            const record = history[at];
            if (record) {
                editor.innerHTML = record.html;
                restore(record.pos);
            }
            if (at >= history.length)
                at--;
        }
    }

    function recordHistory() {
        if (!focus)
            return;
        const html = editor.innerHTML;
        const pos = save();
        const lastRecord = history[at];
        if (lastRecord) {
            if (lastRecord.html === html
                && lastRecord.pos.start === pos.start
                && lastRecord.pos.end === pos.end)
                return;
        }
        at++;
        history[at] = {html, pos};
        history.splice(at + 1);
        const maxHistory = 300;
        if (at > maxHistory) {
            at = maxHistory;
            history.splice(0, 1);
        }
    }

    function handlePaste(event) {
        preventDefault(event);
        const text = (event.originalEvent || event)
            .clipboardData
            .getData('text/plain')
            .replace(/\r/g, '');
        const pos = save();
        insert(text);
        highlight(editor);
        restore({
            start: Math.min(pos.start, pos.end) + text.length,
            end: Math.min(pos.start, pos.end) + text.length,
            dir: '<-',
        });
    }

    function visit(editor, visitor) {
        const queue = [];
        if (editor.firstChild)
            queue.push(editor.firstChild);
        let el = queue.pop();
        while (el) {
            if (visitor(el) === 'stop')
                break;
            if (el.nextSibling)
                queue.push(el.nextSibling);
            if (el.firstChild)
                queue.push(el.firstChild);
            el = queue.pop();
        }
    }

    function isCtrl(event) {
        return event.metaKey || event.ctrlKey;
    }

    function isUndo(event) {
        return isCtrl(event) && !event.shiftKey && event.code === 'KeyZ';
    }

    function isRedo(event) {
        return isCtrl(event) && event.shiftKey && event.code === 'KeyZ';
    }

    function insert(text) {
        text = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        document.execCommand('insertHTML', false, text);
    }

    function debounce(cb, wait) {
        let timeout = 0;
        return (...args) => {
            clearTimeout(timeout);
            timeout = window.setTimeout(() => cb(...args), wait);
        };
    }

    function findPadding(text) {
        // Find beginning of previous line.
        let i = text.length - 1;
        while (i >= 0 && text[i] !== '\n')
            i--;
        i++;
        // Find padding of the line.
        let j = i;
        while (j < text.length && /[ \t]/.test(text[j]))
            j++;
        return [text.substring(i, j) || '', i, j];
    }

    function toString() {
        return editor.textContent || '';
    }

    function preventDefault(event) {
        event.preventDefault();
    }

    function getSelection() {
        let _a;
        if (((_a = editor.parentNode) === null || _a === void 0 ? void 0 : _a.nodeType) === Node.DOCUMENT_FRAGMENT_NODE) {
            return editor.parentNode.getSelection();
        }
        return window.getSelection();
    }

    return {
        updateOptions(newOptions) {
            Object.assign(options, newOptions);
        },
        updateCode(code) {
            editor.textContent = code;
            highlight(editor);
        },
        onUpdate(cb) {
            callback = cb;
        },
        toString,
        save,
        restore,
        recordHistory,
        destroy() {
            for (let [type, fn] of listeners) {
                editor.removeEventListener(type, fn);
            }
        },
    };
}