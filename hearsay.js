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
        
        this.inited = false;
    }

    connectedCallback()
    {
        // set up src for built-in components
        if (this.hasAttribute("multiplier") || this.hasAttribute("map"))
        {
            this.setAttribute("src", "Multiplier.html");
        }

        let startPromise;
        // fetch the component html file
        // and attach a shadow DOM
        if (this.hasAttribute("src"))
        {
            startPromise =
                fetch(this.getAttribute("src"))
                .then( res => res.text() )
                .then( txt => this.attachShadow({mode: "open"}).innerHTML = txt );
        }
        else
            startPromise = Promise.resolve();
        
        startPromise.then( () =>
        {
            // keep track of the element currently being inited
            hearsay.elements = {current: this, previous: hearsay.elements?.current};

            // if a script is present, it's not run by default.
            // create a new script element, copy the code,
            // and replace the non-functional script element with it.
            const oldScript = this.shadowRoot?.querySelector("script");
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
                if (!skip_root && el) el.component = this;
                Array.from(el?.children || []).forEach(rel => addComponentAttribute(rel));
            }
            addComponentAttribute(this, true);
            addComponentAttribute(this.shadowRoot);

            console.log("comp added", this);
            
            // get j-s elements from regular and shadow DOM
            const hsregjs = this.querySelectorAll("j-s");
            addComponentAttribute({children: hsregjs}, true);
            const hsshajs = this.shadowRoot?.querySelectorAll("j-s");
            addComponentAttribute({children: hsshajs}, true);

            // revert elements
            hearsay.elements = hearsay.elements.previous;

            // connection complete

            // used to help subcomponents
            this.inited = true;
    
            // user-provided callback
            this.connected?.(this);
    
            // update j-s and child components
            this.refreshCallback();
        } )
    }

    // other custom element lifecycle callbacks:
    
    disconnectedCallback()
    {
        this.disconnected?.(this);
    }
    
    adoptedCallback()
    {
        this.adopted?.(this);
    }
    
    attributeChangedCallback(name, oldValue, newValue)
    {
        // if the props attribute changes,
        // j-s elements in this component should be recalculateds
        // and update the props attribute of all sub-components
        this.refreshCallback()

        // call custom callback, if present (from setup())

        this.attributeChanged?.(this, name, oldValue, newValue);
    }

    refreshCallback()
    {
        // user callback first, then go through elements
        // this allows the component to add elements
        Promise.resolve()
        .then(() => this.refresh?.(this))
        .then(() =>
        {
            //console.log("updating subcomps");

            // find things to ignore so their children can also be ignored
            
            const ignorereg = this.querySelectorAll(".hearsay-ignore");
            const ignoresha = this.shadowRoot?.querySelectorAll(".hearsay-ignore") || [];
            const allignore = Array.from(ignorereg).concat(Array.from(ignoresha));

            console.log("ignore this!", allignore);
    
            // recalculate j-s elements in this component
    
            const hsregjs = this.querySelectorAll("j-s");
            const hsshajs = this.shadowRoot?.querySelectorAll("j-s") || [];
            const alljs = Array.from(hsregjs).concat(Array.from(hsshajs));

            const mostjs = alljs.filter( el => !allignore.includes( el ) );

            mostjs.forEach( js => js.run() );
            
            // update the props attribute of all sub-components
    
            const subcompsreg = this.querySelectorAll("hear-say:not(.hearsay-ignore)");
            const subcompssha = this.shadowRoot?.querySelectorAll("hear-say:not(.hearsay-ignore)") || [];

            const allsubcomp = Array.from(subcompsreg).concat(Array.from(subcompssha));

            const mostsubcomp = allsubcomp.filter( el => !allignore.includes( el ) );
    
            // this should trigger attributeChangedCallback on all sub-components
            mostsubcomp.forEach( comp => comp._props = comp._props )
        })
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
       
        const self = this;

        function makePropsPropsProxy(propsVal, propsDataHolder, prop)
        {
            // kind of fudgey way to DRY
            const targetObj = { propsVal, propsDataHolder, prop };
            const propsPropsProxyHandler =
            {
                get(target, pprop)
                {
                    let propsDataVal = target.prop ?
                        target.propsDataHolder[target.prop] :
                        target.propsDataHolder;
                    const val = target.propsVal?.[pprop];
                    
                    if (pprop == "toJSON")
                    {
                        console.log("toJSON", target);
                        return () => target.propsVal;
                    }
                    
                    //const val = propsDataChain[prop][pprop] || propsChain[prop][pprop];
                    if (typeof val == "object" && val !== null)
                    {
                        if (propsDataVal == undefined)
                            propsDataVal = target.propsDataHolder[target.prop] = {};
                        return makePropsPropsProxy(target.propsVal[pprop], propsDataVal, pprop)
                    }
                    else
                        return val;
                },

                set(target, pprop, val, receiver)
                {
                    console.log("set prop proxy prop", target, pprop, val, receiver);
                    let t = target.propsDataHolder;
                    if (target.prop)
                    {
                        if (!t[target.prop]) t[target.prop] = {};
                        t = t[target.prop];
                    }
                    t[pprop] = val;
                    
                    // trigger update
                    self.props = self.propsData;
                },

                deleteProperty(target, prop)
                {
                    let t = target.propsDataHolder;
                    if (target.prop) t = t[target.prop];
                    if (prop in t) delete t[prop];
                    // trigger update
                    self.props = self.propsData;
                },

                apply(target, thisArgument, argumentsList)
                {
                    Reflect.apply(target.propsVal, thisArgument, argumentsList);
                },

                construct(target, argumentsList, newTarget)
                {
                    Reflect.construct(target.propsVal, argumentsList, newTarget)
                },
                
                getOwnPropertyDescriptor(target, propertyKey)
                {
                    Reflect.getOwnPropertyDescriptor(target.propsVal, propertyKey);
                },
                
                getPrototypeOf(target)
                {
                    Reflect.getPrototypeOf(target.propsVal)
                },
                
                has(target, propertyKey)
                {
                    Reflect.has(target.propsVal, propertyKey);
                },
                
                isExtensible(target)
                {
                    Reflect.isExtensible(target.propsVal);
                },
                
                ownKeys(target)
                {
                    Reflect.ownKeys(target.propsVal);
                },
                
                /*
                defineProperty(target, propertyKey, attributes)
                {
                    Reflect.defineProperty(target.propsVal, propertyKey, attributes)
                },

                preventExtensions(target)
                {
                    Reflect.preventExtensions(target.propsVal);
                },

                setPrototypeOf(target, prototype)
                {
                    Reflect.setPrototypeOf(target.propsVal, prototype)
                }
                    */
            }
            const proxy = new Proxy(targetObj, propsPropsProxyHandler);
            return proxy;
        }
        
        if (this.propsData != null && typeof this.propsData != "object")
            return this.propsData;
        
        const propsVal = prop_func(this);

        if (this.propsData == null)
        {
            if (typeof propsVal != "object" || Array.isArray(propsVal) || propsVal === null)
                return propsVal;

            // create propsData because may be needed
            //this.propsData = {};
        }
            
        const merge = (target, source) =>
        {
            for (const prop in source)
            {
                const val = target[prop];
                const sval = source[prop];
        
                if (sval)
                {
                    if (typeof sval != "object" || Array.isArray(sval)) // primitives and arrays
                        target[prop] = sval;
                    else if (typeof val == "object") // val and sval are objects
                    {
                        merge(val, sval);
                    }
                }
            }
        }

        merge(propsVal, this.propsData);
        
        const proxy = makePropsPropsProxy(propsVal, this, "propsData");

        return proxy;

    }

    set props(val)
    {
        // was blah blah... this.setAttribute("props", val)
        if (this.hasAttribute("lit-props")) return (props = val, true);

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

// copy all hearsay methods (init, broadcast) to global scope
// TODO: offer a way to avoid this if desired, besides removing the code
Object.assign(window, hearsay);