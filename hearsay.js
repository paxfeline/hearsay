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

                // connection complete

                // used to help subcomponents
                this.inited = true;
        
                // user-provided callback
                this.connected?.();
        
                // update j-s and child components
                this.recalculate();
            } )
        }
    }

    // other custom element lifecycle callbacks:
    
    //disconnected
    //adopted
    
    attributeChangedCallback(name, oldValue, newValue)
    {
        // if the props attribute changes,
        // j-s elements in this component should be recalculateds
        // and update the props attribute of all sub-components
        this.recalculate()

        // call custom callback, if present (from setup())

        this.attributeChanged?.(name, oldValue, newValue);
    }

    recalculate()
    {
        //console.log("updating subcomps");

        // recalculate j-s elements in this component

        const hsregjs = this.querySelectorAll("j-s");
        const hsshajs = this.shadowRoot?.querySelectorAll("j-s") || [];

        const alljs = Array.from(hsregjs).concat(Array.from(hsshajs));
        alljs.forEach( js => js.run() );

        // update the props attribute of all sub-components

        const subcompsreg = this.querySelectorAll("hear-say");
        const subcompssha = this.shadowRoot?.querySelectorAll("hear-say") || [];

        const allsubcomp = Array.from(subcompsreg).concat(Array.from(subcompssha));

        // this should trigger attributeChangedCallback on all sub-components
        allsubcomp.forEach( comp => comp._props = comp._props )
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

            /* new idea:

            return a proxy from get props()

            the proxy will then get or set
            properties on the appropriate object:
            props (get) or dataProps (get or set)

            will have to override iterate
            or whatever it is

            also cache props?
            */

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

        function makePropsPropsProxy(propsVal, propsDataChain, prop, ptarget)
        {
            // kind of fudgey way to DRY(M)
            let targetObj;
            if (ptarget)
                targetObj = ptarget;
            else
            {
                // // if this propsData subobject doesn't exist, create an empty one
                //propsDataChain[prop] = propsDataChain[prop] || {};
                targetObj = { props: propsVal, propsData: propsDataChain, prop };
            }
            const propsPropsProxyHandler =
            {
                get(target, pprop)
                {
                    //console.log(target.propsData, propsDataChain, target.propsData == propsDataChain)
                    //console.log(target.props[pprop], propsVal, target.props[pprop] == propsVal);
                    const propsDataVal = target.prop ? target.propsData[target.prop] : target.propsData;
                    const val = propsDataVal?.[pprop] || propsVal[pprop];
                    //const val = propsDataChain[prop][pprop] || propsChain[prop][pprop];
                    if (typeof val == "object")
                    {
                        if (!propsDataVal)
                            propsDataVal = target.propsData[target.prop] = {};
                        return makePropsPropsProxy(propsVal[pprop], propsDataVal, pprop)
                        //return makePropsPropsProxy(propsChain[prop], propsDataChain[prop], pprop)
                    }
                    else
                        return val;
                },

                set(target, pprop, val, receiver)
                {
                    console.log("set prop proxy prop", target, pprop, val, receiver);
                    if (target.prop)
                    {
                        if (!target.propsData[target.prop]) target.propsData[target.prop] = {};
                        target.propsData[target.prop][pprop] = val;
                    }
                    else
                    {
                        target.propsData[pprop] = val;
                    }
                    // trigger update
                    self.props = self.propsData;
                }
            }
            const proxy = new Proxy(targetObj, propsPropsProxyHandler);
            return proxy;
        }

        // create propsData because may be needed
        if (!this.propsData) this.propsData = {};
        const proxy = makePropsPropsProxy(prop_func(this), this.propsData, null, this);

        /*
        const propsProxyTarget = { props: prop_func(this), propsData: this.propsData };
        const propsProxyHandler = {
            get(target, prop)
            {
                console.log("props proxy get", this);
                // get prop, try from propsData first, then props
                let propsDataVal = target.propsData[prop];
                let propsVal = target.props[prop];
                const val = propsDataVal || propsVal;
                if (typeof val == "object")
                {
                    // if blah doesn't exist, create an empty one
                    return makePropsPropsProxy(target.props, target.propsData, prop);
                    //return makePropsPropsProxy({props: propsVal, propsData: propsDataVal});
                }
                // else:
                return val;
            },
            set(target, prop, val, receiver)
            {
                console.log("set prop", target, prop, val, receiver);
                target.propsData[prop] = val;
                self.props = self.propsData;
            }
        }

        const proxy = new Proxy(propsProxyTarget, propsProxyHandler);
        */

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