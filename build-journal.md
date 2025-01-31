# Hear-Say
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

The idea here is to make a single [custom element](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements) that acts as a shell user-defined Web Components. (In the following, "custom element," and "[web] component" may be used interchangably.)

The Hear-Say custom element class has some basic methods defined. All custom elements can define the following callbacks (as explained at the above link):

- connectedCallback
- disconnectedCallback
- adoptedCallback
- attributeChangedCallback

Hear-Say components can also use these callbacks via the `setup()` method, explained more below. 

#### connectedCallback

The Hear-Say component class uses the connectedCallback to load the component's source file. The URL to the file is specified in the component's `src` attribute, and points to an HTML file. The Hear-Say class fetches the HTML file, and then attaches its contents as the custom element's "[shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)."

A component's shadow DOM is what the user will actually see rendered. A component's look and content can be defined entirely in the component's source HTML file.

**Technical Note**: A `<script>` element can be included in the source HTML file. This is where a component can call the `setup()` method, for example. When HTML is fetched and then inserted into the DOM, such `<script>` elements are ignored, for security reasons one assumes. To get around this, Hear-Say creates a new `<script>` element, copies the code from the old one into the new one, and then replaces the old one with the new one. The new, operational `<script>` element runs its code as soon as its inserted into the DOM.

In the included `<script>` element, you can call Hear-Say's `setup()` method. (Hear-Say keeps track of which element is being initialized during this process.) This method takes a single object as an argument, and does two things:
1. Copies the fields from the passed object into the Component.
2. Calls an `init()` method, if one was provided.

Lastly, in the connectedCallback method, Hear-Say goes through all the elements in the regular and shadow DOM's and adds a `component` property that references the component it is part of. This is so you could do something like the following inside a component:

```html
<button onclick="broadcast('inc', this.component.key)">
    Click
</button>
```

#### broadcast / react

The above example shows a use of the `broadcast` function. This is another key functionality of Hear-Say, and it's also very simple. The `broadcast` function uses `document.querySelectorAll()` to get a list of all `hear-say` elements (Hear-Say components), and invokes their `react` method, if one is present.

If you want your component to be able to respond to messages that are broadcast, you include a `react` method in the object when you call `setup()`. The `react` method has three parameters:
- self: the component
- data
- recipient

The first parameter is used instead of relying on binding `this`, mainly because arrow functions are so popular. The second two parameters are determined purely by the call to `broadcast`.

#### props

One thing I don't hate about React is the way you can supply data to a component through "props." The Hear-Say version of this is to include a `props` attribute for a component, if desired. Like all HTML attributes (including ones that are interpretted as JavaScript code), they are stored as strings. One convenience Hear-Say provides is a special getter method for `props`.

This is what it looks like:

```javascript
get props()
{
    const prop_att = this.getAttribute("props")?.trim() || "{}";
    if (!this._props)
        this._props = Function(`try { return ${prop_att}; } catch { return "${prop_att}"; }`);
    return this._props();
}
```

So say you had this HTML code:

```html
<hear-say 
    src="clicker.html"
    props="{title: 'titular item'}">
</hear-say>
```

Hear-Say extacts the text from the `props` attribute and inserts it into a function with this code:

```javascript
try
{
    return {title: 'titular item'};
}
catch
{
    return "{title: 'titular item'}";
}
```

This formulation also allows for the (I think uncommon) situation where you might want `props` to hold a single string value. In this case, the `try...catch` statement allows you to forgo an extra set of quotation marks. For example:

```html
<hear-say src="clicker.html" props="this is a test"></hear-say>
```

```javascript
try
{
    return this is a test;
}
catch
{
    return "this is a test";
}
```

If you wanted to output a string that would otherwise be interpretted as code, you can fall back to a second set of quotation marks:

```html
<hear-say src="clicker.html" props="'alert(42)'"></hear-say>
```

### First Corollary

It's a pretty straightforward extention of the ideas above to allow any HTML element to respond to broadcasts. To enable this, Hear-Say has the `broadcast` function also send messages to elements with a `data-consumer` attribute. This attribute should contain code for a function with the parameters `self`, `data`, and `recipient` (same as the `react` method described above). The `self` parameter will reference the HTML element recieving the message.

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

For Hear-Say, I added a second custom element: `<j-s>`. It's not quite the same, because it only allows JavaScript expressions -- not entire blocks of code. (Likely future feature: add a `long` attribute to allow blocks of code.)

Here is how the equivalent Hear-Say component source HTML file would look.

```html
<h1>
    <j-s>
        self.component.props?.title
    </j-s>
</h1>
```

Currently the code inside a `<j-s>` element behaves like a function with a single parameter, `self`. This will likely be expanded to also recieve `component` and `props` directly (if they exist -- the element could also be used outside of a component).

### Ongoing Work

Custom elements can use a callback to observe changes to specified attributes, and so Hear-Say components do for `props`. When this callback is triggered, Hear-Say should make sure all `<j-s>` elements, and the `props` of child components, which may derive from their parents', should be recalculated.

#### Coming: Flow Control

The next custom elements to be added to Hear-Say will likely be:

- `<if-else>`
  for conditionally displaying contents, determined by evaluating `props` (or another attribute?)

- `<map-over>`
  for creating multiple elements by iterating an array