window.noAct = {
    init(opts)
    {
        // copy all properties from opts to element
        Object.assign(this.elements.current, opts);

        // call the init function (if present)
        opts.init?.(this.elements.current);
    }
};

class DataConsumer extends HTMLElement {
    constructor()
    {
        super();
    }

    connectedCallback()
    {
        // fetch the component html file
        // and attach a shadow DOM
        fetch(this.getAttribute("struct"))
        .then( res => res.text() )
        .then( txt => this.attachShadow({mode: "open"}).innerHTML = txt )
        .then( () =>
        {
            // keep track of the element currently being inited
            noAct.elements = {current: this, previous: noAct.elements?.current};

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
            noAct.elements = noAct.elements.previous;
        } )

        this.opts?.connectedCallback?.();
    }

    disconnectedCallback()
    {
        this.opts?.disconnectedCallback?.();
    }

    adoptedCallback()
    {
        this.opts?.adoptedCallback?.();
    }

    attributeChangedCallback()
    {
        this.opts?.attributeChangedCallback?.();
    }

    react(data)
    {
        this.opts?.react?.(this, data);
    }

    /* util functions */

    slot(name, data)
    {
        // if no data to set, return value
        if (data === undefined) return this.querySelector(`[slot="${name}"]`).children;

        if (!Array.isArray(data)) data = [data];
        this.querySelector(`[slot="${name}"]`).replaceChildren(...data
            .map( el => el.nodeType ? el : document.createTextNode(el) )
        );
    }
    
    get key()
    {
        return this._key?.() || this.getAttribute("key");
    }

    set key(val)
    {
        this.setAttribute("key", val);
        this._key = Function(`return ${val}`);
    }

    static observedAttributes = ["props", "key"];
}

customElements.define("data-consumer", DataConsumer);

function broadcast(data, recipients)
{
    // data-consumer elements
    const allConsumerElements = document.querySelectorAll("data-consumer");
    allConsumerElements.forEach( consumer => consumer.react(consumer, data, recipients) );
    
    // elements with data-consumer attribute
    const allConsumerCallbacks = document.querySelectorAll("[data-consumer]");
    allConsumerCallbacks.forEach( consumer => consumer(consumer, data, recipients) );
}

noAct.broadcast = broadcast;