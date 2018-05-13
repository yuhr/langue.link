<login>
  <!--
  <button class="icon" action="/api/auth/github">
    <svg xmlns="http://www.w3.org/2000/svg">
      <use xlink:href="/icons/svg-symbols.svg#icons-github" />
    </svg>
  </button>
  -->
  <form onsubmit={ submit }>
    <input type="email" name="email" placeholder="Email address" required>
    <input type="password" name="password" placeholder="Password" required pattern="^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).\{8,\}$" class="tippy" title="Include at least one lowercase, one uppercase and one digit.">
    <span></span>
    <button class="signin"><span>Sign in</span></button>
  </form>
  <div>
    <strong>💌 Email sent.</strong>
    <span>Check your mailbox and validate the account.</span>
  </div>
  <style>
    @import '../colors.css';
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
    div {
      display: none;
      * {
        display: block;
      }
      strong {
        font-size: 2rem;
        font-weight: normal;
      }
    }
  </style>
  <script>
    import * as tippy from 'tippy.js/dist/tippy.all.js'
    this.on('mount', () => {
      tippy(this.root.querySelectorAll('input.tippy'), {
        arrow: true,
        arrowType: 'round',
        animation: 'shift-away',
        innertia: true,
        placement: 'left',
        trigger: 'focus',
        hideOnClick: false
      })
      this.root.querySelectorAll('button[action]').forEach(button => {
        button.addEventListener('click', e => {
          console.log(button.getAttribute('action'))
        })
      })
      this.root.querySelectorAll('input').forEach(input => {
        input.addEventListener('blur', e => {
          input.classList.add('validative')
          setTimeout(() => {
            if (input.value.length === 0) input.classList.remove('validative')
          }, 1000)
        })
      })
    })
    this.submit = async e => {
      const button = this.root.querySelectorAll('button.signin')[0]
      button.disabled = true
      setTimeout(() => { button.disabled = false }, 1000)
      e.preventDefault()
      const res = await fetch('/api/auth', {
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