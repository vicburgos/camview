/**
 * Ensure a style tag exists (or is updated) in the document.
 *
 * @param {Object} params
 * @param {string} params.STYLE_ID - Unique ID for the style element
 * @param {string} params.css - CSS content to inject
 * @returns {void}
 */
export function ensureStyle({ STYLE_ID, css }) {

    if (document.getElementById(STYLE_ID)) return;

    document.head.insertAdjacentHTML(
        "beforeend",
        `<style id="${STYLE_ID}">${css}</style>`
    );
}

// ---------- emit ----------
export function createEmitter() {
    const listeners = {};

    return {
        // Agregar listener
        on(event, fn) {
            (listeners[event] ||= []).push(fn);
        },
        // Activar listeners
        emit(event, payload) {
            (listeners[event] || []).forEach(fn => fn(payload));
        }
    };
}

// ---------- Prepara un computed con validacion ----------
/**
 * 
 * @param {Function} getter
 * @returns 
 */
export function computed(getter) {
    let cache;
    let dirty = true;

    return {
        get value() {
            if (dirty) {
                cache = getter();
                dirty = false;
            }
            return cache;
        },
        invalidate() {
            dirty = true;
        }
    };
}

// --- Prepara un watch para observar cambios en una variable y ejecutar callback (luego emit) ---
// getter: () => newValue, callback: (newVal, oldVal) => ...
export function watch(getter, callback) {
    let oldValue = getter();

    return function runWatch() {
        const newValue = getter();
        if (newValue !== oldValue) {
            callback(newValue, oldValue);
            oldValue = newValue;
        }
    };
}