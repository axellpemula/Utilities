/** Minimal stand-in for `@minecraft/server-ui`. */

/** Every form built during a test, in order. */
export const forms = [];

/** Queued responses; when empty, `show()` resolves as "cancelled". */
export const formResponses = [];

/** Matches the engine enum used to retry a form that was shown too early. */
export const FormCancelationReason = Object.freeze({
    UserBusy: "UserBusy",
    UserClosed: "UserClosed",
    UserClosedScreen: "UserClosedScreen"
});

export function resetForms() {
    forms.length = 0;
    formResponses.length = 0;
}

export class ModalFormData {
    constructor() {
        this.fields = [];
        forms.push(this);
    }
    title(value) {
        this.fields.push({ type: "title", value });
        return this;
    }
    toggle(label, options = {}) {
        this.fields.push({ type: "toggle", label, options });
        return this;
    }
    dropdown(label, items, options = {}) {
        this.fields.push({ type: "dropdown", label, items, options });
        return this;
    }
    slider(label, min, max, options = {}) {
        this.fields.push({ type: "slider", label, min, max, options });
        return this;
    }
    show(player) {
        this.player = player;
        const response = formResponses.shift();
        return Promise.resolve(response ?? { canceled: true, formValues: undefined });
    }
    /** Values as a player would see them when they submit the defaults. */
    defaultValues() {
        return this.fields
            .filter(field => field.type !== "title")
            .map(field => field.options?.defaultValue ?? field.options?.defaultValueIndex ?? 0);
    }
}

/**
 * `ActionFormData` keeps its elements in order - `title`, `body`, `header`,
 * `label`, `divider` and `button` - and reports the clicked index among the
 * buttons only, exactly like the engine does.
 */
export class ActionFormData {
    constructor() {
        this.elements = [];
        forms.push(this);
    }
    title(value) {
        this.elements.push({ type: "title", text: value });
        return this;
    }
    body(value) {
        this.elements.push({ type: "body", text: value });
        return this;
    }
    header(value) {
        this.elements.push({ type: "header", text: value });
        return this;
    }
    label(value) {
        this.elements.push({ type: "label", text: value });
        return this;
    }
    divider() {
        this.elements.push({ type: "divider" });
        return this;
    }
    button(text, iconPath) {
        this.elements.push({ type: "button", text, iconPath });
        return this;
    }
    show(player) {
        this.player = player;
        const form = this;
        // The response is taken when the promise settles, not when the form is
        // built: a test can open the panel, look at the buttons the panel
        // produced and only then decide which one to "click". A queued
        // function is called with the form, which lets a test script several
        // screens of one panel (main -> advanced -> back) up front.
        return Promise.resolve().then(() => {
            const entry = formResponses.shift();
            if (typeof entry === "function") return entry(form);
            return entry ?? { canceled: true, cancelationReason: FormCancelationReason.UserClosed };
        });
    }
    /** The buttons of this form, in click order. */
    get buttons() {
        return this.elements.filter(element => element.type === "button");
    }
    /** The title message. */
    get titleText() {
        return this.elements.find(element => element.type === "title")?.text;
    }
    /** Index of the first button whose text contains `needle`. */
    indexOf(needle) {
        return this.buttons.findIndex(button => JSON.stringify(button.text).includes(needle));
    }
}
