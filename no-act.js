class DataConsumer extends HTMLElement {
    constructor()
    {
      super();

      /* MDN suggests this maybe better in connectedCallback
        but I think it's ok here because it doesn't matter
        because... */
      
      fetch(this.dataset.struct)
          .then( res => res.text() )
          .then( txt => this.attachShadow({mode: "open"}).innerHTML = txt )
          .then( () =>
            {
                window.noAct = window.noAct || {};
                noAct.elements = {current: this, previous: noAct.currentElement};
                const oldScript = this.shadowRoot.querySelector("script");
                if (oldScript)
                {
                    const newScript = document.createElement("script");
                    newScript.textContent = oldScript.textContent;
                    oldScript.replaceWith(newScript);
                }
                noAct.elements = noAct.elements.previous;
            } )
    }

    connectedCallback()
    {   
    }
}

customElements.define("data-consumer", DataConsumer);

function broadcastToConsumers(data, tos)
{
    const allConsumers = document.querySelectorAll("")
}

export { DataConsumer };