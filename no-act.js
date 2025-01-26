window.noAct = {
    init(opts)
    {
        console.log("init", opts, this.elements.current);
        Object.assign(this.elements.current, opts);
        this.elements.current.opts = opts;
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
        fetch(this.dataset.struct)
        .then( res => res.text() )
        .then( txt => this.attachShadow({mode: "open"}).innerHTML = txt )
        .then( () =>
        {
            noAct.elements = {current: this, previous: noAct.elements?.current};
            const oldScript = this.shadowRoot.querySelector("script");
            if (oldScript)
            {
                const newScript = document.createElement("script");
                newScript.textContent = oldScript.textContent;
                oldScript.replaceWith(newScript);
            }
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

    static observedAttributes = ["props"];
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