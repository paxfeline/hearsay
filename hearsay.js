window.hearsay = {}

function setup(opts)
{
    // copy all properties from opts to element
    Object.assign(this.elements.current, opts);

    // call the init function (if present)
    opts.init?.(this.elements.current);
}

hearsay.setup = setup.bind(hearsay);

class HearSay extends HTMLElement
{
    constructor()
    {
        super();
    }

    connectedCallback()
    {
        // fetch the component html file
        // and attach a shadow DOM
        if (this.hasAttribute("src"))
        {
            fetch(this.getAttribute("src"))
            .then( res => res.text() )
            .then( txt => this.attachShadow({mode: "open"}).innerHTML = txt )
            .then( () =>
            {
                // keep track of the element currently being inited
                hearsay.elements = {current: this, previous: hearsay.elements?.current};
    
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
    
                // add "component" property to all children of regular and shadrow root
                const addComponentAttribute = (el, skip_root) =>
                {
                    //console.log(el);
                    skip_root || (el.component = this);
                    Array.from(el.children || []).forEach(rel => addComponentAttribute(rel));
                }
                addComponentAttribute(this, true);
                addComponentAttribute(this.shadowRoot);
                
                // get j-s elements from regular and shadow DOM
                const hsregjs = this.querySelectorAll("j-s");
                addComponentAttribute({children: hsregjs}, true);
                const hsshajs = this.shadowRoot.querySelectorAll("j-s");
                addComponentAttribute({children: hsshajs}, true);
    
                // revert elements
                hearsay.elements = hearsay.elements.previous;
            } )
        }

        this.connected?.();
    }

    // other custom element lifecycle callbacks:
    
    //disconnected
    //adopted
    
    attributeChangedCallback()
    {
        // if the props attribute changes,
        // j-s elements in this component should be recalculateds

        const hsregjs = this.querySelectorAll("j-s");
        const hsshajs = this.shadowRoot?.querySelectorAll("j-s") || [];

        const alljs = Array.from(hsregjs).concat(Array.from(hsshajs));
        alljs.forEach( js => js.run() );

        this.attributeChanged?.();
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
        const prop_att = this.getAttribute("props")?.trim() || "{}";
        const prop_func = Function(`try { return ${prop_att}; } catch { return ${JSON.stringify(prop_att)}; }`);
        return prop_func();
    }

    set props(val)
    {
        this.setAttribute("props", typeof val == "object" ? JSON.stringify(val) : val);
    }

    get key()
    {
        const prop_att = this.getAttribute("key")?.trim() || "null";
        const prop_func = Function(`try { return ${prop_att}; } catch { return ${JSON.stringify(prop_att)}; }`);
        return prop_func();
    }

    set key(val)
    {
        this.setAttribute("key", typeof val == "object" ? JSON.stringify(val) : val);
    }

    static observedAttributes = ["props", "key"];
}

customElements.define("hear-say", HearSay);

class HearSayJS extends HTMLElement
{
    constructor()
    {
        super();
        const root = this.attachShadow({mode: "open"});
        const cont = document.createElement("span");
        cont.id = "content";
        root.append(cont);
        this.cont = cont;
    }
    
    connectedCallback()
    {
        setTimeout( () => this.run() );
    }
    
    run()
    {
        console.log("run", this.textContent);
        this.cont.innerHTML = Function("self", `return ${this.textContent.trim()}`)(this);
    }
}

customElements.define("j-s", HearSayJS);

function broadcast(data, recipient)
{
    // data-consumer elements
    const allConsumerElements = document.querySelectorAll("hear-say");
    allConsumerElements.forEach( consumer => consumer.react?.(consumer, data, recipient) );
    
    // elements with data-consumer attribute
    const allConsumerCallbacks = document.querySelectorAll("[data-consumer]");
    allConsumerCallbacks.forEach( consumer =>
        Function("self, data, recipient", consumer.dataset.consumer)(consumer, data, recipient) );
}

hearsay.broadcast = broadcast.bind(hearsay);

// copy all hearsay methods (init, broadcast) to global scope
Object.assign(window, hearsay);