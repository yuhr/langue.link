<content- data-is="content">
  <view-article>
    <header>
      <h1>Article Title</h1>
    </header>
    <main>
      <p>Paragraph1</p>
    </main>
    <footer>
      <span>This is a footer text.</span>
    </footer>
  </view-article>
  <script>
    import { query } from '../query'
    this.on('mount', async () => {
      const me = await query('/api/oidc/me')
      console.log(me)
    })
  </script>
</content->