window.Hearsay = {}

function setup(opts)
{
    // copy all properties from opts to element
    Object.assign(this.elements.current, opts);

    // call the init function (if present)
    opts.init?.(this.elements.current);
}

Hearsay.setup = setup.bind(Hearsay);

class DataConsumer extends HTMLElement {
    constructor()
    {
        super();
    }

    connectedCallback()
    {
        // fetch the component html file
        // and attach a shadow DOM
        if (this.hasAttribute("struct"))
        {
            fetch(this.getAttribute("struct"))
            .then( res => res.text() )
            .then( txt => this.attachShadow({mode: "open"}).innerHTML = txt )
            .then( () =>
            {
                // keep track of the element currently being inited
                Hearsay.elements = {current: this, previous: Hearsay.elements?.current};
    
                // if a script is present, it's not run by default.
                // create a new script element, copy the code,
                // and replace the non-functional script element with it.
                const oldScript = this.shadowRoot.querySelector("script");
                if (oldScript)
                {
                    const newScript = document.createElement("script");
                    newScript.textContent = oldScript.textContent;
                    oldScript.replaceWith(newScript);
                }
    
                // add "component" property to all children of shadrow root
                const addComponentAttribute = (el) =>
                {
                    el.component = this;
                    Array.from(el.children || []).forEach(rel => addComponentAttribute(rel));
                }
                addComponentAttribute(this.shadowRoot);
    
                // revert elements
                Hearsay.elements = Hearsay.elements.previous;
            } )
        }

        this.customConnectedCallback?.();
    }

    /* util functions */

    slot(name, ...data)
    {
        // if the default slot is replaced, first save all named slots
        // replace everything, and put back named slots
        if (name == "slot")
        {
            const slots = Array.from(this.querySelectorAll("[slot]"));
            this.replaceChildren(
                ...data.map( el => el.nodeType ? el : document.createTextNode(el) ),
                ...slots
            );
        }
        // if element filling slot exists, just replace its children
        else
        {
            const slot = this.querySelector(`[slot="${name}"]`);
            const nodes = data.map( el => el.nodeType ? el : document.createTextNode(el) );
            
            // if one exists, replace its children
            if (slot)
            {
                slot.replaceChildren( ...nodes );
            }
            // otherwise create element to fill slot
            else
            {
                const span = document.createElement("span");
                span.setAttribute("slot", name);
                span.append( ...nodes );
                this.append(span);
            }
        }
    }
    
    // key and props should accept JS code
    // and fall back to their string values

    get props()
    {
        if (!this._props)
            this.props = this.getAttribute("props");
        return this._props?.();
    }

    set props(val)
    {
        this.setAttribute("props", val);
        this._props = Function(`try { return ${val}; } catch { return "${val}"; }`);
    }
    
    get key()
    {
        if (!this._key)
            this.key = this.getAttribute("key");
        return this._key?.();
    }

    set key(val)
    {
        this.setAttribute("key", val);
        this._key = Function(`try { return ${val}; } catch { return "${val}"; }`);
    }

    static observedAttributes = ["props", "key"];
}

customElements.define("data-consumer", DataConsumer);

function broadcast(data, recipient)
{
    // data-consumer elements
    const allConsumerElements = document.querySelectorAll("data-consumer");
    allConsumerElements.forEach( consumer => consumer.react(consumer, data, recipient) );
    
    // elements with data-consumer attribute
    const allConsumerCallbacks = document.querySelectorAll("[data-consumer]");
    allConsumerCallbacks.forEach( consumer =>
        Function("consumer, data, recipient", consumer.dataset.consumer)(consumer, data, recipient) );
}

Hearsay.broadcast = broadcast.bind(Hearsay);

// copy all Hearsay methods (init, broadcast) to global scope
Object.assign(window, Hearsay);