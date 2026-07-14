class HelloWorld extends HTMLElement {
  connectedCallback() {
    console.log("Hello World!");
  }
}

customElements.define("hello-world", HelloWorld);
