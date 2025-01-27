# Hearsay
## simple web components

Hearsay is a very simple framework for creating web components that can broadcast and receive messages. A [custom element](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements) `data-consumer` is defined, and uses the `struct` attribute to specify the URL of an HTML file to be used to create the custom element's [shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM).

Knowledge of custom elements will be helpful; at least until I figure out how to document everything better.

The use of fetch to retrieve the HTML file means that you have to run a local HTTP server. A simple way to do this is to run `python3 -m http.server` in the console in the appropriate directory. The file server.sh is a bash script to do this. Running is slightly simpler, running  `./server.sh`.

---

### `data-consumer` element

##### Required attribute:

- struct: URL of an HTML file to be used to generate the component's shadow DOM.

##### Optional attributes:

- key
- props

  Both of these attributes can contain literal values or code expressions.

  You can use key to address messages to specific components. See example below.

#### Children have a `component` property

Every element inside a component has a `component` property set that points to the component that contains it. This allows you to access things like the component's key attribute, to address a message to a particular component. See example below.

### `data-consumer` attribute:

You can add a `data-consumer` attribute to any HTML element. The value is interpreted as the code for a function.

  #### `data-consumer` function:

  Takes the same parameters as the `react` callback described below.

### `broadcast` function:

  Used to broadcast a message.

  Parameters:

  - data: Whatever.
  - recipients: Whatever. Good choice is adding and using a `key` attribute to the component. See example below.

---

### HTML-fragment struct files

The contents of these files are fetched and attached as the shadow root of the `data-consumer` element.

- `script`:

  A single `script` element can be included. It can be used to call the `setup` function. The function takes a single parameter, an object which may contain any of the following that are desired:

    #### [Custom element lifecycle callbacks](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements#custom_element_lifecycle_callbacks):

    - customConnectedCallback
    - disconnectedCallback
    - adoptedCallback
    - attributeChangedCallback

    #### hearsay functions:

    - init

      Hearsay will call this immediately.

    - react

      Respond to a message that's been broadcast.

      Parameters:

      - consumer: The component or element receiving the message.
      - data
      - recipients

      The consumer is passed as a parameter rather than by binding `this` so that developers can use arrow functions.

      The `data` and `recipients` parameters are determined entirely by what is passed to `broadcast`.
    
    #### user functions:

    - You can include other functions.

- slots

  You can include slots in your HTML file, either named or unnamed. Hearsay components have a `slot` function that can be used to quickly set the content of these slots.

  Parameters:

  - name

     Either 'slot' for the default slot (no name attribute), or a value matching the name attribute of a slot.

  - ...data

    One or more strings or nodes.

---

### The Simplest Example:

This example uses the `data-consumer` element to create a `clicker` component. The component uses `init` to set up an initial state, and `react` to respond to the "inc" message.

index.html
```html
<html>
    <head>
        <script src="hearsay.js"></script>
    </head>
    <body>
        <data-consumer struct="clicker.html"></data-consumer>
    </body>
</html>
```

clicker.html
```html
<script>
    setup({
        init: self =>
        {
            self.num = 0;
            self.slot("slot", self.num);
        },
        react: (self, data, recipients) =>
        {
            if (data == "inc")
            {
                self.num++;
                self.slot("slot", self.num);
            }
        },
    });
</script>
<h1>Clicker</h1>
<div>
    You have clicked
    <slot></slot>
    times!
</div>

<button onclick="broadcast('inc')">
    Click
</button>
```

### Example using the key attribute:

index.html
```html
<html>
    <head>
        <script src="hearsay.js"></script>
    </head>
    <body>
        <data-consumer struct="clicker.html" key="1"></data-consumer>
        <data-consumer struct="clicker.html" key="2"></data-consumer>
    </body>
</html>
```

clicker.html
```html
<script>
    setup({
        init: self =>
        {
            self.num = 0;
            self.slot("slot", self.num);
        },
        react: (self, data, recipients) =>
        {
            if (data == "inc" && self.key == recipients)
            {
                self.num++;
                self.slot("slot", self.num);
            }
        },
    });
</script>
<h1>Clicker</h1>
<div>
    You have clicked
    <slot></slot>
    times!
</div>

<button onclick="broadcast('inc', this.component.key)">
    Click
</button>
```

### Example including a named slot:

index.html
```html
<html>
    <head>
        <script src="hearsay.js"></script>
    </head>
    <body>
        <data-consumer struct="clicker.html" key="1"></data-consumer>
        <data-consumer struct="clicker.html" key="2">
            <span slot="title">Click'im</span>
        </data-consumer>
    </body>
</html>
```

clicker.html
```html
<script>
    setup({
        init: self =>
        {
            self.num = 0;
            self.slot("slot", self.num);
        },
        react: (self, data, recipients) =>
        {
            if (data == "inc" && self.key == recipients)
            {
                self.num++;
                self.slot("slot", self.num);
            }
        },
    });
</script>
<h1><slot name="title">Clicker</slot></h1>
<div>
    You have clicked
    <slot></slot>
    times!
</div>

<button onclick="broadcast('inc', this.component.key)">
    Click
</button>
```

## Example using `data-consumer` attribute:

index.html
```html
<html>
    <head>
        <script src="hearsay.js"></script>
    </head>
    <body>
        <div>
            <div
                style="display: inline-block;"
                onclick="broadcast('clicked', 'self')"
                data-consumer="
                    consumer.innerHTML += `${data}, ${recipients}<br>`;
                ">
                <div style="border: 1em solid black">
                    Click Here
                </div>
            </div>
        </div>
    </body>
</html>
```

