<content-user data-is="content">
  <view-login />
  <script>
    import { query } from '../query'
    this.on('mount', async () => {
      const me = await query('/api/oidc/me')
      console.log(me)
    })
  </script>
</content-user>