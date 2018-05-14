<view-article data-is="view">
  <article>
    <yield />
  </article>
  <style>
    @import '../colors.css';
    :scope {
      background-color: var(--color-background-active);
    }
    article {
      margin: 8mm;
    }
    header {
      position: relative;
      &::after {
        content: '';
        height: 0.2mm;
        width: 100%;
        background-color: var(--color-border-view);
        position: absolute;
        bottom: -2mm;
        left: 0;
      }
      margin-bottom: 10mm;
    }
  </style>
</view-article>