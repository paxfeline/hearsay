# **hearsay**
## Talkative Web Components
## *Build Journal*

### Motivations:

I like:
- Components
- Broadcasting messages

I don't like:
- Large frameworks
- Using Node for every project
- React

### First: Simple Web Components

The idea here is to make a single [custom element](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements) that acts as a shell for user-defined Web Components. (In the following, "custom element," and "[hearsay] component" may be used interchangeably.)

The hearsay custom element class has some basic methods defined. All custom elements can define the following callbacks (as explained at the above link):

- connectedCallback
- disconnectedCallback
- adoptedCallback
- attributeChangedCallback

hearsay components can also use these callbacks via the `setup()` method, explained more below. 

#### connectedCallback

The hearsay component class uses the connectedCallback to load the component's source file. The URL to the file is specified in the component's `src` attribute, and points to an HTML file. The hearsay class fetches the HTML file, and then attaches its contents as the custom element's "[shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)."

**Technical Note**: The use of `fetch()` to retrieve the HTML file means that hearsay requires you to run an HTTP server for local development. Otherwise everything is done client-side. There are some easy ways to run a local HTTP server. The included shell script "server.sh" is one line that uses Python to start an HTTP server in the current working directory. Navigate to the hearsay directory in the Terminal, and then type `./server.sh`.

A component's shadow DOM is what the user will actually see rendered. A component's look and content can be defined entirely in the component's source HTML file.

**Technical Note**: A `<script>` element can be included in the source HTML file. This is where a component can call the `setup()` method, for example. When HTML is fetched and then inserted into the DOM, such `<script>` elements are ignored, for security reasons one assumes. To get around this, hearsay creates a new `<script>` element, copies the code from the old one into the new one, and then replaces the old one with the new one. The new, operational `<script>` element runs its code as soon as it's inserted into the DOM.

In the included `<script>` element, you can call hearsay's `setup()` method. (hearsay keeps track of which element is being initialized during this process.) This method takes a single object as an argument, and does two things:
1. Copies the fields from the passed object into the Component.
2. Calls an `init()` method, if one was provided.

Lastly, in the connectedCallback method, hearsay goes through all the elements in the regular and shadow DOM's and adds a `component` property that references the component it is part of. This is so you could do something like the following inside a component:

```html
<button onclick="broadcast('inc', this.component.key)">
    Click
</button>
```

#### broadcast / react

The above example shows a use of the `broadcast` function. This is another key functionality of hearsay, and it's also very simple. The `broadcast` function uses `document.querySelectorAll()` to get a list of all `hear-say` elements (hearsay components), and invokes their `react` method, if one is present.

If you want your component to be able to respond to messages that are broadcast, you include a `react` method in the object when you call `setup()`. The `react` method has three parameters:
- self: the component
- data
- recipient

The first parameter is used instead of relying on binding `this`, mainly because arrow functions are so popular. The second two parameters are determined purely by the call to `broadcast`.

#### slots

Because they are custom elements, hearsay components can have [slots](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_templates_and_slots#adding_flexibility_with_slots). Slots are useful for cases where you want to be able to place child-elements to be rendered somewhere inside your component.

A custom element is not obliged to display its children. However, if you would like it to, you can include an unnamed `<slot>` element in the component's HTML source. All children of the component will be rendered in this slot -- with the following exception:

If a top-level child of your component has a `slot` attribute that matches the `name` attribute of a `<slot>` element in your component's source (i.e. it's shadow DOM), it will be rendered in that slot.

Named slots can have default content, in case the component has no children with matching `slot` attributes.

hearsay components have a `slot()` method that can be used to programmatically fill slots. It takes the following parameters:
- slot: "slot" for the default slot, or a slot's `name`.
- ...string_or_node: a variable number of either nodes (may be none), or strings (which are inserted as Text nodes), to place into the specified slot. Any content that was there is replaced.

#### props

One thing I don't hate about React is the way you can supply data to a component through "props." The hearsay version of this is to include a `props` attribute for a component, if desired. Like all HTML attributes (including ones that are interpreted as JavaScript code), they are stored as strings. One convenience hearsay provides is a special getter method for `props`.

The code for this evolved a bit as I worked. I ran into the problem that if I programmatically set `props`, it would overwrite any code that had previously been held there.

My solution was to add a private property: `_props`. It's also made visible in the DOM through the `props-data` attribute. `_props` stores a JavaScript object that holds whatever value you set `props` to. This allows you to add objects to `props` via code.

There is still some weirdness I'd like to fix. In particular, the system prioritizes the value of the `props` attribute, which may contain JavaScript code to generate values -- it only allows you to add to `props`, not to overwrite properties coded in the `props` attribute.

### Corollary to `<hear-say>` element

It's a pretty straightforward extension of the ideas above to allow any HTML element to respond to broadcasts. To enable this, hearsay has the `broadcast` function also send messages to elements with a `data-consumer` attribute. This attribute should contain code for a function with the parameters `self`, `data`, and `recipient` (same as the `react` method described above). The `self` parameter will reference the HTML element receiving the message.

### Second: Inline JavaScript

Another thing I don't hate about React is how it allows you to mix JavaScript and HTML in some pretty useful ways. As a simple example, in React you could use some value from `props` to populate the content of an HTML heading element.

The React component might look like this:

Simple.jsx
```javascript
function Simple({title})
{
    return (
        <h1>{title}</h1>
    )
}
```

In JSX, the format used here by React, you can insert JavaScript inside curly braces.

For hearsay, I added a second custom element: `<j-s>`. It's not quite the same, because it only allows JavaScript expressions -- not entire blocks of code. (Likely future feature: add a `long` attribute to allow blocks of code.)

Here is how the equivalent hearsay component source HTML file would look.

Simple.html
```html
<h1>
    <j-s>
        self.component.props?.title
    </j-s>
</h1>
```

Currently the code inside a `<j-s>` element behaves like a function with a single parameter, `self`. This will likely be expanded to also receive `component` and `props` directly (if they exist -- the element could also be used outside of a component).

### Ongoing Work

Custom elements can use a callback to observe changes to specified attributes, and so hearsay components do for `props`. When this callback is triggered, hearsay should make sure all `<j-s>` elements, and the `props` of child components, which may derive from their parents', should be recalculated.

#### Coming: Flow Control

The next custom elements to be added to hearsay will likely be:

- `<if-else>`
  for conditionally displaying contents, determined by evaluating `props` (or another attribute?)

- `<map-over>`
  for creating multiple elements by iterating an array