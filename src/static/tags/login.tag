<login>
  <!--
  <button class="icon" action="/api/auth/github">
    <svg xmlns="http://www.w3.org/2000/svg">
      <use xlink:href="/icons/svg-symbols.svg#icons-github" />
    </svg>
  </button>
  -->
  <form onsubmit={ submit }>
    <input type="email" name="email" placeholder="Email" required autofocus="on">
    <input type="password" name="password" placeholder="Password" required pattern="^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).\{8,\}$">
    <button>Sign in</button>
  </form>
  <style>
    @import '../schema.css';
    :scope {
      display: block;
      margin: 4mm 10%;
      padding: 1mm;
      box-sizing: border-box;
      border: solid 0.3mm var(--color-border-input);
      border-radius: 2mm;
    }
    svg {
      vertical-align: middle;
      max-width: 100%;
      max-height: 100%;
      padding: 0.25em 0 0.4em;
      width: 2.25rem;
      box-sizing: border-box;
      * {
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