<ribbon>
  <yield />
  <style>
    @import '../colors.css';
    ribbon {
      position: fixed;
      display: flex;
      flex-flow: row nowrap;
      justify-content: space-between;
      align-content: space-between;
      align-items: center;
      width: 100%;
      height: 3rem;
      padding: 0 5mm;
      box-sizing: border-box;
      background-color: var(--color-background-active);
      > * {
        display: inline-block;
        flex: 0 0 auto;
        height: 3rem;
      }
      &::after {
        content: '';
        display: block;
        width: 100%;
        height: 0.5mm;
        position: absolute;
        bottom: 0;
        right: 0;
        left: 0;
        background: linear-gradient(to right bottom, var(--palette-accent-from), var(--palette-accent-to));
        box-shadow: 0 0 1mm color(var(--palette-accent-from) s(+200%) a(-50%));
      }
    }
  </style>
</ribbon>

<logo>
  <!--<img src="./imgs/langue.link.svg"></img>-->
  <span><yield /></span>
  <style>
    @import '../colors.css';
    :scope {
      display: flex;
      justify-content: center;
      align-content: center;
      align-items: center;
      color: rgba(#666460, 0.9);
      height: 100%;
      span {
        letter-spacing: 0.1em;
        font: 400 1rem/1em 'Varela Round', sans-serif;
        text-transform: uppercase;
        padding: 0 1em;
        &::first-letter {
          letter-spacing: 0.125em;
        }
      }
    }
  </style>
</logo>