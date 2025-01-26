class DataConsumer extends HTMLElement {
    constructor()
    {
      super();
    }
    connectedCallback()
    {
        fetch(this.dataset.struct)
            .then( res => res.text() )
            .then( txt =>
            {
                const root = this.attachShadow({mode: "open"});
                root.innerHTML = txt;
            } )
        
    }
}

customElements.define("data-consumer", DataConsumer);

export { DataConsumer };