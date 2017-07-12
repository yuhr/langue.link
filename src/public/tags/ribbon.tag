<ribbon>
  <yield />
  <style>
    @import '../schema.css';
    ribbon {
      position: fixed;
      display: flex;
      flex-flow: row nowrap;
      justify-content: space-between;
      align-content: space-between;
      align-items: center;
      width: 100%;
      height: var(--unit-width-ribbon);
      box-sizing: border-box;
      background-color: var(--color-background);
      & > * {
        display: inline-block;
        flex: 0 0 auto;
        height: 3rem;
      }
      &::after {
        content: '';
        display: block;
        width: 100%;
        height: var(--unit-width-colorline);
        position: absolute;
        bottom: 0;
        right: 0;
        left: 0;
        background: linear-gradient(to right bottom, var(--palette-accent-from), var(--palette-accent-to));
      }
    }
  </style>
</ribbon>

<logo>
  <!--<img src="./imgs/langue.link.svg"></img>-->
  <span>Langue</span>
  <style>
    @import '../schema.css';
    :scope {
      display: flex;
      justify-content: center;
      align-content: center;
      align-items: center;
      & > span {
        letter-spacing: 0.1em;
        font: 400 var(--unit-font-size)/1em 'Varela Round', sans-serif;
        text-transform: uppercase;
        padding: 0 1em;
        &::first-letter {
          letter-spacing: 0.125em;
        }
      }
    }
  </style>
</logo>