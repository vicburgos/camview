import {ensureStyle, computed, createEmitter, watch } from "./utils/generator.utils.components.js";

/**
 * @typedef  {Object} SimpleViewProps
 * @property {string} message
 * @property {number} state
 */

/**
 * @typedef  {Object} AdvancedViewInstance
 * @property {HTMLElement} el
 * @property {Function} update
 * @property {Function} destroy
 * @property {Function} on
 * @property {Object} methods
 * @property {Object} hooks
 */

/**
 * @param {SimpleViewProps} initialProps
 * @returns {AdvancedViewInstance}
 */

export default function AdvancedView(initialProps) {
    // --------------------------------------------------
    // props 
    // --------------------------------------------------
    const defaultProps = {
        message: "",
        state: 0
    };
    let props = { ...defaultProps, ...initialProps };

    // --------------------------------------------------
    // computed
    // --------------------------------------------------
    const upperMessageComputed = computed(() => props.message.toUpperCase());
    const stateLabelComputed   = computed(() => `El estado es: ${props.state}`);

    // --------------------------------------------------
    // emit
    // --------------------------------------------------
    const emitter = createEmitter();

    // --------------------------------------------------
    // watch
    // --------------------------------------------------
    const watchState = watch(() => props.state,
        (newVal, oldVal) => {
            console.log("state cambió:", oldVal, "to", newVal);
            emitter.emit("state-change", newVal);
        }
    );

    // --------------------------------------------------
    // lifecycle hooks (in placeholders)
    // --------------------------------------------------
    const hooks = {
        beforeMount() { },
        mounted() { },

        beforeUpdate() { },
        updated() { },

        beforeUnmount() { },
        unmounted() { }
    };



    // --------------------------------------------------
    // <style>
    // --------------------------------------------------
    const css = `
        .advanced-view {
        font-family: Arial, sans-serif;
        color: #333;
        border: 1px solid #ab1c1cff;
        padding: 16px;
        width: fit-content;
        }

        .advanced-view .title {
        font-size: 28px;
        color: #ab1c1cff;
        margin-bottom: 8px;
        }

        .advanced-view .paragraph {
        font-size: 16px;
        margin-bottom: 12px;
        }

        .advanced-view .button {
        padding: 6px 12px;
        cursor: pointer;
        }
  `;
    ensureStyle({ STYLE_ID: "advanced-view-styles", css });

    // --------------------------------------------------
    // template
    // --------------------------------------------------
    hooks.beforeMount();

    const container = document.createElement("div");
    container.className = "advanced-view";
    const title = document.createElement("h1");
    title.className = "title";
    const paragraph = document.createElement("p");
    paragraph.className = "paragraph";
    const button = document.createElement("button");
    button.className = "button";
    button.textContent = "Incrementar estado";
    container.append(title, paragraph, button);

    // --------------------------------------------------
    // methods
    // --------------------------------------------------
    const methods = {
        increment() {
            update({ state: props.state + 1 });
        },

        setMessage(message) {
            update({ message });
        }
    };

    // --------------------------------------------------
    // render
    // --------------------------------------------------
    function render() {
        title.textContent = upperMessageComputed.value;
        paragraph.textContent = stateLabelComputed.value;
    }

    render();
    hooks.mounted();

    // --------------------------------------------------
    // DOM events
    // --------------------------------------------------
    button.addEventListener("click", methods.increment);

    // --------------------------------------------------
    // update
    // --------------------------------------------------
    function update(newProps) {
        hooks.beforeUpdate();

        props = { ...props, ...newProps };

        upperMessageComputed.invalidate();
        stateLabelComputed.invalidate();

        watchState();
        render();

        hooks.updated();
    }

    // --------------------------------------------------
    // destroy (unmount)
    // --------------------------------------------------
    function destroy() {
        hooks.beforeUnmount();
        container.remove();
        hooks.unmounted();
    }

    // --------------------------------------------------
    // API pública (instance)
    // --------------------------------------------------
    return {
        el: container,
        update,
        destroy,
        on: emitter.on, // Suscribir a eventos
        methods, // Pueden ser play, pause etc (pensados para ser llamados desde fuera)
        hooks // Se definen fuera y se usan internamente como un callback
    };
}
