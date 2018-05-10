<login>
  <button class="icon" action="/api/auth/github">
    <svg xmlns="http://www.w3.org/2000/svg">
      <use xlink:href="/icons/svg-symbols.svg#icons-github" />
    </svg>
  </button>
  <form onsubmit={ submit }>
    <input type="email" name="email" placeholder="Email" required autofocus="on">
    <input type="password" name="password" placeholder="Password" required pattern="^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).\{8,\}$">
    <button>Sign in</button>
  </form>
  <style>
    @import '../schema.css';
    :scope {
      display: block;
      margin: calc(4 * var(--unit-margin)) 10%;
      padding: var(--unit-margin);
      box-sizing: border-box;
      border: solid var(--unit-border-input) var(--color-border-input);
      border-radius: calc(var(--unit-radius-input) + var(--unit-margin));
    }
    svg {
      vertical-align: middle;
      max-width: 100%;
      max-height: 100%;
      padding: 0.25em 0 0.4em;
      width: var(--unit-height-control);
      box-sizing: border-box;
      & use {
        fill: white;
      }
    }
    button.icon {
      padding: 0 0.5em;
    }
  </style>
  <script>
    this.on('mount', () => {
      this.root.querySelectorAll('button[action]').forEach(button => {
        button.addEventListener('click', e => {
          console.log(button.getAttribute('action'))
        })
      })
    })
    this.submit = async e => {
      e.preventDefault()
      const res = await fetch('/api/auth/oidc', {
        method: 'post',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Array.prototype.reduce.call(
          this.root.querySelectorAll('input'), (prev, input) => {
            prev[input.name] = input.value
            return prev
          },  { type: 'credentials' }))
      })
      const json = await res.json()
      console.log(json)
    }
  </script>
</login>