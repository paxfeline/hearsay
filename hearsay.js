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
    
    attributeChangedCallback(name, oldValue, newValue)
    {
        // if the props attribute changes,
        // j-s elements in this component should be recalculateds

        const hsregjs = this.querySelectorAll("j-s");
        const hsshajs = this.shadowRoot?.querySelectorAll("j-s") || [];

        const alljs = Array.from(hsregjs).concat(Array.from(hsshajs));
        alljs.forEach( js => js.run() );

        // update the props attribute of all sub-components

        const subcompsreg = this.querySelectorAll("hear-say");
        const subcompssha = this.shadowRoot?.querySelectorAll("hear-say") || [];

        const allsubcomp = Array.from(subcompsreg).concat(Array.from(subcompssha));
        // will this do it (trigger attributeChangedCallback)?
        console.log("updating subcomps");
        allsubcomp.forEach( comp => comp._props = comp._props )

        // call custom callback, if present (from setup())

        this.attributeChanged?.(name, oldValue, newValue);
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
        console.log("get props");
        // TODO: document: add lit-props attribute
        // to specify a string literal as the value of props.
        // this avoids errors that would be caused by
        // the string being interpretted as javascript (below).
        if (this.hasAttribute("lit-props")) return this.getAttribute("props");

        // TODO: add component, props parameters
        const prop_att = this.getAttribute("props")?.trim() || "{}";
        const prop_func = Function("self", `return ${prop_att};`);

        /* what follows is like this: 
            First, the props attribute is evaluated for a returned object,
            which is then combined with propsData, which is programmatically
            set via the props setter.
            A proxy is made for the composite object, with a special getting and setter.
            One thing it does is, if an object property of props is being returned,
            it wraps the object in the same proxy. So when accessing nested object,
            each gets wrapped in the proxy before being returned.
            But why? The getter also prepends information about the current
            getter call to the getPath array.
            This means that if you write:
                this.props.foo.bar.baz = 42;
            in the process, first the props() getter is called.
            It generates the composite object, wraps it in a proxy, and returns it.
            getPath starts out as [{target: self, prop: "props"}]
            Then, as the code is evaluated, the proxy's getter method is called.
            It prepends its information, so getPath will become
            [{target: (object), prop: "foo"}, {target: self, prop: "props"}]
            And as this process continues the array grows to:
                [
                    {target: (foo object), prop: "bar"},
                    {target: (props object), prop: "foo"},
                    {target: this, prop: "props"}
                ]
            Finally code execution reaches the equals sign and the setter is called.
            First, the setter does its job: sets the value of the property on the target.
            Then, it's time to go backwards:
            The reduce function is used to iterate the getPath array.
            First the current target, {baz: 42}, is assigned foo.bar,
                the foo object is assigned to props.foo, and finally
                the props object is assigned to this.props.
            
            All this so that users can mutate the props object,
            and have the changes be reflected
            (instead of having to replace the props object).
        */
       
        const propsObj = { ...prop_func(this), ...(this.propsData || []) };
       
        const getPath = [{target: this, prop: "props"}];
        const proxy = (function makeProxy(obj)
        {
            const propsHandler =
            {
                get(target, prop)
                {
                    if (typeof target[prop] == "object")
                    {
                        getPath.unshift({target, prop})
                        return makeProxy(target[prop])
                    }
                    else
                        return target[prop];
                },

                set(target, prop, value)
                {
                    target[prop] = value;
                    getPath.reduce(
                        (acc, {target: ptarget, prop: pprop}) => (ptarget[pprop] = acc, ptarget),
                        target
                    );
                }
            }
            const proxy = new Proxy(obj, propsHandler);
            return proxy;
        })
        (propsObj);

        return proxy;
    }

    set props(val)
    {
        // was blah blah... this.setAttribute("props", val)
        if (this.hasAttribute("lit-props")) return (props = val);

        this.propsData = val;
        this.setAttribute("props-data", JSON.stringify(val));
    }

    get _props()
    {
        return this.getAttribute("props");
    }

    set _props(val)
    {
        this.setAttribute("props", val);
    }

    get key()
    {
        // TODO: document: add lit-key attribute
        // to specify a string literal as the value of key.
        if (this.hasAttribute("lit-key")) return this.getAttribute("key");

        const prop_att = this.getAttribute("key")?.trim() || "null";
        const prop_func = Function("self", `return ${prop_att};`);

        // returns key-data if its been programmatically set,
        // otherwise the regular key value
        return this._key || prop_func(this);
    }

    set key(val)
    {
        if (this.hasAttribute("lit-key")) return this.setAttribute("key", val);

        this._key = val;
        this.setAttribute("key-data", JSON.stringify(val));
    }

    // register attributes to observe

    static observedAttributes = ["props","props-data", "key"];
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